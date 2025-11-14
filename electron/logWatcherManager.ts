import fs from 'node:fs'
import path from 'node:path'
import type { StopLogWatcher } from './logWatcher'
import { startLogWatcher } from './logWatcher'
import { getLatestSteamLog, MTGA_LOG_CANDIDATES } from './config'

type LogWatcherCallbacks = {
  onReady: (logPath: string) => void
  onLine: (line: string) => void
  onError: (error: Error) => void
  onStatus: (status: { level: 'info' | 'warning' | 'error'; message: string; detail?: string }) => void
}

/**
 * Gerencia o watcher de log, monitorando continuamente por arquivos mais recentes
 */
export class LogWatcherManager {
  private stopWatcher: StopLogWatcher | null = null
  private currentLogPath: string | null = null
  private checkInterval: NodeJS.Timeout | null = null
  private callbacks: LogWatcherCallbacks
  private isChecking = false

  constructor(callbacks: LogWatcherCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Inicia o gerenciador, buscando o log mais recente e monitorando por novos
   */
  start() {
    this.checkForLatestLog()
    
    // Verificar a cada 5 segundos se há um arquivo mais recente
    this.checkInterval = setInterval(() => {
      this.checkForLatestLog()
    }, 5000)
  }

  /**
   * Para o gerenciador
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.stopWatcher) {
      this.stopWatcher()
      this.stopWatcher = null
    }
    this.currentLogPath = null
  }

  /**
   * Verifica se há um arquivo de log mais recente e troca se necessário
   */
  private checkForLatestLog() {
    if (this.isChecking) return
    this.isChecking = true

    try {
      this.callbacks.onStatus({
        level: 'info',
        message: 'Buscando arquivo de log mais recente...',
      })

      const latestLog = this.findLatestLog()
      
      if (!latestLog) {
        this.callbacks.onStatus({
          level: 'warning',
          message: 'Nenhum arquivo de log encontrado',
        })
        this.isChecking = false
        return
      }

      // Se já estamos observando este arquivo, não fazer nada
      if (this.currentLogPath === latestLog.path) {
        this.isChecking = false
        return
      }

      // Se há um arquivo mais recente, trocar
      if (!this.currentLogPath || latestLog.mtime > this.getCurrentLogMtime()) {
        this.switchToLog(latestLog.path)
      }
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Encontra o arquivo de log mais recente disponível
   */
  private findLatestLog(): { path: string; mtime: Date } | null {
    const candidates: { path: string; mtime: Date }[] = []

    // Verificar logs do Steam
    const steamLog = getLatestSteamLog()
    if (steamLog) {
      try {
        const stats = fs.statSync(steamLog)
        if (stats.isFile()) {
          candidates.push({ path: steamLog, mtime: stats.mtime })
        }
      } catch {
        // Ignorar erros
      }
    }

    // Verificar outros candidatos
    for (const candidate of MTGA_LOG_CANDIDATES) {
      try {
        if (fs.existsSync(candidate)) {
          const stats = fs.statSync(candidate)
          if (stats.isFile()) {
            candidates.push({ path: candidate, mtime: stats.mtime })
          }
        }
      } catch {
        // Ignorar erros
      }
    }

    // Verificar diretório do Steam por novos arquivos
    const steamLogsDir = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Logs\\Logs'
    try {
      if (fs.existsSync(steamLogsDir)) {
        const files = fs.readdirSync(steamLogsDir)
        const logFiles = files
          .filter((file) => file.toLowerCase().endsWith('.log'))
          .map((file) => {
            const filePath = path.join(steamLogsDir, file)
            try {
              const stats = fs.statSync(filePath)
              return { path: filePath, mtime: stats.mtime }
            } catch {
              return null
            }
          })
          .filter((f): f is { path: string; mtime: Date } => f !== null)
        
        candidates.push(...logFiles)
      }
    } catch {
      // Ignorar erros
    }

    if (candidates.length === 0) return null

    // Retornar o mais recente
    candidates.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return candidates[0]
  }

  /**
   * Obtém a data de modificação do log atual
   */
  private getCurrentLogMtime(): Date {
    if (!this.currentLogPath) return new Date(0)
    
    try {
      const stats = fs.statSync(this.currentLogPath)
      return stats.mtime
    } catch {
      return new Date(0)
    }
  }

  /**
   * Troca para um novo arquivo de log
   */
  private switchToLog(logPath: string) {
    // Parar watcher atual
    if (this.stopWatcher) {
      this.stopWatcher()
      this.stopWatcher = null
    }

    this.currentLogPath = logPath

    this.callbacks.onStatus({
      level: 'info',
      message: 'Arquivo de log atualizado',
      detail: logPath,
    })

    // Iniciar novo watcher
    try {
      this.stopWatcher = startLogWatcher({
        filePath: logPath,
        onReady: ({ path }) => {
          this.callbacks.onReady(path)
          this.callbacks.onStatus({
            level: 'info',
            message: 'Observando o log do MTGA',
            detail: path,
          })
        },
        onLine: this.callbacks.onLine,
        onError: this.callbacks.onError,
      })
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Retorna o caminho do log atual
   */
  getCurrentLogPath(): string | null {
    return this.currentLogPath
  }
}

