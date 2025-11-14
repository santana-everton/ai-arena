export type SeatId = number
export type GrpId = number
export type InstanceId = number

export type CardRef = {
  instanceId: InstanceId
  grpId?: GrpId
  ownerSeatId?: SeatId
  controllerSeatId?: SeatId
  name?: number
  cardTypes?: string[]
  subtypes?: string[]
  color?: string[]
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

export type CardDrawnAction = {
  kind: 'card_drawn'
  timestamp: number
  seatId?: SeatId
  instanceId: InstanceId
  grpId?: GrpId
  card?: CardRef
}

export type CardPlayedAction = {
  kind: 'card_played'
  timestamp: number
  seatId?: SeatId
  instanceId: InstanceId
  grpId?: GrpId
  actionType: 'cast' | 'play'
  manaCost?: Array<{ color: string[]; count: number }>
  card?: CardRef
}

export type CardAttackedAction = {
  kind: 'card_attacked'
  timestamp: number
  seatId?: SeatId
  instanceId: InstanceId
  grpId?: GrpId
  targetSeatId?: SeatId
  targetInstanceId?: InstanceId
  card?: CardRef
}

export type CardBlockedAction = {
  kind: 'card_blocked'
  timestamp: number
  attackerSeatId?: SeatId
  attackerInstanceId: InstanceId
  attackerGrpId?: GrpId
  blockerSeatId?: SeatId
  blockerInstanceId: InstanceId
  blockerGrpId?: GrpId
  attackerCard?: CardRef
  blockerCard?: CardRef
}

export type GameEndedAction = {
  kind: 'game_ended'
  timestamp: number
  winningTeamId?: number
  winningSeatId?: SeatId
  losingSeatId?: SeatId
  reason?: string
  matchState?: string
}

export type GameAction =
  | MatchStartedAction
  | DeckStateAction
  | OpeningHandAction
  | TurnStartedAction
  | ZoneTransferAction
  | PermanentTappedAction
  | CardDrawnAction
  | CardPlayedAction
  | CardAttackedAction
  | CardBlockedAction
  | GameEndedAction

