import type { MtgaEvent } from '../renderer/src/types/mtga'

type Parser = (line: string) => MtgaEvent | null

const matchCreatedPattern = /Match created/i
const lifeTotalPattern = /Life total for (?<player>[A-Za-z0-9_ ]+)\s*:\s*(?<total>\d+)/i
const turnPattern = /Turn\s+(?<turn>\d+)\s*(?<player>[A-Za-z0-9_ ]+)?/i
const drawPattern = /DrawCard.*cardId=(?<cardId>[A-Za-z0-9_\-]+)/i

const parsers: Parser[] = [
  (line) =>
    matchCreatedPattern.test(line)
      ? {
          type: 'match_created',
          raw: line,
          timestamp: Date.now(),
        }
      : null,
  (line) => {
    const match = lifeTotalPattern.exec(line)
    if (!match?.groups) return null

    return {
      type: 'life_total_changed',
      raw: line,
      timestamp: Date.now(),
      player: match.groups.player.trim(),
      total: Number(match.groups.total),
    }
  },
  (line) => {
    const match = turnPattern.exec(line)
    if (!match?.groups) return null

    return {
      type: 'turn_started',
      raw: line,
      timestamp: Date.now(),
      turn: Number(match.groups.turn),
      activePlayer: match.groups.player?.trim() || undefined,
    }
  },
  (line) => {
    const match = drawPattern.exec(line)
    if (!match?.groups) return null

    return {
      type: 'card_drawn',
      raw: line,
      timestamp: Date.now(),
      cardId: match.groups.cardId,
    }
  },
]

export function parseLogLine(line: string): MtgaEvent | null {
  for (const parser of parsers) {
    const result = parser(line)
    if (result) {
      return result
    }
  }

  return null
}

