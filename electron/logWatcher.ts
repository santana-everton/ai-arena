import fs from 'node:fs'
import { MTGA_LOG_PATH } from './config'

type LineCallback = (line: string) => void
type ErrorCallback = (error: Error) => void
type ReadyCallback = (info: { path: string }) => void

export type LogWatcherOptions = {
  filePath?: string
  onLine: LineCallback
  onError?: ErrorCallback
  onReady?: ReadyCallback
}

export type StopLogWatcher = () => void

export function startLogWatcher({
  filePath = MTGA_LOG_PATH,
  onLine,
  onError,
  onReady,
}: LogWatcherOptions): StopLogWatcher {
  let watcher: fs.FSWatcher | null = null
  let filePosition = 0

  const handleError = (error: unknown) => {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    } else {
      console.error('[logWatcher]', error)
    }
  }

  const initialize = () => {
    const stats = fs.statSync(filePath)
    filePosition = stats.size
    onReady?.({ path: filePath })
  }

  const readNewContent = () => {
    const stats = fs.statSync(filePath)

    if (stats.size < filePosition) {
      // File rotated, start over
      filePosition = 0
    }

    if (stats.size === filePosition) {
      return
    }

    const stream = fs.createReadStream(filePath, {
      start: filePosition,
      end: stats.size,
      encoding: 'utf8',
    })

    let buffer = ''

    stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim().length) {
          onLine(line)
        }
      }
    })

    stream.on('end', () => {
      filePosition = stats.size
    })

    stream.on('error', handleError)
  }

  try {
    initialize()
  } catch (error) {
    handleError(error)
    throw error instanceof Error ? error : new Error(String(error))
  }

  try {
    watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'rename') {
        // file recreated
        try {
          initialize()
        } catch (error) {
          handleError(error)
          return
        }
      }

      if (eventType === 'change') {
        try {
          readNewContent()
        } catch (error) {
          handleError(error)
        }
      }
    })
  } catch (error) {
    handleError(error)
    throw error instanceof Error ? error : new Error(String(error))
  }

  return () => {
    watcher?.close()
    watcher = null
  }
}

