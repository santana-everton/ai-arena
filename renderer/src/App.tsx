import { useCallback, useState, useEffect } from 'react'
import Header from './components/Header'
import LogRawView from './components/LogRawView'
import EventsView from './components/EventsView'
import RpcView from './components/RpcView'
import LogFinder from './components/LogFinder'
import { useLogsStore } from './state/useLogsStore'
import type { RpcCall, InterpretedEvent } from './types/global'

export default function App() {
  const { rawLines, events, status, logPath, sendSnapshot } = useLogsStore()
  const [sendingSnapshot, setSendingSnapshot] = useState(false)
  const [showLogFinder, setShowLogFinder] = useState(false)
  const [rpcCalls, setRpcCalls] = useState<RpcCall[]>([])
  const [interpretedEvents, setInterpretedEvents] = useState<InterpretedEvent[]>([])
  const [activeTab, setActiveTab] = useState<'events' | 'rpc'>('rpc')

  const handleSnapshot = useCallback(async () => {
    setSendingSnapshot(true)
    try {
      await sendSnapshot()
    } finally {
      setSendingSnapshot(false)
    }
  }, [sendSnapshot])

  const handleSelectLog = useCallback(async (logPath: string) => {
    if (!window.mtga) return

    try {
      const result = await window.mtga.setLogPath(logPath)
      if (!result.success) {
        console.error('Failed to set log path:', result.error)
      }
    } catch (error) {
      console.error('Error setting log path:', error)
    }
  }, [])

  // Mostrar o LogFinder se houver erro ou se o usuário clicar
  const shouldShowFinder = showLogFinder || (status?.level === 'error' && !logPath)

  // Escutar RPCs
  useEffect(() => {
    const bridge = window.mtga
    if (!bridge) return

    const disposeRpc = bridge.onRpcCall((rpcCall) => {
      setRpcCalls((prev) => [...prev.slice(-999), rpcCall]) // Manter últimas 1000
    })

    const disposeInterpreted = bridge.onInterpretedEvent((event) => {
      setInterpretedEvents((prev) => [...prev.slice(-199), event]) // Manter últimos 200
    })

    return () => {
      disposeRpc?.()
      disposeInterpreted?.()
    }
  }, [])

  return (
    <div className="app-shell">
      <Header
        status={status}
        logPath={logPath}
        onSnapshot={handleSnapshot}
        snapshotBusy={sendingSnapshot}
        onFindLog={() => setShowLogFinder(true)}
      />

      {shouldShowFinder && (
        <LogFinder
          onSelect={handleSelectLog}
          onClose={() => setShowLogFinder(false)}
        />
      )}

      <div className="panes">
        <section className="pane">
          <h2>Log bruto</h2>
          <LogRawView lines={rawLines} />
        </section>

        <section className="pane">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <button
              onClick={() => setActiveTab('rpc')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'rpc' ? 'rgba(90, 94, 245, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fdfdfd',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'rpc' ? 'bold' : 'normal',
              }}
            >
              RPC Calls ({rpcCalls.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'events' ? 'rgba(90, 94, 245, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fdfdfd',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'events' ? 'bold' : 'normal',
              }}
            >
              Eventos ({events.length})
            </button>
          </div>

          <div className="pane-content" style={{ flex: 1, minHeight: 0 }}>
            {activeTab === 'rpc' ? (
              <RpcView rpcCalls={rpcCalls} />
            ) : (
              <EventsView events={events} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

