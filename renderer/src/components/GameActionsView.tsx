import type { GameAction } from '../types/global'

type GameActionsViewProps = {
  actions: GameAction[]
}

const formatTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

const getLabelForAction = (action: GameAction): string => {
  switch (action.kind) {
    case 'match_started':
      return 'Partida iniciada'
    case 'deck_state':
      return 'Deck detectado'
    case 'opening_hand':
      return 'Mão inicial'
    case 'turn_started':
      return 'Início de turno/fase'
    case 'zone_transfer':
      return 'Movimento de carta'
    case 'permanent_tapped':
      return 'Permanente virada/desvirada'
    default:
      return 'Ação de jogo'
  }
}

export default function GameActionsView({ actions }: GameActionsViewProps) {
  if (!actions.length) {
    return (
      <div className="pane-content" style={{ opacity: 0.6 }}>
        Nenhuma ação de jogo detectada ainda.
      </div>
    )
  }

  return (
    <div className="pane-content events-list">
      {actions.map((action, idx) => (
        <article className="event-card" key={`${action.kind}-${action.timestamp}-${idx}`}>
          <strong>{getLabelForAction(action)}</strong>
          <small>{formatTimestamp(action.timestamp)}</small>

          {action.kind === 'match_started' && (
            <p>
              Assento local: {action.localSeatId ?? 'desconhecido'}
              {action.opponentSeatId != null && ` — Oponente seat: ${action.opponentSeatId}`}
            </p>
          )}

          {action.kind === 'deck_state' && (
            <p>
              Deck: {action.mainDeck?.length ?? 0} cartas
              {' — '}Sideboard: {action.sideboard?.length ?? 0} cartas
            </p>
          )}

          {action.kind === 'opening_hand' && (
            <p>Mão inicial com {action.cards?.length ?? 0} cartas.</p>
          )}

          {action.kind === 'turn_started' && (
            <p>
              Turno {action.turnNumber ?? '?'}
              {action.activeSeatId != null && ` — Ativo: seat ${action.activeSeatId}`}
              {action.phase && ` — Fase: ${action.phase.replace('Phase_', '')}`}
              {action.step && ` — Etapa: ${action.step.replace('Step_', '')}`}
            </p>
          )}

          {action.kind === 'zone_transfer' && (
            <p>
              Seat {action.seatId ?? '?'}:{' '}
              {action.fromZoneType?.replace('ZoneType_', '') ?? '??'} →{' '}
              {action.toZoneType?.replace('ZoneType_', '') ?? '??'}
              {action.category && ` (${action.category})`}
            </p>
          )}

          {action.kind === 'permanent_tapped' && (
            <p>
              Seat {action.seatId ?? '?'}:{' '}
              {action.isTapped ? 'permanente virou (tapped).' : 'permanente desvirou (untapped).'}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

