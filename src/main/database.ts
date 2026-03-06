import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

export function getDB(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'app.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initSchema()
  }
  return db
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canvas_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      term TEXT,
      instructor TEXT
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canvas_id TEXT UNIQUE NOT NULL,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      due_at TEXT,
      points_possible REAL,
      status TEXT DEFAULT 'pending',
      description TEXT,
      html_url TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at TEXT NOT NULL,
      courses_synced INTEGER DEFAULT 0,
      assignments_synced INTEGER DEFAULT 0,
      error TEXT
    );
  `)
}

export function upsertCourse(course: {
  canvas_id: string
  name: string
  code: string
  term?: string
  instructor?: string
}): number {
  const stmt = getDB().prepare(`
    INSERT INTO courses (canvas_id, name, code, term, instructor)
    VALUES (@canvas_id, @name, @code, @term, @instructor)
    ON CONFLICT(canvas_id) DO UPDATE SET
      name = excluded.name,
      code = excluded.code,
      term = excluded.term,
      instructor = excluded.instructor
  `)
  stmt.run({
    canvas_id: course.canvas_id,
    name: course.name,
    code: course.code,
    term: course.term || null,
    instructor: course.instructor || null
  })

  // Get the internal id for this course
  const row = getDB()
    .prepare('SELECT id FROM courses WHERE canvas_id = ?')
    .get(course.canvas_id) as { id: number }
  return row.id
}

export function upsertAssignment(assignment: {
  canvas_id: string
  course_id: number
  name: string
  due_at: string | null
  points_possible: number | null
  status: string
  description: string | null
  html_url: string | null
}): void {
  const stmt = getDB().prepare(`
    INSERT INTO assignments (canvas_id, course_id, name, due_at, points_possible, status, description, html_url)
    VALUES (@canvas_id, @course_id, @name, @due_at, @points_possible, @status, @description, @html_url)
    ON CONFLICT(canvas_id) DO UPDATE SET
      course_id = excluded.course_id,
      name = excluded.name,
      due_at = excluded.due_at,
      points_possible = excluded.points_possible,
      status = excluded.status,
      description = excluded.description,
      html_url = excluded.html_url
  `)
  stmt.run(assignment)
}

export function getAllCourses(): unknown[] {
  return getDB().prepare('SELECT * FROM courses ORDER BY code').all()
}

export function getCourse(id: number): unknown {
  return getDB().prepare('SELECT * FROM courses WHERE id = ?').get(id)
}

export function getAssignments(courseId?: number): unknown[] {
  if (courseId) {
    return getDB()
      .prepare(
        `SELECT a.*, c.name as course_name, c.code as course_code
         FROM assignments a
         JOIN courses c ON a.course_id = c.id
         WHERE a.course_id = ?
         ORDER BY a.due_at ASC NULLS LAST`
      )
      .all(courseId)
  }
  return getDB()
    .prepare(
      `SELECT a.*, c.name as course_name, c.code as course_code
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       ORDER BY a.due_at ASC NULLS LAST`
    )
    .all()
}

export function logSync(coursesCount: number, assignmentsCount: number, error?: string): void {
  getDB()
    .prepare(
      `INSERT INTO sync_logs (synced_at, courses_synced, assignments_synced, error)
       VALUES (?, ?, ?, ?)`
    )
    .run(new Date().toISOString(), coursesCount, assignmentsCount, error || null)
}
