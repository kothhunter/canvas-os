import { SupabaseClient } from '@supabase/supabase-js'
import TurndownService from 'turndown'
import { fetchCourseFiles, fetchCoursePages, fetchPageBody } from './canvas'
import { Resource, ResourceListResult } from '@/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function listCourseResources(
  courseId: number,
  userId: string,
  supabase: SupabaseClient
): Promise<ResourceListResult> {
  const { data: course } = await supabase
    .from('courses')
    .select('canvas_id')
    .eq('id', courseId)
    .eq('user_id', userId)
    .single()

  if (!course) throw new Error('Course not found.')

  const warnings: string[] = []

  const [files, pages] = await Promise.all([
    fetchCourseFiles(course.canvas_id, userId, supabase).catch((err: Error) => {
      if (err.message?.includes('403')) {
        warnings.push('Files tab is restricted for this course.')
      } else {
        warnings.push('Could not load files: ' + err.message)
      }
      return []
    }),
    fetchCoursePages(course.canvas_id, userId, supabase).catch((err: Error) => {
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

export async function buildResourceZip(
  courseId: number,
  selectedResources: Resource[],
  userId: string,
  supabase: SupabaseClient
): Promise<Buffer> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const { data: course } = await supabase
    .from('courses')
    .select('canvas_id, code')
    .eq('id', courseId)
    .eq('user_id', userId)
    .single()

  if (!course) throw new Error('Course not found.')

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

  for (const resource of selectedResources) {
    try {
      if (resource.type === 'file') {
        const response = await fetch(resource.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = Buffer.from(await response.arrayBuffer())
        zip.file(resource.name, buffer)
      } else {
        const html = await fetchPageBody(course.canvas_id, resource.url, userId, supabase)
        const markdown = turndown.turndown(html)
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
        zip.file(`${slugify(resource.name)}.md`, frontmatter + markdown)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      // Add an error note file instead of failing the whole zip
      zip.file(`ERROR-${slugify(resource.name)}.txt`, `Failed to download: ${msg}`)
    }
  }

  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>
}
