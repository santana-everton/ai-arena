import type { RpcCall, InterpretedEvent } from './types/log'

/**
 * Interpreta QuestGetQuests
 */
export function interpretQuestGetQuests(call: RpcCall): InterpretedEvent | null {
  if (call.name !== 'QuestGetQuests' || !call.responsePayload) return null

  const data = call.responsePayload
  if (!data.quests || !Array.isArray(data.quests)) return null

  const quests = data.quests.map((q: any) => ({
    id: q.questId || q.id,
    description: q.locKey || q.description || '',
    progress: q.currentProgress || 0,
    goal: q.goalProgress || q.goal || 0,
    rewardGold: q.reward?.quantity ? Number(q.reward.quantity) : undefined,
    rewardType: q.reward?.type,
  }))

  return {
    type: 'quests',
    timestamp: new Date(),
    data: { quests },
    rpcCall: call,
  }
}

/**
 * Interpreta EventGetCoursesV2 (draft/eventos)
 */
export function interpretEventGetCoursesV2(call: RpcCall): InterpretedEvent | null {
  if (call.name !== 'EventGetCoursesV2' || !call.responsePayload) return null

  const data = call.responsePayload
  return {
    type: 'events',
    timestamp: new Date(),
    data: {
      courses: data.courses || [],
      events: data.events || [],
    },
    rpcCall: call,
  }
}

/**
 * Interpreta GraphGetGraphState (estado geral do jogo)
 */
export function interpretGraphGetGraphState(call: RpcCall): InterpretedEvent | null {
  if (call.name !== 'GraphGetGraphState' || !call.responsePayload) return null

  const data = call.responsePayload
  return {
    type: 'graph_state',
    timestamp: new Date(),
    data: {
      state: data,
    },
    rpcCall: call,
  }
}

/**
 * Interpreta DraftMakePick (picks de draft)
 */
export function interpretDraftMakePick(call: RpcCall): InterpretedEvent | null {
  if (call.name !== 'DraftMakePick' || !call.responsePayload) return null

  const data = call.responsePayload
  return {
    type: 'draft_pick',
    timestamp: new Date(),
    data: {
      pick: data,
    },
    rpcCall: call,
  }
}

/**
 * Interpreta DraftStatus (status do draft)
 */
export function interpretDraftStatus(call: RpcCall): InterpretedEvent | null {
  if (call.name !== 'DraftStatus' || !call.responsePayload) return null

  const data = call.responsePayload
  return {
    type: 'draft_status',
    timestamp: new Date(),
    data: {
      status: data,
    },
    rpcCall: call,
  }
}

/**
 * Router principal que interpreta RPCs baseado no nome
 */
export function interpretRpc(call: RpcCall): InterpretedEvent | null {
  switch (call.name) {
    case 'QuestGetQuests':
      return interpretQuestGetQuests(call)
    case 'EventGetCoursesV2':
      return interpretEventGetCoursesV2(call)
    case 'GraphGetGraphState':
      return interpretGraphGetGraphState(call)
    case 'DraftMakePick':
      return interpretDraftMakePick(call)
    case 'DraftStatus':
      return interpretDraftStatus(call)
    default:
      return null
  }
}

/**
 * Categoriza RPCs por tipo
 */
export function categorizeRpcName(name: string): 'gameplay' | 'draft' | 'economy' | 'ui' | 'system' {
  const gameplayRpc = ['GameState', 'Match', 'GameStart', 'GameStateMessage']
  const draftRpc = ['Draft', 'EventGetCourses', 'Event_Join']
  const economyRpc = ['Quest', 'Inventory', 'Reward', 'Economy']
  const uiRpc = ['UI', 'Screen', 'Dialog', 'Modal']

  const lowerName = name.toLowerCase()

  if (gameplayRpc.some((rpc) => lowerName.includes(rpc.toLowerCase()))) {
    return 'gameplay'
  }
  if (draftRpc.some((rpc) => lowerName.includes(rpc.toLowerCase()))) {
    return 'draft'
  }
  if (economyRpc.some((rpc) => lowerName.includes(rpc.toLowerCase()))) {
    return 'economy'
  }
  if (uiRpc.some((rpc) => lowerName.includes(rpc.toLowerCase()))) {
    return 'ui'
  }

  return 'system'
}

