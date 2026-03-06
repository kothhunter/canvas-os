import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface AppSettings {
  canvasToken: string
  canvasUrl: string
  vaultPath: string
  lastSync: string | null
}

const defaults: AppSettings = {
  canvasToken: '',
  canvasUrl: 'https://canvas.instructure.com',
  vaultPath: '',
  lastSync: null
}

let filePath: string | null = null
let data: AppSettings | null = null

function getFilePath(): string {
  if (!filePath) {
    filePath = join(app.getPath('userData'), 'settings.json')
  }
  return filePath
}

function load(): AppSettings {
  try {
    const fp = getFilePath()
    if (existsSync(fp)) {
      const raw = readFileSync(fp, 'utf-8')
      return { ...defaults, ...JSON.parse(raw) }
    }
  } catch {
    // Fall through to defaults
  }
  return { ...defaults }
}

function getData(): AppSettings {
  if (!data) {
    data = load()
  }
  return data
}

function save(): void {
  writeFileSync(getFilePath(), JSON.stringify(getData(), null, 2), 'utf-8')
}

const store = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return getData()[key]
  },
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    getData()[key] = value
    save()
  },
  get store(): AppSettings {
    return { ...getData() }
  }
}

export default store
