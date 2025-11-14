export type SeatId = number
export type GrpId = number
export type InstanceId = number

export type CardRef = {
  instanceId: InstanceId
  grpId?: GrpId
  ownerSeatId?: SeatId
  controllerSeatId?: SeatId
}

export type MatchStartedAction = {
  kind: 'match_started'
  timestamp: number
  matchId?: string
  localSeatId: SeatId
  opponentSeatId?: SeatId
}

export type DeckStateAction = {
  kind: 'deck_state'
  timestamp: number
  localSeatId: SeatId
  mainDeck: CardRef[]
  sideboard: CardRef[]
}

export type OpeningHandAction = {
  kind: 'opening_hand'
  timestamp: number
  localSeatId: SeatId
  cards: CardRef[]
}

export type TurnStartedAction = {
  kind: 'turn_started'
  timestamp: number
  turnNumber: number
  activeSeatId?: SeatId
  phase?: string
  step?: string
}

export type ZoneTransferAction = {
  kind: 'zone_transfer'
  timestamp: number
  seatId?: SeatId
  instanceId: InstanceId
  grpId?: GrpId
  fromZoneId?: number
  toZoneId?: number
  fromZoneType?: string
  toZoneType?: string
  category?: string
}

export type PermanentTappedAction = {
  kind: 'permanent_tapped'
  timestamp: number
  seatId?: SeatId
  instanceId: InstanceId
  grpId?: GrpId
  isTapped: boolean
}

export type GameAction =
  | MatchStartedAction
  | DeckStateAction
  | OpeningHandAction
  | TurnStartedAction
  | ZoneTransferAction
  | PermanentTappedAction

