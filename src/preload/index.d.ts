import { ElectronAPI } from '@electron-toolkit/preload'

interface CanvasAPI {
  getSettings(): Promise<Record<string, unknown>>
  setSetting(key: string, value: unknown): Promise<void>
  openDirectory(): Promise<string | null>
  getCourses(): Promise<unknown[]>
  getCourse(id: number): Promise<unknown>
  getAssignments(courseId?: number): Promise<unknown[]>
  syncNow(): Promise<{ success: boolean; error?: string }>
  getLastSync(): Promise<string | null>
  getNotes(courseId: number): Promise<unknown[]>
  getNote(filePath: string): Promise<string>
  saveNote(
    courseId: number,
    title: string,
    content: string,
    date: string
  ): Promise<{ success: boolean; path: string }>
  revealNote(filePath: string): Promise<void>
  // AI Processing
  selectAudioFile(): Promise<string | null>
  checkOllama(): Promise<{ available: boolean; models: string[] }>
  isWhisperReady(): Promise<boolean>
  processLecture(
    audioPath: string,
    courseId: number,
    title: string,
    date: string
  ): Promise<{
    success: boolean
    transcript?: string
    notes?: string
    path?: string
    error?: string
  }>

  onSyncProgress(callback: (event: unknown, data: unknown) => void): void
  offSyncProgress(): void
  onAiProgress(callback: (event: unknown, data: unknown) => void): void
  offAiProgress(): void

  // Resources (File Vault)
  listResources(courseId: number): Promise<unknown>
  downloadResources(
    courseId: number,
    resources: unknown[]
  ): Promise<{ success: boolean; downloaded: number; errors: string[] }>
  onResourceProgress(callback: (event: unknown, data: unknown) => void): void
  offResourceProgress(): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CanvasAPI
  }
}
