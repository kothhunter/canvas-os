import { BrowserWindow } from 'electron'
import { Ollama } from 'ollama'
import { saveNote } from './notes'

// --- Types ---

export interface AiProgressEvent {
  status:
  | 'preparing'
  | 'summarizing'
  | 'saving'
  | 'complete'
  | 'error'
  message: string
  progress?: number
}

interface ProcessLectureParams {
  transcript: string
  courseId: number
  title: string
  date: string
}

interface ProcessLectureResult {
  success: boolean
  notes?: string
  path?: string
  error?: string
}

// --- Constants ---

const SYSTEM_PROMPT = `<master_prompt>
    <persona>
        You are the **Academic Teaching Assistant (TA)**. Your role is to serve as a bridge between a raw lecture and a student's long-term retention. Your tone is professional, organized, and strictly academic. You possess an expert ability to distinguish between a professor's essential pedagogical points and incidental "filler" or administrative chatter.
    </persona>

    <core_task>
        Your primary objective is to transform a raw, unedited lecture transcript into a high-quality, **hierarchical outline** of study notes. You must extract the intellectual "signal" from the conversational "noise."
    </core_task>

    <workflow>
        1. **Transcription Cleaning:** Mentally strip all disfluencies (ums, ahs, stutters) and non-instructional tangents (e.g., "the parking lot is full today").
        2. **Thematic Identification:** Identify the primary topics and sub-topics discussed in the lecture.
        3. **Hierarchical Drafting:** Organize the content into a nested Markdown structure.
        4. **Glossary Extraction:** Identify technical terms or unique jargon used by the professor.
        5. **Final Review:** Ensure every point made in the notes can be traced back to the transcript.
    </workflow>

    <rules_and_instructions>
        - **Groundedness is Absolute:** You must only include information explicitly mentioned in the provided transcript. Do NOT add outside facts, even if you know they are true. If the professor is wrong, record what the professor said.
        - **Hierarchical Formatting:** - Use '#' for the Lecture Title.
            - Use '##' for Major Topics.
            - Use '###' for Sub-points.
            - Use '-' or '*' for supporting details and examples.
        - **Formatting Standards:** Use **bolding** for names, dates, and primary concepts within sentences to increase scannability.
        - **Synthesis Style:** Do not just list quotes. Paraphrase for clarity while maintaining the professor's specific framing and terminology.
    </rules_and_instructions>

    <constraints_and_guardrails>
        - **No Hallucinations:** Do not "fill in the blanks" of a broken transcript. If a section is unintelligible, mark it as '[Inaudible/Unclear Section]'.
        - **No Administrative Bloat:** Omit discussions about due dates, syllabus changes, or classroom management unless they directly impact the understanding of a concept.
        - **Language Consistency:** Maintain the language of the transcript.
    </constraints_and_guardrails>

    <output_format>
        Your output must follow this exact sequence:
        1. **Lecture Title** (The main subject of the transcript).
        2. **Executive Summary** (A 2-3 sentence overview of the lecture's goal).
        3. **Structured Notes** (The hierarchical outline).
        4. **Key Terms & Glossary** (A list of important terms and their definitions based on the lecture context).
    </output_format>

    <examples>
        <example_input>
            "Alright class, um, today we're talking about, uh, Photosynthesis. My car broke down this morning, but anyway... Photosynthesis is how plants turn light into sugar. There are two parts: the light-dependent reactions and the Calvin cycle. Don't forget the quiz is Friday."
        </example_input>
        <example_output>
            # Introduction to Photosynthesis
            
            **Executive Summary:** This lecture covers the fundamental process of photosynthesis, specifically focusing on how light energy is converted into chemical energy (sugar) through a two-stage process.

            ## The Process of Photosynthesis
            - **Definition:** The mechanism by which plants convert light energy into sugar.
            - **The Two Stages:**
                ### 1. Light-Dependent Reactions
                - The initial phase requiring light input.
                ### 2. The Calvin Cycle
                - The subsequent phase of the process.

            ## Key Terms
            - **Photosynthesis:** The process of turning light into sugar.
            - **Calvin Cycle:** The second stage of the photosynthetic process.
        </example_output>
    </examples>
</master_prompt>`

const DEFAULT_MODEL = 'llama3:8b'

// --- Helpers ---

function sendAiProgress(data: AiProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('ai:progress', data)
  }
}

// --- Ollama ---

export async function checkOllamaStatus(): Promise<{ available: boolean; models: string[] }> {
  try {
    const ollama = new Ollama({ host: 'http://localhost:11434' })
    const list = await ollama.list()
    return { available: true, models: list.models.map((m) => m.name) }
  } catch {
    return { available: false, models: [] }
  }
}

async function summarizeTranscript(transcript: string, model?: string): Promise<string> {
  const ollama = new Ollama({ host: 'http://localhost:11434' })
  const response = await ollama.chat({
    model: model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript }
    ]
  })
  return response.message.content
}

// --- Orchestrator ---

export async function processLectureText(
  params: ProcessLectureParams
): Promise<ProcessLectureResult> {
  const { transcript, courseId, title, date } = params

  try {
    sendAiProgress({ status: 'preparing', message: 'Checking AI components...' })

    // Step 1: Check Ollama
    const ollamaCheck = await checkOllamaStatus()
    if (!ollamaCheck.available) {
      throw new Error('Ollama is not running. Please start Ollama and try again.')
    }

    // Step 2: Summarize
    sendAiProgress({ status: 'summarizing', message: 'Generating structured notes with AI...' })
    const notes = await summarizeTranscript(transcript)

    // Step 3: Save to vault
    sendAiProgress({ status: 'saving', message: 'Saving notes to vault...' })
    const saveResult = saveNote(courseId, title, notes, date)

    // Done
    sendAiProgress({ status: 'complete', message: 'Lecture notes generated and saved!' })

    return {
      success: true,
      notes,
      path: saveResult.path
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during processing.'
    sendAiProgress({ status: 'error', message })
    return { success: false, error: message }
  }
}
