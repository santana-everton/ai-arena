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
  CardDrawnAction,
  CardPlayedAction,
  CardAttackedAction,
  CardBlockedAction,
  GameEndedAction,
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

type GreAction = {
  seatId?: number
  action?: {
    actionType?: string
    instanceId?: number
    manaCost?: Array<{ color: string[]; count: number }>
  }
}

type GreGameInfo = {
  stage?: string
  matchState?: string
  results?: Array<{
    scope?: string
    result?: string
    winningTeamId?: number
    reason?: string
  }>
}

type GrePlayer = {
  systemSeatNumber?: number
  status?: string
  teamId?: number
  lifeTotal?: number
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
  actions?: GreAction[]
  gameInfo?: GreGameInfo
  players?: GrePlayer[]
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
  color?: string[]
  superTypes?: string[]
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
  private lastHandSize = new Map<number, number>()
  private lastHandCards = new Map<number, Set<number>>()
  private lastBattlefieldCards = new Map<number, Set<number>>()
  private lastTappedState = new Map<number, boolean>()
  private lastDeclareAttackStep = false

  reset(): void {
    this.currentMatchId = undefined
    this.localSeatId = undefined
    this.opponentSeatId = undefined
    this.lastTurnInfo = undefined
    this.hasEmittedDeckState = false
    this.hasEmittedOpeningHand = false
    this.lastHandSize.clear()
    this.lastHandCards.clear()
    this.lastBattlefieldCards.clear()
    this.lastTappedState.clear()
    this.lastDeclareAttackStep = false
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
              // Rastrear as cartas da mão inicial para evitar detectá-las como compradas
              if (handAction.cards && this.localSeatId) {
                const initialHand = new Set(handAction.cards.map((c) => c.instanceId))
                this.lastHandCards.set(this.localSeatId, initialHand)
                this.lastHandSize.set(this.localSeatId, initialHand.size)
              }
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

        // Detectar compras de cartas (Library -> Hand)
        const drawActions = this.detectCardDraws(state, objectById, zoneById, timestamp)
        actions.push(...drawActions)

        // Detectar cartas jogadas (Hand -> Battlefield/Stack)
        const playActions = this.detectCardPlays(state, objectById, zoneById, timestamp)
        actions.push(...playActions)

        // Detectar ataques
        const attackActions = this.detectAttacks(state, objectById, zoneById, timestamp)
        actions.push(...attackActions)

        // Detectar bloqueios
        const blockActions = this.detectBlocks(state, objectById, zoneById, timestamp)
        actions.push(...blockActions)

        // Detectar fim de jogo
        const gameEnded = this.detectGameEnd(state, timestamp)
        if (gameEnded) {
          actions.push(gameEnded)
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
          // Atualizar estado tapped para detecção de ataques
          if (tapped.instanceId != null) {
            this.lastTappedState.set(tapped.instanceId, tapped.isTapped)
          }
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
      name: obj.name,
      cardTypes: obj.cardTypes,
      subtypes: obj.subtypes,
      color: obj.color,
    }
  }

  private detectCardDraws(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): CardDrawnAction[] {
    const actions: CardDrawnAction[] = []

    for (const zone of state.zones ?? []) {
      if (zone.type !== 'ZoneType_Hand' || !zone.ownerSeatId || !zone.objectInstanceIds) {
        continue
      }

      const currentHand = new Set(zone.objectInstanceIds)
      const lastHand = this.lastHandCards.get(zone.ownerSeatId) ?? new Set<number>()

      // Encontrar cartas novas na mão (estão na mão atual mas não estavam antes)
      for (const instanceId of currentHand) {
        if (!lastHand.has(instanceId)) {
          const obj = objectById.get(instanceId)
          if (!obj) continue

          // Verificar se veio da biblioteca através de ZoneTransfer
          // Por enquanto, assumimos que qualquer carta nova na mão foi comprada
          // (pode ser melhorado verificando annotations de ZoneTransfer)
          actions.push({
            kind: 'card_drawn',
            timestamp,
            seatId: zone.ownerSeatId,
            instanceId: obj.instanceId,
            grpId: obj.grpId,
            card: this.toCardRef(obj),
          })
        }
      }

      // Atualizar estado da mão
      this.lastHandCards.set(zone.ownerSeatId, currentHand)
      this.lastHandSize.set(zone.ownerSeatId, currentHand.size)
    }

    return actions
  }

  private detectCardPlays(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): CardPlayedAction[] {
    const actions: CardPlayedAction[] = []

    // Verificar annotations de ZoneTransfer para detectar cartas saindo da mão
    for (const ann of state.annotations ?? []) {
      if (!ann.type?.includes('AnnotationType_ZoneTransfer')) continue

      const instanceId = ann.affectedIds?.[0]
      if (instanceId == null) continue

      const obj = objectById.get(instanceId)
      if (!obj) continue

      const details = this.detailsAsMap(ann.details)
      const fromZoneId = details.get('zone_src')
      const toZoneId = details.get('zone_dest')

      const fromZone = typeof fromZoneId === 'number' ? zoneById.get(fromZoneId) : undefined
      const toZone = typeof toZoneId === 'number' ? zoneById.get(toZoneId) : undefined

      // Se saiu da mão e foi para o campo de batalha ou stack
      if (
        fromZone?.type === 'ZoneType_Hand' &&
        (toZone?.type === 'ZoneType_Battlefield' || toZone?.type === 'ZoneType_Stack')
      ) {
        // Determinar se foi cast ou play baseado na categoria da annotation
        const category = typeof details.get('category') === 'string' ? details.get('category') : undefined
        const isPlay = category === 'PlayLand' || toZone?.type === 'ZoneType_Battlefield'
        const isCast = category === 'CastSpell' || toZone?.type === 'ZoneType_Stack'

        // Verificar se há uma action correspondente para obter manaCost
        const actionInfo = this.getActionInfo(state, instanceId, obj)

        actions.push({
          kind: 'card_played',
          timestamp,
          seatId: obj.controllerSeatId ?? obj.ownerSeatId,
          instanceId: obj.instanceId,
          grpId: obj.grpId,
          actionType: isCast ? 'cast' : isPlay ? 'play' : actionInfo.type,
          manaCost: actionInfo.manaCost,
          card: this.toCardRef(obj),
        })
      }
    }

    return actions
  }

  private getActionInfo(
    state: GreGameStateMessage,
    instanceId: number,
    obj: GreGameObject,
  ): { type: 'cast' | 'play'; manaCost?: Array<{ color: string[]; count: number }> } {
    // Verificar se é uma land (geralmente jogada, não conjurada)
    const isLand = obj.cardTypes?.includes('CardType_Land') ?? false

    // Procurar pela action correspondente no gameStateMessage
    if (state.actions) {
      for (const actionEntry of state.actions) {
        const action = actionEntry.action
        if (!action || action.instanceId !== instanceId) continue

        if (action.actionType === 'ActionType_Play') {
          return { type: 'play' }
        }

        if (action.actionType === 'ActionType_Cast' && action.manaCost) {
          return {
            type: 'cast',
            manaCost: action.manaCost.map((mc) => ({
              color: mc.color || [],
              count: mc.count || 0,
            })),
          }
        }
      }
    }

    // Fallback: usar heurística baseada no tipo da carta
    if (isLand) {
      return { type: 'play' }
    }

    return { type: 'cast' }
  }

  private detectAttacks(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): CardAttackedAction[] {
    const actions: CardAttackedAction[] = []
    const isDeclareAttackStep = state.turnInfo?.step === 'Step_DeclareAttack'

    // Detectar ataques: quando entramos no Step_DeclareAttack, permanentes que foram virados
    // (tapped) provavelmente estão atacando
    if (isDeclareAttackStep && !this.lastDeclareAttackStep) {
      // Primeira vez entrando no Step_DeclareAttack neste turno
      // Verificar quais permanentes foram virados recentemente
      for (const obj of state.gameObjects ?? []) {
        if (!obj.instanceId || obj.zoneId === undefined) continue

        const zone = zoneById.get(obj.zoneId)
        if (zone?.type !== 'ZoneType_Battlefield') continue

        const wasTapped = this.lastTappedState.get(obj.instanceId) ?? false
        const isNowTapped = obj.isTapped ?? false

        // Se foi virado (não estava tapped, agora está), provavelmente está atacando
        if (!wasTapped && isNowTapped) {
          actions.push({
            kind: 'card_attacked',
            timestamp,
            seatId: obj.controllerSeatId ?? obj.ownerSeatId,
            instanceId: obj.instanceId,
            grpId: obj.grpId,
            card: this.toCardRef(obj),
          })
        }

        // Atualizar estado tapped
        this.lastTappedState.set(obj.instanceId, isNowTapped)
      }
    } else if (isDeclareAttackStep) {
      // Continuando no Step_DeclareAttack - atualizar estados tapped
      for (const obj of state.gameObjects ?? []) {
        if (!obj.instanceId) continue
        this.lastTappedState.set(obj.instanceId, obj.isTapped ?? false)
      }
    }

    // Atualizar estado do battlefield
    const battlefieldBySeat = new Map<number, Set<number>>()
    for (const zone of state.zones ?? []) {
      if (zone.type === 'ZoneType_Battlefield' && zone.objectInstanceIds && zone.ownerSeatId) {
        const seatCards = new Set(zone.objectInstanceIds)
        battlefieldBySeat.set(zone.ownerSeatId, seatCards)
      }
    }
    for (const [seatId, cards] of battlefieldBySeat) {
      this.lastBattlefieldCards.set(seatId, cards)
    }

    this.lastDeclareAttackStep = isDeclareAttackStep

    return actions
  }

  private detectBlocks(
    state: GreGameStateMessage,
    objectById: Map<number, GreGameObject>,
    zoneById: Map<number, GreZone>,
    timestamp: number,
  ): CardBlockedAction[] {
    const actions: CardBlockedAction[] = []

    // Detectar bloqueios durante Step_DeclareBlock
    if (state.turnInfo?.step !== 'Step_DeclareBlock') {
      return actions
    }

    // Por enquanto, vamos usar uma heurística simples:
    // Se estamos no Step_DeclareBlock e há permanentes no campo de batalha,
    // podemos inferir bloqueios através de annotations ou mudanças de estado
    // Isso pode ser melhorado analisando annotations específicas de bloqueio

    // TODO: Implementar detecção mais precisa de bloqueios quando tivermos
    // mais exemplos do log mostrando como bloqueios aparecem

    return actions
  }

  private detectGameEnd(
    state: GreGameStateMessage,
    timestamp: number,
  ): GameEndedAction | null {
    const gameInfo = state.gameInfo
    if (!gameInfo) return null

    // Verificar se o jogo terminou
    const isGameOver =
      gameInfo.stage === 'GameStage_GameOver' ||
      gameInfo.matchState === 'MatchState_GameComplete' ||
      gameInfo.matchState === 'MatchState_MatchComplete'

    if (!isGameOver) return null

    // Encontrar o time vencedor e o motivo
    let winningTeamId: number | undefined
    let reason: string | undefined

    if (gameInfo.results && gameInfo.results.length > 0) {
      // Procurar resultado do match primeiro, depois do game
      const matchResult = gameInfo.results.find((r) => r.scope === 'MatchScope_Match')
      const gameResult = gameInfo.results.find((r) => r.scope === 'MatchScope_Game')

      const result = matchResult || gameResult
      if (result) {
        winningTeamId = result.winningTeamId
        reason = result.reason
      }
    }

    // Encontrar os seatIds do vencedor e perdedor
    let winningSeatId: number | undefined
    let losingSeatId: number | undefined

    if (state.players && winningTeamId != null) {
      for (const player of state.players) {
        if (player.teamId === winningTeamId) {
          winningSeatId = player.systemSeatNumber
        } else if (
          player.status === 'PlayerStatus_PendingLoss' ||
          player.status === 'PlayerStatus_Lost'
        ) {
          losingSeatId = player.systemSeatNumber
        }
      }
    }

    return {
      kind: 'game_ended',
      timestamp,
      winningTeamId,
      winningSeatId,
      losingSeatId,
      reason,
      matchState: gameInfo.matchState,
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

