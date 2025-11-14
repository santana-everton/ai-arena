import { useState, useMemo } from 'react'
import type { RpcCall } from '../types/global'

type RpcViewProps = {
  rpcCalls: RpcCall[]
}

export default function RpcView({ rpcCalls }: RpcViewProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('all')
  const [selectedRpc, setSelectedRpc] = useState<RpcCall | null>(null)

  // Extrair métodos únicos
  const methods = useMemo(() => {
    const unique = new Set(rpcCalls.map((rpc) => rpc.name))
    return Array.from(unique).sort()
  }, [rpcCalls])

  // Filtrar RPCs
  const filteredRpcCalls = useMemo(() => {
    if (selectedMethod === 'all') return rpcCalls
    return rpcCalls.filter((rpc) => rpc.name === selectedMethod)
  }, [rpcCalls, selectedMethod])

  const formatJson = (obj: any): string => {
    if (!obj) return ''
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Filtrar por método:</label>
        <select
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fdfdfd',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          <option value="all">Todos ({rpcCalls.length})</option>
          {methods.map((method) => {
            const count = rpcCalls.filter((rpc) => rpc.name === method).length
            return (
              <option key={method} value={method}>
                {method} ({count})
              </option>
            )
          })}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        {/* Lista de RPCs */}
        <div
          style={{
            flex: '0 0 300px',
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
            {filteredRpcCalls.length} chamada(s)
          </div>
          {filteredRpcCalls.map((rpc, index) => (
            <div
              key={`${rpc.id}-${index}`}
              onClick={() => setSelectedRpc(rpc)}
              style={{
                padding: '8px',
                marginBottom: '4px',
                borderRadius: '6px',
                background:
                  selectedRpc?.id === rpc.id
                    ? 'rgba(90, 94, 245, 0.3)'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  selectedRpc?.id === rpc.id
                    ? '1px solid rgba(90, 94, 245, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedRpc?.id !== rpc.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedRpc?.id !== rpc.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                {rpc.name}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                {rpc.id.substring(0, 8)}...
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }}>
                Tick: {rpc.tick} • {rpc.direction}
              </div>
            </div>
          ))}
        </div>

        {/* Detalhes da RPC selecionada */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          {selectedRpc ? (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>{selectedRpc.name}</h3>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
                  Informações
                </div>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                >
                  <div>ID: {selectedRpc.id}</div>
                  <div>Direction: {selectedRpc.direction}</div>
                  <div>Tick: {selectedRpc.tick}</div>
                  {selectedRpc.timestamp && (
                    <div>Timestamp: {selectedRpc.timestamp.toISOString()}</div>
                  )}
                </div>
              </div>

              {selectedRpc.requestPayload && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
                    Request Payload
                  </div>
                  <pre
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {formatJson(selectedRpc.requestPayload)}
                  </pre>
                </div>
              )}

              {selectedRpc.responsePayload && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
                    Response Payload
                  </div>
                  <pre
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {formatJson(selectedRpc.responsePayload)}
                  </pre>
                </div>
              )}

              {selectedRpc.rawRequestLine && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
                    Raw Request
                  </div>
                  <pre
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      opacity: 0.8,
                    }}
                  >
                    {selectedRpc.rawRequestLine}
                  </pre>
                </div>
              )}

              {selectedRpc.rawResponseLine && (
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>
                    Raw Response
                  </div>
                  <pre
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      opacity: 0.8,
                    }}
                  >
                    {selectedRpc.rawResponseLine}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div style={{ opacity: 0.5, textAlign: 'center', padding: '40px' }}>
              Selecione uma RPC para ver os detalhes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

