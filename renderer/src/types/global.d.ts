import type { LogStatus, MtgaEvent, MtgaSnapshot } from './mtga'

type ListenerDisposer = () => void

export type LogSearchResult = {
  path: string
  size: number
  lastModified: Date
  confidence: number
  matches: string[]
}

export type RpcCall = {
  name: string
  id: string
  direction: 'request' | 'response'
  tick: number
  timestamp?: Date
  requestPayload?: any
  responsePayload?: any
  rawRequestLine?: string
  rawResponseLine?: string
}

export type InterpretedEvent = {
  type: string
  timestamp: Date
  data: any
  rpcCall?: RpcCall
}

export type GameAction = {
  kind: string
  timestamp: number
  // Campos adicionais dependem do tipo de ação.
  // O parser no processo principal do Electron preenche esses dados.
  // Mantemos como any para flexibilidade neste esboço.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type MtgaBridge = {
  onLogLine: (callback: (line: string) => void) => ListenerDisposer
  onEvent: (callback: (event: MtgaEvent | null) => void) => ListenerDisposer
  onStatus: (callback: (status: LogStatus) => void) => ListenerDisposer
  onRpcCall: (callback: (rpcCall: RpcCall) => void) => ListenerDisposer
  onInterpretedEvent: (callback: (event: InterpretedEvent) => void) => ListenerDisposer
  onGameAction: (callback: (action: GameAction) => void) => ListenerDisposer
  getLogPath: () => Promise<string>
  sendSnapshot: (snapshot: MtgaSnapshot) => Promise<{ receivedAt: number }>
  searchLogs: (searchTerms?: string[]) => Promise<LogSearchResult[]>
  selectLogFile: () => Promise<string | null>
  setLogPath: (logPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
}

declare global {
  interface Window {
    mtga?: MtgaBridge
  }
}

export {}

