import { useState } from 'react'

type SnapshotButtonProps = {
  onSnapshot: () => Promise<void>
  disabled?: boolean
}

export default function SnapshotButton({ onSnapshot, disabled }: SnapshotButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleClick = async () => {
    if (disabled) return
    setFeedback(null)
    try {
      await onSnapshot()
      setFeedback('Snapshot enviado!')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao enviar snapshot')
    } finally {
      setTimeout(() => setFeedback(null), 2500)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button className="snapshot-button" onClick={handleClick} disabled={disabled}>
        Enviar estado para IA
      </button>
      {feedback && <small style={{ opacity: 0.7 }}>{feedback}</small>}
    </div>
  )
}

