import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Settings
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  // Dialog
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),

  // Database - Courses
  getCourses: (): Promise<unknown[]> => ipcRenderer.invoke('db:getCourses'),
  getCourse: (id: number): Promise<unknown> => ipcRenderer.invoke('db:getCourse', id),

  // Database - Assignments
  getAssignments: (courseId?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('db:getAssignments', courseId),

  // Canvas Sync
  syncNow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('canvas:syncNow'),
  getLastSync: (): Promise<string | null> => ipcRenderer.invoke('canvas:getLastSync'),

  // Notes
  getNotes: (courseId: number): Promise<unknown[]> => ipcRenderer.invoke('notes:getAll', courseId),
  getNote: (filePath: string): Promise<string> => ipcRenderer.invoke('notes:read', filePath),
  saveNote: (
    courseId: number,
    title: string,
    content: string,
    date: string
  ): Promise<{ success: boolean; path: string }> =>
    ipcRenderer.invoke('notes:save', courseId, title, content, date),
  revealNote: (filePath: string): Promise<void> => ipcRenderer.invoke('notes:reveal', filePath),

  // AI Processing
  checkOllama: (): Promise<{ available: boolean; models: string[] }> =>
    ipcRenderer.invoke('ai:checkOllama'),
  processLecture: (
    transcript: string,
    courseId: number,
    title: string,
    date: string
  ): Promise<{
    success: boolean
    notes?: string
    path?: string
    error?: string
  }> => ipcRenderer.invoke('ai:processLecture', transcript, courseId, title, date),

  // Events
  onSyncProgress: (callback: (event: unknown, data: unknown) => void): void => {
    ipcRenderer.on('canvas:syncProgress', callback)
  },
  offSyncProgress: (): void => {
    ipcRenderer.removeAllListeners('canvas:syncProgress')
  },
  onAiProgress: (callback: (event: unknown, data: unknown) => void): void => {
    ipcRenderer.on('ai:progress', callback)
  },
  offAiProgress: (): void => {
    ipcRenderer.removeAllListeners('ai:progress')
  },

  // Resources (File Vault)
  listResources: (courseId: number): Promise<unknown> =>
    ipcRenderer.invoke('resources:list', courseId),
  downloadResources: (courseId: number, resources: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('resources:download', courseId, resources),
  onResourceProgress: (callback: (event: unknown, data: unknown) => void): void => {
    ipcRenderer.on('resources:progress', callback)
  },
  offResourceProgress: (): void => {
    ipcRenderer.removeAllListeners('resources:progress')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
