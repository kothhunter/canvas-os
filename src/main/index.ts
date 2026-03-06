import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import store from './store'
import { getDB, getAllCourses, getCourse, getAssignments } from './database'
import { performSync, startBackgroundSync } from './sync'
import { getAllNotes, readNote, saveNote, revealNote } from './notes'
import { processLectureText, checkOllamaStatus } from './ai'
import { listCourseResources, downloadSelectedResources, Resource } from './resources'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerIpcHandlers(): void {
  // Settings
  ipcMain.handle('settings:get', () => ({
    canvasToken: store.get('canvasToken'),
    canvasUrl: store.get('canvasUrl'),
    vaultPath: store.get('vaultPath')
  }))

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key as keyof typeof store.store, value as string)
  })

  // Dialog
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Database - Courses
  ipcMain.handle('db:getCourses', () => getAllCourses())
  ipcMain.handle('db:getCourse', (_event, id: number) => getCourse(id))

  // Database - Assignments
  ipcMain.handle('db:getAssignments', (_event, courseId?: number) => getAssignments(courseId))

  // Canvas Sync
  ipcMain.handle('canvas:syncNow', () => performSync())
  ipcMain.handle('canvas:getLastSync', () => store.get('lastSync'))

  // Notes
  ipcMain.handle('notes:getAll', (_event, courseId: number) => getAllNotes(courseId))
  ipcMain.handle('notes:read', (_event, filePath: string) => readNote(filePath))
  ipcMain.handle(
    'notes:save',
    (_event, courseId: number, title: string, content: string, date: string) =>
      saveNote(courseId, title, content, date)
  )
  ipcMain.handle('notes:reveal', (_event, filePath: string) => revealNote(filePath))

  // AI Processing
  ipcMain.handle('ai:checkOllama', () => checkOllamaStatus())

  ipcMain.handle(
    'ai:processLecture',
    (_event, transcript: string, courseId: number, title: string, date: string) =>
      processLectureText({ transcript, courseId, title, date })
  )

  // Resources (File Vault)
  ipcMain.handle('resources:list', (_event, courseId: number) =>
    listCourseResources(courseId)
  )

  ipcMain.handle(
    'resources:download',
    (_event, courseId: number, resources: Resource[]) =>
      downloadSelectedResources(courseId, resources)
  )
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.canvas-dashboard')
  }

  // Initialize database
  getDB()

  // Register all IPC handlers
  registerIpcHandlers()

  // Start background sync (every 30 minutes)
  startBackgroundSync()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
