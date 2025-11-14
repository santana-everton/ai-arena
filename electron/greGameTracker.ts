import type { RawLogLine } from './types/log'
import type {
  CardRef,
  GameAction,
  MatchStartedAction,
  DeckStateAction,
  OpeningHandAction,
  TurnStartedAction,
  ZoneTransferAction,
  PermanentTappedAction,
} from './types/game'

type GreToClientEnvelope = {
  transactionId?: string
  requestId?: number
  timestamp?: string
  greToClientEvent?: {
    greToClientMessages?: GreToClientMessage[]
  }
}

type GreToClientMessage = {
  type?: string
  systemSeatIds?: number[]
  msgId?: number
  gameStateId?: number
  connectResp?: unknown
  gameStateMessage?: GreGameStateMessage
}

type GreGameStateMessage = {
  type?: string
  gameStateId?: number
  turnInfo?: {
    phase?: string
    step?: string
    turnNumber?: number
    activePlayer?: number
    priorityPlayer?: number
    decisionPlayer?: number
  }
  zones?: GreZone[]
  gameObjects?: GreGameObject[]
  annotations?: GreAnnotation[]
}

type GreZone = {
  zoneId: number
  type?: string
  visibility?: string
  ownerSeatId?: number
  objectInstanceIds?: number[]
  viewers?: number[]
}

type GreGameObject = {
  instanceId: number
  grpId?: number
  type?: string
  zoneId?: number
  visibility?: string
  ownerSeatId?: number
  controllerSeatId?: number
  cardTypes?: string[]
  subtypes?: string[]
  isTapped?: boolean
  name?: number
}

type GreAnnotationDetail = {
  key: string
  type: string
  valueInt32?: number[]
  valueString?: string[]
}

type GreAnnotation = {
  id: number
  affectorId?: number
  affectedIds?: number[]
  type?: string[]
  details?: GreAnnotationDetail[]
}

type TurnInfoSnapshot = {
  turnNumber?: number
  phase?: string
  step?: string
  activePlayer?: number
}

/**
 * Rastreador de estado de partida baseado em mensagens GRE do MTGA.
 *
 * Ele recebe linhas normalizadas do log (RawLogLine) e emite GameAction de alto nível
 * que podem ser usadas pelo Electron / renderer para alimentar uma IA.
 */
export class GreGameTracker {
  private currentMatchId?: string
  private localSeatId?: number
  private opponentSeatId?: number
  private lastTurnInfo?: TurnInfoSnapshot
  private hasEmittedDeckState = false
  private hasEmittedOpeningHand = false

  reset(): void {
    this.currentMatchId = undefined
    this.localSeatId = undefined
    this.opponentSeatId = undefined
    this.lastTurnInfo = undefined
    this.hasEmittedDeckState = false
    this.hasEmittedOpeningHand = false
  }

  processRawLine(line: RawLogLine): GameAction[] {
    const text = line.message.trim()
    if (!text.startsWith('{') || !text.includes('greToClientEvent')) {
      return []
    }

    let envelope: GreToClientEnvelope
    try {
      envelope = JSON.parse(text) as GreToClientEnvelope
    } catch {
      return []
    }

    if (!envelope.greToClientEvent?.greToClientMessages?.length) {
      return []
    }

    const timestamp = this.parseTimestamp(envelope.timestamp)
    const actions: GameAction[] = []

    for (const msg of envelope.greToClientEvent.greToClientMessages) {
      if (!msg?.type) continue

      if (msg.type === 'GREMessageType_ConnectResp') {
        const matchStarted = this.handleConnectResp(envelope, msg, timestamp)
        if (matchStarted) {
          actions.push(matchStarted)
        }
        continue
      }

      if (
        msg.type === 'GREMessageType_GameStateMessage' ||
        msg.type === 'GREMessageType_QueuedGameStateMessage'
      ) {
        const state = msg.gameStateMessage
        if (!state) continue

        // Atualizar assento local / oponente assim que tivermos zonas
        if (state.zones && !this.localSeatId) {
          this.discoverSeatIdsFromZones(state.zones)
        }

        // Turnos / fases
        const maybeTurn = this.handleTurnInfo(state, timestamp)
        if (maybeTurn) {
          actions.push(maybeTurn)
        }

        // Construir mapa de objetos e zonas para outras interpretações
        const objectById = new Map<number, GreGameObject>()
        for (const obj of state.gameObjects ?? []) {
          if (obj && typeof obj.instanceId === 'number') {
            objectById.set(obj.instanceId, obj)
          }
        }

        const zoneById = new Map<number, GreZone>()
        for (const zone of state.zones ?? []) {
          if (zone && typeof zone.zoneId === 'number') {
            zoneById.set(zone.zoneId, zone)
          }
        }

        // Deck principal / sideboard / mão inicial
        if (state.zones && state.gameObjects && this.localSeatId) {
          if (!this.hasEmittedDeckState) {
            const deckAction = this.extractDeckState(state, objectById, timestamp)
            if (deckAction) {
              actions.push(deckAction)
              this.hasEmittedDeckState = true
            }
          }

          if (!this.hasEmittedOpeningHand) {
            const handAction = this.extractOpeningHand(state, objectById, timestamp)
            if (handAction) {
              actions.push(handAction)
              this.hasEmittedOpeningHand = true
            }
          }
        }

        // Transferências de zona, permanentes virando etc.
        if (state.annotations?.length) {
          const annotationActions = this.extractActionsFromAnnotations(
            state.annotations,
            objectById,
            zoneById,
            timestamp,
          )
          actions.push(...annotationActions)
        }
      }
    }

    return actions
  }

  private parseTimestamp(raw?: string): number {
    if (!raw) return Date.now()
    const asNumber = Number(raw)
    if (Number.isFinite(asNumber)) {
      return asNumber
    }
    const asDate = Date.parse(raw)
    return Number.isNaN(asDate) ? Date.now() : asDate
  }

  private handleConnectResp(
    envelope: GreToClientEnvelope,
    msg: GreToClientMessage,
    timestamp: number,
  ): MatchStartedAction | null {
    const matchId = envelope.transactionId
    const systemSeatIds = msg.systemSeatIds ?? []
    const localSeatId = systemSeatIds[0]

    this.currentMatchId = matchId
    this.localSeatId = localSeatId
    this.opponentSeatId = undefined
    this.lastTurnInfo = undefined
    this.hasEmittedDeckState = false
    this.hasEmittedOpeningHand = false

    if (localSeatId == null) {
      return null
    }

    return {
      kind: 'match_started',
      timestamp,
      matchId,
      localSeatId,
      opponentSeatId: this.opponentSeatId,
    }
  }

  private discoverSeatIdsFromZones(zones: GreZone[]): void {
    // Tentar identificar o assento local olhando a mão privada
    for (const zone of zones) {
      if (
        zone.type === 'ZoneType_Hand' &&
        zone.visibility === 'Visibility_Private' &&
        typeof zone.ownerSeatId === 'number'
      ) {
        const viewers = zone.viewers ?? []
        if (!viewers.length || viewers.includes(zone.ownerSeatId)) {
          this.localSeatId = zone.ownerSeatId
          break
        }
      }
    }

    if (!this.localSeatId) return

    // Descobrir oponente pelo ownerSeatId presente nas zonas
    const seatIds = new Set<number>()
    for (const zone of zones) {
      if (typeof zone.ownerSeatId === 'number') {
        seatIds.add(zone.ownerSeatId)
      }
    }

    for (const seatId of seatIds) {
      if (seatId !== this.localSeatId) {
        this.opponentSeatId = seatId
        break
      }
    }
  }

  private handleTurnInfo(state: GreGameStateMessage, timestamp: number): TurnStartedAction | null {
    const info = state.turnInfo
    if (!info) return null

    const { turnNumber, phase, step, activePlayer } = info
    const last = this.lastTurnInfo

    const isNewTurn =
      turnNumber != null && (last?.turnNumber == null || turnNumber !== last.turnNumber)

    const isPhaseOrStepChange =
      !isNewTurn &&
      (phase !== last?.phase ||
        step !== last?.step ||
        activePlayer !== last?.activePlayer)

    this.lastTurnInfo = {
      turnNumber,
      phase,
      step,
      activePlayer,
    }

    if (!isNewTurn && !isPhaseOrStepChange) {
      return null
    }

    return {
      kind: 'turn_started',
      timestamp,
      turnNumber: turnNumber ?? last?.turnNumber ?? 0,
      activeSeatId: activePlayer,
      phase,
      step,
    }
  }

  private extractDeckState(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    timestamp: number,
  ): DeckStateAction | null {
    if (!this.localSeatId) return null

    const mainDeckCards: CardRef[] = []
    const sideboardCards: CardRef[] = []

    for (const zone of state.zones ?? []) {
      if (zone.ownerSeatId !== this.localSeatId || !zone.objectInstanceIds?.length) {
        continue
      }

      if (zone.type === 'ZoneType_Library' || zone.type === 'ZoneType_MainDeck') {
        for (const instanceId of zone.objectInstanceIds) {
          const obj = objectById.get(instanceId)
          if (!obj) continue
          mainDeckCards.push(this.toCardRef(obj))
        }
      }

      if (zone.type === 'ZoneType_Sideboard') {
        for (const instanceId of zone.objectInstanceIds) {
          const obj = objectById.get(instanceId)
          if (!obj) continue
          sideboardCards.push(this.toCardRef(obj))
        }
      }
    }

    if (!mainDeckCards.length && !sideboardCards.length) {
      return null
    }

    return {
      kind: 'deck_state',
      timestamp,
      localSeatId: this.localSeatId,
      mainDeck: mainDeckCards,
      sideboard: sideboardCards,
    }
  }

  private extractOpeningHand(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    timestamp: number,
  ): OpeningHandAction | null {
    if (!this.localSeatId) return null

    const handZone = (state.zones ?? []).find(
      (z) =>
        z.ownerSeatId === this.localSeatId &&
        z.type === 'ZoneType_Hand' &&
        z.visibility === 'Visibility_Private',
    )

    if (!handZone?.objectInstanceIds?.length) {
      return null
    }

    const cards: CardRef[] = []
    for (const instanceId of handZone.objectInstanceIds) {
      const obj = objectById.get(instanceId)
      if (!obj) continue
      cards.push(this.toCardRef(obj))
    }

    if (!cards.length) {
      return null
    }

    return {
      kind: 'opening_hand',
      timestamp,
      localSeatId: this.localSeatId,
      cards,
    }
  }

  private extractActionsFromAnnotations(
    annotations: GreAnnotation[],
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): GameAction[] {
    const actions: GameAction[] = []

    for (const ann of annotations) {
      if (!ann.type?.length) continue

      if (ann.type.includes('AnnotationType_ZoneTransfer')) {
        const zoneTransfer = this.toZoneTransferAction(ann, objectById, zoneById, timestamp)
        if (zoneTransfer) {
          actions.push(zoneTransfer)
        }
      }

      if (ann.type.includes('AnnotationType_TappedUntappedPermanent')) {
        const tapped = this.toPermanentTappedAction(ann, objectById, timestamp)
        if (tapped) {
          actions.push(tapped)
        }
      }
    }

    return actions
  }

  private toZoneTransferAction(
    ann: GreAnnotation,
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): ZoneTransferAction | null {
    const instanceId = ann.affectedIds?.[0]
    if (instanceId == null) return null

    const obj = objectById.get(instanceId)
    const details = this.detailsAsMap(ann.details)

    const fromZoneId = details.get('zone_src')
    const toZoneId = details.get('zone_dest')
    const category = details.get('categoryString')

    const fromZone = typeof fromZoneId === 'number' ? zoneById.get(fromZoneId) : undefined
    const toZone = typeof toZoneId === 'number' ? zoneById.get(toZoneId) : undefined

    return {
      kind: 'zone_transfer',
      timestamp,
      seatId: obj?.controllerSeatId ?? obj?.ownerSeatId,
      instanceId,
      grpId: obj?.grpId,
      fromZoneId,
      toZoneId,
      fromZoneType: fromZone?.type,
      toZoneType: toZone?.type,
      category: typeof category === 'string' ? category : undefined,
    }
  }

  private toPermanentTappedAction(
    ann: GreAnnotation,
    objectById: Map<number, GreGameObject>,
    timestamp: number,
  ): PermanentTappedAction | null {
    const instanceId = ann.affectedIds?.[0]
    if (instanceId == null) return null

    const obj = objectById.get(instanceId)
    const details = this.detailsAsMap(ann.details)
    const tappedFlag = details.get('tapped')

    if (typeof tappedFlag !== 'number') {
      return null
    }

    return {
      kind: 'permanent_tapped',
      timestamp,
      seatId: obj?.controllerSeatId ?? obj?.ownerSeatId,
      instanceId,
      grpId: obj?.grpId,
      isTapped: tappedFlag === 1,
    }
  }

  private toCardRef(obj: GreGameObject): CardRef {
    return {
      instanceId: obj.instanceId,
      grpId: obj.grpId,
      ownerSeatId: obj.ownerSeatId,
      controllerSeatId: obj.controllerSeatId,
    }
  }

  private detailsAsMap(details: GreAnnotationDetail[] | undefined): Map<string, number | string> {
    const map = new Map<string, number | string>()
    if (!details) return map

    for (const detail of details) {
      if (!detail.key) continue

      if (detail.valueInt32?.length) {
        map.set(detail.key, detail.valueInt32[0])
      } else if (detail.valueString?.length) {
        map.set(detail.key === 'category' ? 'categoryString' : detail.key, detail.valueString[0])
      }
    }

    return map
  }
}

