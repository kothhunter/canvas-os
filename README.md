# AI School OS (Canvas Dashboard)

AI School OS is a comprehensive, local-first academic command center designed to supercharge your study workflow. Built as a sleek desktop application, it seamlessly bridges the gap between your university's Canvas LMS and your personal knowledge management systems (like Obsidian or Notion), fully augmented by local AI processing.

## 🚀 Key Features

### 1. Unified Academic Dashboard
- **Canvas LMS Integration**: Connects directly to your Canvas account via API token to automatically sync your courses and upcoming assignments.
- **Assignment Tracking**: View all pending, submitted, and overdue assignments across all classes in one unified, filterable dashboard.
- **Background Sync**: Silently pulls fresh data in the background (using node-cron) to keep your dashboard up-to-date without manual intervention.

### 2. File Vault & Offline Syllabus 
- **Resource Syncing**: Query and select specific files, PowerPoints, PDFs, and Canvas Pages from your courses.
- **Markdown Conversion**: Canvas HTML pages are automatically converted into clean, readable Markdown.
- **Organized Storage**: Downloads and organizes everything directly into your local file system (e.g., an Obsidian Vault), structuring it automatically by course (`Course Name/Resources/`).

### 3. Local AI Lecture Notes Pipeline
- **Raw Transcript Processing**: Paste raw, unedited lecture transcripts (from Apple Voice Memos, Canvas recordings, etc.) directly into the app.
- **Local Privacy**: 100% local AI processing powered by [Ollama](https://ollama.com/), ensuring your lecture data never leaves your machine and preventing recurring API costs.
- **"Academic TA" System Prompt**: Summarizes the transcript, strips out non-instructional filler ("ums", "ahs", syllabus chatter), and outputs a highly structured, hierarchical Markdown document containing an executive summary, organized study notes, and a glossary of key terms.

---

## 🏗 Architecture & Tech Stack

This project is built using modern web and native desktop technologies, optimizing for a premium UI/UX and robust local capabilities.

- **Framework**: [Electron](https://www.electronjs.org/) (Main & Renderer processes) via [Electron-Vite](https://electron-vite.org/)
- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Tailwind CSS](https://tailwindcss.com/)
- **Local Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for storing normalized Canvas data (courses, assignments) offline.
- **AI Engine**: Node.js `ollama` SDK to interface with a locally running Ollama instance (`llama3:8b` by default).
- **Icons & Typography**: [Lucide React](https://lucide.dev/) for premium iconography; custom UI adhering to strict, modern design aesthetics (dark mode first).

---

## 🛠 How to Deploy / Run Locally

If you want to run this application on your own machine, follow the steps below.

### Prerequisites

1. **Node.js**: Ensure you have Node.js (v18 or newer) installed.
2. **Ollama**: Download and install [Ollama](https://ollama.com/) for local AI processing.

### Setup Instructions

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd ai_school_os
   \`\`\`

2. **Install Dependencies**
   The project requires native compilation for `better-sqlite3`, which is handled automatically via a `postinstall` script using `electron-rebuild`.
   \`\`\`bash
   npm install
   \`\`\`

3. **Prepare the Local AI**
   Make sure the Ollama application is running in the background. Then, pull the default Llama 3 model used by the application:
   \`\`\`bash
   ollama pull llama3:8b
   \`\`\`

4. **Start the Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Build for Production (Optional)**
   To package the application into a standalone executable (e.g., a `.dmg` for macOS or `.app`):
   \`\`\`bash
   npm run package
   \`\`\`

---

## ⚙️ Initial Configuration

Once the app is running, you need to configure it to connect to your data sources.

1. **Navigate to Settings** (via the sidebar).
2. **Canvas URL**: Enter your institution's Canvas URL (e.g., `https://canvas.instructure.com` or `https://university.instructure.com`).
3. **Canvas Token**: Generate a new API token in your Canvas account settings under "Approved Integrations" -> "New Access Token". Paste the token into the app.
4. **Local Vault Path**: Select a local folder on your computer where you want the app to save your Markdown lecture notes and downloaded Canvas resources (Highly recommended: your main Obsidian Vault folder).

Once configured, head to the Dashboard and the application will automatically perform its initial sync to pull down your courses and assignments!

---

## 📝 Roadmap & Philosophy

- **Local-First**: The core philosophy of this project is to rely minimally on cloud services. Database storage, AI summarization, and file vaulting all happen locally.
- **Premium Aesthetics**: The UI is designed to feel high-end, utilizing dark themes, subtle blurs, and careful typographic hierarchies.
- **Future Expansions**: 
  - Advanced study tools integrated with NotebookLM or similar RAG systems using the perfectly formatted markdown files the app produces.
  - Deeper Obsidian metadata integration.
