const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:4576'
let mainWindow = null
let backendLoaded = false

// Helper: check if backend port 3090 is already alive
function checkPortAlive(port, callback) {
  const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/api/models', timeout: 1000 }, (res) => {
    callback(true)
  })
  req.on('error', () => callback(false))
  req.on('timeout', () => { req.destroy(); callback(false) })
  req.end()
}

// Ensure the local Node.js backend server runs in background
function ensureBackend() {
  if (backendLoaded) return
  checkPortAlive(3090, (alive) => {
    if (alive) {
      console.log('[Electron] Backend server already running on port 3090.')
      backendLoaded = true
      return
    }
    try {
      console.log('[Electron] Initializing embedded local backend server...')
      const serverPath = path.join(__dirname, '..', 'backend', 'server.js')
      require(serverPath)
      backendLoaded = true
    } catch (err) {
      console.warn('[Electron] Could not start embedded backend:', err.message)
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    title: 'Arther Studio',
    backgroundColor: '#0c1016',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Open links in user's default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Production: load compiled React app from frontend/dist
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
    mainWindow.loadFile(indexPath).catch(() => {
      // Fallback to dev url if dist doesn't exist yet
      mainWindow.loadURL(DEV_URL).catch(() => {})
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  ensureBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Safe IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)
