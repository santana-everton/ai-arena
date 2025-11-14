import path from 'node:path'
import os from 'node:os'
import type { LogStatus } from '../renderer/src/types/mtga'

export const DEFAULT_MTGA_LOG_RELATIVE = [
  'AppData',
  'LocalLow',
  'Wizards Of The Coast',
  'MTGA',
  'output_log.txt',
]

export const MTGA_LOG_PATH = path.join(os.homedir(), ...DEFAULT_MTGA_LOG_RELATIVE)

export const IPC_CHANNELS = {
  logLine: 'mtga:log-line',
  event: 'mtga:event',
  status: 'mtga:status',
  snapshot: 'mtga:send-snapshot',
  getLogPath: 'mtga:get-log-path',
} as const

export type StatusPayload = LogStatus

