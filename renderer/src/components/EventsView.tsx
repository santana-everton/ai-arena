import type { MtgaEvent } from '../types/mtga'

type EventsViewProps = {
  events: MtgaEvent[]
}

const eventLabel: Record<MtgaEvent['type'], string> = {
  match_created: 'Partida iniciada',
  turn_started: 'Novo turno',
  life_total_changed: 'Vida alterada',
  card_drawn: 'Carta comprada',
}

const formatTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

export default function EventsView({ events }: EventsViewProps) {
  if (!events.length) {
    return (
      <div className="pane-content" style={{ opacity: 0.6 }}>
        Nenhum evento interpretado ainda.
      </div>
    )
  }

  return (
    <div className="pane-content events-list">
      {events.map((event, idx) => (
        <article className="event-card" key={`${event.type}-${event.timestamp}-${idx}`}>
          <strong>{eventLabel[event.type]}</strong>
          <small>{formatTimestamp(event.timestamp)}</small>
          {event.type === 'turn_started' && (
            <p>
              Turno {event.turn}
              {event.activePlayer ? ` — ${event.activePlayer}` : ''}
            </p>
          )}
          {event.type === 'life_total_changed' && (
            <p>
              {event.player ?? 'Jogador'} está com {event.total} de vida
            </p>
          )}
          {event.type === 'card_drawn' && (
            <p>
              Carta identificada:{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{event.cardId ?? 'N/A'}</span>
            </p>
          )}
          {event.type === 'match_created' && <p>Encontramos o início de uma nova partida.</p>}
        </article>
      ))}
    </div>
  )
}

