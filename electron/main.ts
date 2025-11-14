import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { startLogWatcher, type StopLogWatcher } from './logWatcher'
import { parseLogLine } from './mtgaParser'
import { IPC_CHANNELS, MTGA_LOG_PATH, type StatusPayload } from './config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let stopLogWatcher: StopLogWatcher | null = null

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

const broadcast = (channel: string, payload: unknown) => {
  if (!win) return
  win.webContents.send(channel, payload)
}

const sendStatus = (status: StatusPayload) => {
  broadcast(IPC_CHANNELS.status, status)
}

const bootLogWatcher = () => {
  stopLogWatcher?.()
  sendStatus({
    level: 'info',
    message: 'Conectando ao log do MTGA…',
  })

  try {
    stopLogWatcher = startLogWatcher({
      filePath: MTGA_LOG_PATH,
      onReady: ({ path: logPath }) => {
        sendStatus({
          level: 'info',
          message: 'Observando o log do MTGA',
          detail: logPath,
        })
      },
      onLine: (line) => {
        broadcast(IPC_CHANNELS.logLine, line)
        const event = parseLogLine(line)
        if (event) {
          broadcast(IPC_CHANNELS.event, event)
        }
      },
      onError: (error) => {
        sendStatus({
          level: 'error',
          message: 'Não foi possível ler o log do MTGA',
          detail: error.message,
        })
      },
    })
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    sendStatus({
      level: 'error',
      message: 'Falha ao iniciar o watcher do log',
      detail: normalized.message,
    })
  }
}

const createWindow = async () => {
  win = new BrowserWindow({
    title: 'MTGA Assistant',
    width: 1280,
    height: 840,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow().then(() => bootLogWatcher())
})

app.on('window-all-closed', () => {
  stopLogWatcher?.()
  stopLogWatcher = null
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().then(() => bootLogWatcher())
  }
})

ipcMain.handle(IPC_CHANNELS.getLogPath, () => MTGA_LOG_PATH)

ipcMain.handle(IPC_CHANNELS.snapshot, (_event, snapshot) => {
  console.info('[snapshot]', snapshot)
  return { receivedAt: Date.now() }
})
