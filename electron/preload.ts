import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { MtgaEvent, MtgaSnapshot, LogStatus } from '../renderer/src/types/mtga'

// Constantes IPC - definidas aqui para evitar importar config.ts que tem dependências node:
const IPC_CHANNELS = {
  logLine: 'mtga:log-line',
  event: 'mtga:event',
  status: 'mtga:status',
  snapshot: 'mtga:send-snapshot',
  getLogPath: 'mtga:get-log-path',
} as const

const createListener =
  <Payload,>(channel: string, callback: (payload: Payload) => void) => {
    const handler = (_event: IpcRendererEvent, payload: Payload) => callback(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }

const mtgaBridge = {
  onLogLine(callback: (line: string) => void) {
    return createListener<string>(IPC_CHANNELS.logLine, callback)
  },
  onEvent(callback: (event: MtgaEvent | null) => void) {
    return createListener<MtgaEvent | null>(IPC_CHANNELS.event, callback)
  },
  onStatus(callback: (status: LogStatus) => void) {
    return createListener<LogStatus>(IPC_CHANNELS.status, callback)
  },
  onRpcCall(callback: (rpcCall: any) => void) {
    return createListener<any>('mtga:rpc-call', callback)
  },
  onInterpretedEvent(callback: (event: any) => void) {
    return createListener<any>('mtga:interpreted-event', callback)
  },
  getLogPath() {
    return ipcRenderer.invoke(IPC_CHANNELS.getLogPath) as Promise<string>
  },
  sendSnapshot(snapshot: MtgaSnapshot) {
    return ipcRenderer.invoke(IPC_CHANNELS.snapshot, snapshot) as Promise<{
      receivedAt: number
    }>
  },
  searchLogs(searchTerms: string[] = []) {
    return ipcRenderer.invoke('mtga:search-logs', searchTerms) as Promise<
      Array<{
        path: string
        size: number
        lastModified: Date
        confidence: number
        matches: string[]
      }>
    >
  },
  selectLogFile() {
    return ipcRenderer.invoke('mtga:select-log-file') as Promise<string | null>
  },
  setLogPath(logPath: string) {
    return ipcRenderer.invoke('mtga:set-log-path', logPath) as Promise<{
      success: boolean
      path?: string
      error?: string
    }>
  },
}

contextBridge.exposeInMainWorld('mtga', mtgaBridge)