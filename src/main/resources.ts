import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, createWriteStream, writeFileSync } from 'fs'
import { join } from 'path'
import https from 'https'
import http from 'http'
import TurndownService from 'turndown'
import store from './store'
import { getCourse } from './database'
import { fetchCourseFiles, fetchCoursePages, fetchPageBody } from './canvas'

export interface Resource {
  id: string
  type: 'file' | 'page'
  name: string
  size?: number
  contentType?: string
  url: string
  updatedAt: string
}

interface ResourceProgressEvent {
  status: 'listing' | 'downloading' | 'complete' | 'error'
  message: string
  current?: number
  total?: number
  progress?: number
}

function sendResourceProgress(data: ResourceProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('resources:progress', data)
  }
}

function getResourcesDir(courseId: number): string {
  const vaultPath = store.get('vaultPath')
  if (!vaultPath) throw new Error('Vault path not configured.')

  const course = getCourse(courseId) as { code: string } | undefined
  if (!course) throw new Error('Course not found.')

  const dir = join(vaultPath, 'courses', course.code, 'Resources')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function downloadFileToDir(url: string, filename: string, dir: string): Promise<void> {
  const destPath = join(dir, filename)

  return new Promise((resolve, reject) => {
    const followRedirect = (targetUrl: string, redirectCount = 0): void => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'))
        return
      }

      const protocol = targetUrl.startsWith('https') ? https : http
      protocol
        .get(targetUrl, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            followRedirect(res.headers.location, redirectCount + 1)
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Download failed with status ${res.statusCode}`))
            return
          }

          const file = createWriteStream(destPath)
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
          file.on('error', (err) => {
            file.close()
            reject(err)
          })
        })
        .on('error', reject)
    }

    followRedirect(url)
  })
}

export interface ResourceListResult {
  resources: Resource[]
  warnings: string[]
}

export async function listCourseResources(courseId: number): Promise<ResourceListResult> {
  const course = getCourse(courseId) as { canvas_id: string } | undefined
  if (!course) throw new Error('Course not found.')

  const warnings: string[] = []

  const [files, pages] = await Promise.all([
    fetchCourseFiles(course.canvas_id).catch((err) => {
      if (err.message?.includes('403')) {
        warnings.push('Files tab is restricted for this course.')
      } else {
        warnings.push('Could not load files: ' + err.message)
      }
      return []
    }),
    fetchCoursePages(course.canvas_id).catch((err) => {
      if (err.message?.includes('404')) {
        warnings.push('Pages are disabled for this course.')
      } else {
        warnings.push('Could not load pages: ' + err.message)
      }
      return []
    })
  ])

  const fileResources: Resource[] = files.map((f) => ({
    id: f.id,
    type: 'file' as const,
    name: f.display_name,
    size: f.size,
    contentType: f.content_type,
    url: f.url,
    updatedAt: f.updated_at
  }))

  const pageResources: Resource[] = pages.map((p) => ({
    id: p.page_id,
    type: 'page' as const,
    name: p.title,
    url: p.url,
    updatedAt: p.updated_at
  }))

  return { resources: [...fileResources, ...pageResources], warnings }
}

export async function downloadSelectedResources(
  courseId: number,
  resources: Resource[]
): Promise<{ success: boolean; downloaded: number; errors: string[] }> {
  const dir = getResourcesDir(courseId)
  const course = getCourse(courseId) as { canvas_id: string; code: string }
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

  const errors: string[] = []
  let downloaded = 0

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]

    sendResourceProgress({
      status: 'downloading',
      message: `Downloading: ${resource.name}`,
      current: i + 1,
      total: resources.length,
      progress: Math.round((i / resources.length) * 100)
    })

    try {
      if (resource.type === 'file') {
        await downloadFileToDir(resource.url, resource.name, dir)
      } else {
        const html = await fetchPageBody(course.canvas_id, resource.url)
        const markdown = turndown.turndown(html)
        const filename = `${slugify(resource.name)}.md`
        const filePath = join(dir, filename)

        const frontmatter = [
          '---',
          `title: "${resource.name}"`,
          `type: page`,
          `course: "${course.code}"`,
          `source: canvas`,
          `updated: ${resource.updatedAt}`,
          '---',
          '',
          ''
        ].join('\n')

        writeFileSync(filePath, frontmatter + markdown, 'utf-8')
      }
      downloaded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${resource.name}: ${msg}`)
    }
  }

  sendResourceProgress({
    status: 'complete',
    message: `Downloaded ${downloaded} of ${resources.length} resources.`,
    current: resources.length,
    total: resources.length,
    progress: 100
  })

  return { success: errors.length === 0, downloaded, errors }
}
