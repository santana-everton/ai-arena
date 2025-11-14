import { useCallback, useState } from 'react'
import Header from './components/Header'
import LogRawView from './components/LogRawView'
import EventsView from './components/EventsView'
import { useLogsStore } from './state/useLogsStore'

export default function App() {
  const { rawLines, events, status, logPath, sendSnapshot } = useLogsStore()
  const [sendingSnapshot, setSendingSnapshot] = useState(false)

  const handleSnapshot = useCallback(async () => {
    setSendingSnapshot(true)
    try {
      await sendSnapshot()
    } finally {
      setSendingSnapshot(false)
    }
  }, [sendSnapshot])

  return (
    <div className="app-shell">
      <Header
        status={status}
        logPath={logPath}
        onSnapshot={handleSnapshot}
        snapshotBusy={sendingSnapshot}
      />

      <div className="panes">
        <section className="pane">
          <h2>Log bruto</h2>
          <LogRawView lines={rawLines} />
        </section>

        <section className="pane">
          <h2>Eventos interpretados</h2>
          <EventsView events={events} />
        </section>
      </div>
    </div>
  )
}

