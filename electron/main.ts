import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { parseLogLine } from './mtgaParser'
import { IPC_CHANNELS, type StatusPayload } from './config'
import { findMTGALogs, type LogSearchResult } from './logFinder'
import { parseRawLine } from './logParser'
import { processLogLine, resetRpcReconstructor } from './rpcReconstructor'
import { interpretRpc } from './rpcInterpreters'
import { LogWatcherManager } from './logWatcherManager'
import type { RpcCall, InterpretedEvent } from './types/log'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let logWatcherManager: LogWatcherManager | null = null
let lineIndex = 0

// Caminho do preload - usar caminho absoluto
const preload = path.resolve(__dirname, '../preload/preload.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

const broadcast = (channel: string, payload: unknown) => {
  if (!win) return
  win.webContents.send(channel, payload)
}

const sendStatus = (status: StatusPayload) => {
  broadcast(IPC_CHANNELS.status, status)
}

const startLogWatcherManager = () => {
  // Parar gerenciador anterior se existir
  logWatcherManager?.stop()

  // Resetar contador e reconstrutor de RPCs
  lineIndex = 0
  resetRpcReconstructor()

  // Criar novo gerenciador
  logWatcherManager = new LogWatcherManager({
    onReady: (logPath) => {
      broadcast(IPC_CHANNELS.getLogPath, logPath)
    },
    onLine: (line) => {
      lineIndex++
      broadcast(IPC_CHANNELS.logLine, line)

      // Parsear linha bruta
      const rawLogLine = parseRawLine(line, lineIndex)

      // Processar RPCs
      const completedRpcCalls = processLogLine(rawLogLine)
      for (const rpcCall of completedRpcCalls) {
        broadcast('mtga:rpc-call', rpcCall)

        // Interpretar RPC
        const interpreted = interpretRpc(rpcCall)
        if (interpreted) {
          broadcast('mtga:interpreted-event', interpreted)
        }
      }

      // Manter compatibilidade com parser antigo
      const event = parseLogLine(line)
      if (event) {
        broadcast(IPC_CHANNELS.event, event)
      }
    },
    onError: (error) => {
      sendStatus({
        level: 'error',
        message: 'Não foi possível ler o log do MTGA',
        detail: error.message,
      })
    },
    onStatus: (status) => {
      sendStatus(status)
    },
  })

  // Iniciar o gerenciador (vai buscar o log mais recente e monitorar continuamente)
  logWatcherManager.start()
}

const createWindow = async () => {
  // Verificar se o arquivo preload existe
  const preloadExists = fs.existsSync(preload)
  console.log('[main] Preload path:', preload)
  console.log('[main] Preload exists:', preloadExists)
  
  win = new BrowserWindow({
    title: 'MTGA Assistant',
    width: 1280,
    height: 840,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Verificar erros ao carregar o preload
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] Failed to load:', errorCode, errorDescription, validatedURL)
  })

  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('[main] Preload error:', preloadPath, error)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow().then(() => startLogWatcherManager())
})

app.on('window-all-closed', () => {
  logWatcherManager?.stop()
  logWatcherManager = null
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().then(() => startLogWatcherManager())
  }
})

ipcMain.handle(IPC_CHANNELS.getLogPath, () => {
  return logWatcherManager?.getCurrentLogPath() || ''
})

ipcMain.handle(IPC_CHANNELS.snapshot, (_event, snapshot) => {
  console.info('[snapshot]', snapshot)
  return { receivedAt: Date.now() }
})

// Handler para buscar logs do MTGA
ipcMain.handle('mtga:search-logs', async (_event, searchTerms: string[] = []) => {
  try {
    const results = await findMTGALogs(searchTerms)
    return results
  } catch (error) {
    console.error('[main] Error searching logs:', error)
    return []
  }
})

// Handler para selecionar arquivo de log manualmente
ipcMain.handle('mtga:select-log-file', async () => {
  if (!win) return null

  const result = await dialog.showOpenDialog(win, {
    title: 'Selecionar arquivo de log do MTGA',
    filters: [
      { name: 'Arquivos de texto', extensions: ['txt', 'log'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// Handler para mudar o caminho do log
ipcMain.handle('mtga:set-log-path', async (_event, logPath: string) => {
  try {
    if (!fs.existsSync(logPath)) {
      throw new Error('Arquivo não encontrado')
    }

    // Reiniciar o gerenciador vai fazer ele encontrar o arquivo automaticamente
    // Mas podemos forçar uma verificação imediata
    startLogWatcherManager()
    return { success: true, path: logPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
})
