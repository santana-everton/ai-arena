import SnapshotButton from './SnapshotButton'
import type { LogStatus } from '../types/mtga'

type HeaderProps = {
  status?: LogStatus
  logPath?: string | null
  onSnapshot: () => Promise<void>
  snapshotBusy: boolean
  onFindLog?: () => void
}

const statusLabel: Record<LogStatus['level'], string> = {
  info: 'Observando',
  warning: 'Atenção',
  error: 'Erro',
}

export default function Header({ status, logPath, onSnapshot, snapshotBusy, onFindLog }: HeaderProps) {
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
              {status.message.includes('Buscando') || status.message.includes('processando') ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className="spinner"
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#9ad1ff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  {statusLabel[status.level]}
                </span>
              ) : (
                statusLabel[status.level]
              )}
            </span>
            <small style={{ opacity: 0.8 }}>{status.message}</small>
          </>
        ) : (
          <span className="status-pill info">Inicializando</span>
        )}
        {status?.detail && (
          <small style={{ maxWidth: 320, opacity: 0.7 }}>{status.detail}</small>
        )}
        {onFindLog && (
          <button
            onClick={onFindLog}
            style={{
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fdfdfd',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Buscar Log
          </button>
        )}
        <SnapshotButton onSnapshot={onSnapshot} disabled={snapshotBusy} />
      </div>
    </header>
  )
}

