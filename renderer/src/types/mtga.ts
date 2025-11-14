export type MatchCreatedEvent = {
  type: 'match_created'
  raw: string
  timestamp: number
}

export type TurnStartedEvent = {
  type: 'turn_started'
  raw: string
  timestamp: number
  turn: number
  activePlayer?: string
}

export type LifeTotalChangedEvent = {
  type: 'life_total_changed'
  raw: string
  timestamp: number
  player?: string
  total: number
}

export type CardDrawnEvent = {
  type: 'card_drawn'
  raw: string
  timestamp: number
  cardId?: string
}

export type MtgaEvent =
  | MatchCreatedEvent
  | TurnStartedEvent
  | LifeTotalChangedEvent
  | CardDrawnEvent

export type LogStatus = {
  level: 'info' | 'warning' | 'error'
  message: string
  detail?: string
}

export type MtgaSnapshot = {
  createdAt: number
  events: MtgaEvent[]
  rawLines: string[]
}

