import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from './config'
import type { MtgaEvent, MtgaSnapshot, LogStatus } from '../renderer/src/types/mtga'

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
  getLogPath() {
    return ipcRenderer.invoke(IPC_CHANNELS.getLogPath) as Promise<string>
  },
  sendSnapshot(snapshot: MtgaSnapshot) {
    return ipcRenderer.invoke(IPC_CHANNELS.snapshot, snapshot) as Promise<{
      receivedAt: number
    }>
  },
}

contextBridge.exposeInMainWorld('mtga', mtgaBridge)