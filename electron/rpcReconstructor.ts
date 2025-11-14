import type { RawLogLine, RpcCall } from './types/log'

/**
 * Estado interno para reconstruir RPCs
 */
class RpcReconstructorState {
  private rpcById = new Map<string, RpcCall>()
  private pendingResponses = new Map<string, { call: RpcCall; lineIndex: number }>()
  private completedRpcCalls: RpcCall[] = []
  private lineIndex = 0
  private lastResponseLine: { id: string; methodName: string; lineIndex: number } | null = null

  /**
   * Processa uma linha e retorna RPCs completos encontrados
   */
  processLine(line: RawLogLine): RpcCall[] {
    this.lineIndex = line.index
    const completed: RpcCall[] = []

    // Detectar request
    const request = this.detectRequest(line)
    if (request) {
      this.rpcById.set(request.id, request)
      this.pendingResponses.set(request.id, { call: request, lineIndex: line.index })
    }

    // Detectar response header
    const responseHeader = this.detectResponseHeader(line)
    if (responseHeader) {
      this.lastResponseLine = {
        id: responseHeader.id,
        methodName: responseHeader.methodName,
        lineIndex: line.index,
      }
      // Tentar parsear JSON na mesma linha
      const jsonMatch = line.message.match(/({.*})/s)
      if (jsonMatch) {
        try {
          const payload = JSON.parse(jsonMatch[1])
          const existing = this.rpcById.get(responseHeader.id)
          if (existing) {
            existing.responsePayload = payload
            existing.rawResponseLine = line.raw
            existing.direction = 'response'
            if (line.tick) existing.tick = line.tick
            existing.timestamp = new Date()

            this.completedRpcCalls.push(existing)
            completed.push(existing)
            this.rpcById.delete(responseHeader.id)
            this.pendingResponses.delete(responseHeader.id)
            this.lastResponseLine = null
          }
        } catch {
          // JSON não está completo nesta linha, esperar próxima
        }
      } else {
        // Sem JSON nesta linha, esperar próxima
      }
    } else if (this.lastResponseLine && this.lastResponseLine.lineIndex === line.index - 1) {
      // Tentar parsear JSON na linha seguinte ao response header
      try {
        const payload = JSON.parse(line.message.trim())
        const existing = this.rpcById.get(this.lastResponseLine.id)
        if (existing) {
          existing.responsePayload = payload
          existing.rawResponseLine = (existing.rawResponseLine || '') + '\n' + line.raw
          existing.direction = 'response'
          if (line.tick) existing.tick = line.tick
          existing.timestamp = new Date()

          this.completedRpcCalls.push(existing)
          completed.push(existing)
          this.rpcById.delete(this.lastResponseLine.id)
          this.pendingResponses.delete(this.lastResponseLine.id)
        }
        this.lastResponseLine = null
      } catch {
        // Não é JSON válido, resetar
        this.lastResponseLine = null
      }
    }

    return completed
  }

  /**
   * Detecta se a linha é um request RPC
   * Formato: ==> MethodName {"id":"uuid","request":"{...}"}
   */
  private detectRequest(line: RawLogLine): RpcCall | null {
    const requestMatch = line.message.match(/^==>\s*(\w+)\s+({.*})$/)
    if (!requestMatch) return null

    const [, methodName, jsonStr] = requestMatch

    try {
      const payload = JSON.parse(jsonStr)
      const id = payload.id

      if (!id || typeof id !== 'string') return null

      // Parsear o request interno (pode ser string JSON ou objeto)
      let requestPayload: any = null
      if (payload.request) {
        if (typeof payload.request === 'string') {
          try {
            requestPayload = JSON.parse(payload.request)
          } catch {
            requestPayload = payload.request
          }
        } else {
          requestPayload = payload.request
        }
      }

      return {
        name: methodName,
        id,
        direction: 'request',
        tick: line.tick || 0,
        timestamp: new Date(),
        requestPayload,
        rawRequestLine: line.raw,
      }
    } catch {
      return null
    }
  }

  /**
   * Detecta se a linha é um response RPC header
   * Formato: <== MethodName(uuid)
   */
  private detectResponseHeader(line: RawLogLine): { methodName: string; id: string } | null {
    const responseMatch = line.message.match(/^<==\s*(\w+)\(([^)]+)\)/)
    if (!responseMatch) return null

    const [, methodName, id] = responseMatch
    return { methodName, id }
  }


  /**
   * Retorna todas as RPCs completas
   */
  getAllCompleted(): RpcCall[] {
    return [...this.completedRpcCalls]
  }

  /**
   * Limpa o estado
   */
  reset(): void {
    this.rpcById.clear()
    this.pendingResponses.clear()
    this.completedRpcCalls = []
    this.lineIndex = 0
  }
}

// Instância global do reconstrutor
const reconstructor = new RpcReconstructorState()

/**
 * Processa uma linha e retorna RPCs completos
 */
export function processLogLine(line: RawLogLine): RpcCall[] {
  return reconstructor.processLine(line)
}

/**
 * Retorna todas as RPCs completas processadas até agora
 */
export function getAllRpcCalls(): RpcCall[] {
  return reconstructor.getAllCompleted()
}

/**
 * Reseta o estado do reconstrutor
 */
export function resetRpcReconstructor(): void {
  reconstructor.reset()
}

