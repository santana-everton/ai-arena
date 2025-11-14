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
    case 'card_drawn':
      return 'Carta comprada'
    case 'card_played':
      return 'Carta jogada'
    case 'card_attacked':
      return 'Carta atacou'
    case 'card_blocked':
      return 'Carta bloqueou'
    case 'game_ended':
      return 'Fim de jogo'
    default:
      return 'Ação de jogo'
  }
}

const formatCardInfo = (card: { grpId?: number; name?: number; cardTypes?: string[] } | undefined): string => {
  if (!card) return 'Carta desconhecida'
  const parts: string[] = []
  if (card.grpId) parts.push(`ID: ${card.grpId}`)
  if (card.name) parts.push(`Nome: ${card.name}`)
  if (card.cardTypes?.length) parts.push(`Tipo: ${card.cardTypes.join(', ').replace('CardType_', '')}`)
  return parts.length > 0 ? parts.join(' — ') : 'Carta'
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
            <div>
              <p style={{ marginBottom: '8px' }}>
                <strong>Mão inicial com {action.cards?.length ?? 0} cartas:</strong>
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9em', opacity: 0.9 }}>
                {action.cards?.map((card, cardIdx) => (
                  <li key={cardIdx} style={{ marginBottom: '4px' }}>
                    {formatCardInfo(card)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {action.kind === 'card_drawn' && (
            <p>
              Seat {action.seatId ?? '?'} comprou: {formatCardInfo(action.card)}
            </p>
          )}

          {action.kind === 'card_played' && (
            <p>
              Seat {action.seatId ?? '?'} {action.actionType === 'cast' ? 'conjurou' : 'jogou'}:{' '}
              {formatCardInfo(action.card)}
              {action.manaCost && action.manaCost.length > 0 && (
                <span style={{ opacity: 0.7, fontSize: '0.9em' }}>
                  {' '}
                  (Custo: {action.manaCost.map((m) => `${m.count}${m.color.join('')}`).join(', ')})
                </span>
              )}
            </p>
          )}

          {action.kind === 'card_attacked' && (
            <p>
              Seat {action.seatId ?? '?'} atacou com: {formatCardInfo(action.card)}
              {action.targetSeatId != null && ` → Seat ${action.targetSeatId}`}
            </p>
          )}

          {action.kind === 'card_blocked' && (
            <p>
              Seat {action.blockerSeatId ?? '?'} bloqueou{' '}
              {formatCardInfo(action.attackerCard)} com {formatCardInfo(action.blockerCard)}
            </p>
          )}

          {action.kind === 'game_ended' && (
            <div>
              <p>
                <strong>
                  {action.winningSeatId != null
                    ? `Seat ${action.winningSeatId} venceu!`
                    : action.winningTeamId != null
                      ? `Time ${action.winningTeamId} venceu!`
                      : 'Jogo terminou'}
                </strong>
              </p>
              {action.losingSeatId != null && (
                <p>Perdedor: Seat {action.losingSeatId}</p>
              )}
              {action.reason && (
                <p>
                  <small>Motivo: {action.reason}</small>
                </p>
              )}
              {action.matchState && (
                <p>
                  <small>Estado: {action.matchState}</small>
                </p>
              )}
            </div>
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

