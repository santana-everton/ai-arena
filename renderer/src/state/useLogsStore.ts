import { useCallback, useEffect, useState } from 'react'
import type { LogStatus, MtgaEvent } from '../types/mtga'

const MAX_LINES = 500
const MAX_EVENTS = 200

export function useLogsStore() {
  const [rawLines, setRawLines] = useState<string[]>([])
  const [events, setEvents] = useState<MtgaEvent[]>([])
  const [status, setStatus] = useState<LogStatus | undefined>()
  const [logPath, setLogPath] = useState<string | null>(null)

  useEffect(() => {
    const bridge = window.mtga
    if (!bridge) {
      setStatus({
        level: 'error',
        message: 'Bridge do Electron indisponível',
        detail: 'window.mtga não foi exposto pelo preload.',
      })
      return
    }

    bridge
      .getLogPath()
      .then(setLogPath)
      .catch((error) => {
        setStatus({
          level: 'warning',
          message: 'Caminho do log indisponível',
          detail: error instanceof Error ? error.message : String(error),
        })
      })

    const disposeLog = bridge.onLogLine((line) => {
      setRawLines((prev) => [...prev.slice(-MAX_LINES + 1), line])
    })

    const disposeEvent = bridge.onEvent((event) => {
      if (!event) return
      setEvents((prev) => [...prev.slice(-MAX_EVENTS + 1), event])
    })

    const disposeStatus = bridge.onStatus((payload) => {
      setStatus(payload)
    })

    return () => {
      disposeLog?.()
      disposeEvent?.()
      disposeStatus?.()
    }
  }, [])

  const sendSnapshot = useCallback(async () => {
    if (!window.mtga) {
      throw new Error('Bridge não disponível')
    }

    await window.mtga.sendSnapshot({
      createdAt: Date.now(),
      events,
      rawLines,
    })
  }, [events, rawLines])

  return {
    rawLines,
    events,
    status,
    logPath,
    sendSnapshot,
  }
}

