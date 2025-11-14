import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import type { LogStatus } from '../renderer/src/types/mtga'

export const DEFAULT_MTGA_LOG_RELATIVE = [
  'AppData',
  'LocalLow',
  'Wizards Of The Coast',
  'MTGA',
]

const DEFAULT_LOG_FILENAMES = ['Player.log', 'output_log.txt']

// Caminho do Steam MTGA
const STEAM_MTGA_LOGS_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Logs\\Logs'

/**
 * Busca o arquivo de log mais recente no diretório do Steam
 */
export function getLatestSteamLog(): string | null {
  try {
    if (!fs.existsSync(STEAM_MTGA_LOGS_DIR)) {
      return null
    }

    const files = fs.readdirSync(STEAM_MTGA_LOGS_DIR)
    const logFiles = files
      .filter((file) => file.toLowerCase().endsWith('.log'))
      .map((file) => ({
        name: file,
        path: path.join(STEAM_MTGA_LOGS_DIR, file),
        mtime: fs.statSync(path.join(STEAM_MTGA_LOGS_DIR, file)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    return logFiles.length > 0 ? logFiles[0].path : null
  } catch {
    return null
  }
}

export const MTGA_LOG_CANDIDATES = [
  // Logs do Steam (mais recente primeiro)
  ...(() => {
    const steamLog = getLatestSteamLog()
    return steamLog ? [steamLog] : []
  })(),
  // Logs padrão do usuário
  ...DEFAULT_LOG_FILENAMES.map((fileName) =>
    path.join(os.homedir(), ...DEFAULT_MTGA_LOG_RELATIVE, fileName)
  ),
]

export const MTGA_LOG_PATH = MTGA_LOG_CANDIDATES[0]

export const IPC_CHANNELS = {
  logLine: 'mtga:log-line',
  event: 'mtga:event',
  status: 'mtga:status',
  snapshot: 'mtga:send-snapshot',
  getLogPath: 'mtga:get-log-path',
} as const

export type StatusPayload = LogStatus

