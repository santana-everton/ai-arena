import SnapshotButton from './SnapshotButton'
import type { LogStatus } from '../types/mtga'

type HeaderProps = {
  status?: LogStatus
  logPath?: string | null
  onSnapshot: () => Promise<void>
  snapshotBusy: boolean
}

const statusLabel: Record<LogStatus['level'], string> = {
  info: 'Observando',
  warning: 'Atenção',
  error: 'Erro',
}

export default function Header({ status, logPath, onSnapshot, snapshotBusy }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1>MTGA Assistant</h1>
        <p className="subtitle">
          {logPath ? (
            <>
              Log atual:{' '}
              <span title={logPath}>
                {logPath}
              </span>
            </>
          ) : (
            'Procurando arquivo de log...'
          )}
        </p>
      </div>

      <div className="status-bar">
        {status ? (
          <>
            <span className={`status-pill ${status.level}`}>
              {statusLabel[status.level]}
            </span>
            <small style={{ opacity: 0.8 }}>{status.message}</small>
          </>
        ) : (
          <span className="status-pill info">Inicializando</span>
        )}
        {status?.detail && (
          <small style={{ maxWidth: 320, opacity: 0.7 }}>{status.detail}</small>
        )}
        <SnapshotButton onSnapshot={onSnapshot} disabled={snapshotBusy} />
      </div>
    </header>
  )
}

