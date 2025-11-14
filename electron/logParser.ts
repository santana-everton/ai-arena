import type { RawLogLine } from './types/log'

/**
 * Regex para parsear linhas do log MTGA
 * Formato: [tick] [source] message
 * Exemplo: [1715] [UnityCrossThreadLogger]==> QuestGetQuests {"id":"..."}
 */
const LOG_LINE_REGEX = /^\[(\d+)\]\s*(?:\[([^\]]+)\])?\s*(.*)$/

/**
 * Regex para detectar nível de log (INFO, ERROR, etc.)
 */
const LEVEL_REGEX = /\b(INFO|ERROR|WARNING|DEBUG)\b/i

/**
 * Parseia uma linha bruta do log em um objeto estruturado
 */
export function parseRawLine(line: string, index: number): RawLogLine {
  const raw = line.trim()
  if (!raw) {
    return {
      raw,
      index,
      message: '',
    }
  }

  const match = raw.match(LOG_LINE_REGEX)
  if (!match) {
    return {
      raw,
      index,
      message: raw,
    }
  }

  const [, tickStr, source, message] = match
  const tick = tickStr ? parseInt(tickStr, 10) : undefined

  // Tentar extrair nível de log
  const levelMatch = message.match(LEVEL_REGEX)
  const level = levelMatch ? levelMatch[1].toUpperCase() : undefined

  return {
    raw,
    index,
    tick,
    source: source?.trim(),
    level,
    message: message.trim(),
  }
}

