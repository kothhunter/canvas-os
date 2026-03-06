import { shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import store from './store'
import { getCourse } from './database'

interface NoteFile {
  name: string
  path: string
  date: string
  title: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getLecturesDir(courseId: number): string {
  const vaultPath = store.get('vaultPath')
  if (!vaultPath) throw new Error('Vault path not configured.')

  const course = getCourse(courseId) as { code: string } | undefined
  if (!course) throw new Error('Course not found.')

  const dir = join(vaultPath, 'courses', course.code, 'lectures')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getAllNotes(courseId: number): NoteFile[] {
  try {
    const dir = getLecturesDir(courseId)
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'))

    return files
      .map((f) => {
        const match = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
        return {
          name: f,
          path: join(dir, f),
          date: match ? match[1] : '',
          title: match ? match[2].replace(/-/g, ' ') : f.replace('.md', '')
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return []
  }
}

export function readNote(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

export function saveNote(
  courseId: number,
  title: string,
  content: string,
  date: string
): { success: boolean; path: string } {
  const dir = getLecturesDir(courseId)
  const course = getCourse(courseId) as { code: string; name: string }
  const filename = `${date}-${slugify(title)}.md`
  const filePath = join(dir, filename)

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `date: ${date}`,
    `course: "${course.code}"`,
    `type: lecture`,
    '---',
    '',
    ''
  ].join('\n')

  writeFileSync(filePath, frontmatter + content, 'utf-8')
  return { success: true, path: filePath }
}

export function revealNote(filePath: string): void {
  shell.showItemInFolder(filePath)
}
