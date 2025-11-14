import type { LogStatus, MtgaEvent, MtgaSnapshot } from './mtga'

type ListenerDisposer = () => void

export type MtgaBridge = {
  onLogLine: (callback: (line: string) => void) => ListenerDisposer
  onEvent: (callback: (event: MtgaEvent | null) => void) => ListenerDisposer
  onStatus: (callback: (status: LogStatus) => void) => ListenerDisposer
  getLogPath: () => Promise<string>
  sendSnapshot: (snapshot: MtgaSnapshot) => Promise<{ receivedAt: number }>
}

declare global {
  interface Window {
    mtga?: MtgaBridge
  }
}

export {}

