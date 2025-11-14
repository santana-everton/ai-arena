/**
 * Linha de log normalizada
 */
export type RawLogLine = {
  raw: string
  index: number
  tick?: number
  source?: string
  level?: string
  message: string
}

/**
 * Chamada RPC completa (request + response)
 */
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

/**
 * Evento interpretado de alto nível
 */
export type InterpretedEvent = {
  type: string
  timestamp: Date
  data: any
  rpcCall?: RpcCall
}

