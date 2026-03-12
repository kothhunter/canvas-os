# AI School OS - Academic Command Center

AI School OS is a comprehensive, cloud-native academic command center designed to supercharge a student's workflow. Built as a sleek, modern Next.js web application, it seamlessly bridges the gap between your university's Canvas LMS and a beautiful, unified dashboard, augmented by client-side AI processing.

## 🚀 Key Features

### 1. Unified Academic Dashboard
- **Canvas LMS Integration**: Connects securely to your Canvas account via API token to automatically sync your courses and upcoming assignments.
- **Assignment Tracking**: View all pending, submitted, and overdue assignments across all classes in one unified, filterable, and animated dashboard.
- **Urgency Pulse & Gamification**: A visual spotlight cursor effect, a pulsing red indicator for assignments due within 24 hours, and an elegant confetti celebration when you reach "Inbox Zero."
- **Background Sync**: Silently pulls fresh data in the background (using Vercel Cron Jobs) to keep your dashboard up-to-date.

### 2. File Vault & Course Resources
- **Resource Syncing**: Query and download specific files, PowerPoints, PDFs, and Canvas Pages from your courses directly into a ZIP archive.
- **Markdown Conversion**: Canvas HTML pages are automatically converted into clean, readable Markdown for your personal knowledge base (like Obsidian or Notion).

### 3. Live Lecture AI (Client-Side)
- **Real-Time Transcription**: Use the "Live Lecture AI" tab in the Note Editor to transcribe your professor's lectures in real-time, completely free and within the browser via the native Web Speech API.
- **Prompt Generation**: Automatically formats your lecture transcript with a pre-engineered "Academic TA" system prompt. Just click "Copy Prompt & Transcript for LLM" and paste it into ChatGPT or Claude to get a perfectly structured study guide.

---

## 🏗 Architecture & Tech Stack

This project was recently migrated from a local Electron desktop app to a powerful, web-native architecture optimized for zero-setup deployment and premium UI/UX.

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Styling & Animations**: [Tailwind CSS](https://tailwindcss.com/) and [Framer Motion](https://www.framer.com/motion/) for premium, staggering entrance animations and interactive cursor spotlight effects.
- **Backend & Auth**: [Supabase](https://supabase.com/) for effortless user authentication and PostgreSQL database storage for normalized Canvas data.
- **Deployment**: Hosted seamlessly on [Vercel](https://vercel.com/) with automated background chron jobs.
- **Icons & Gamification**: [Lucide React](https://lucide.dev/) for crisp iconography and `react-confetti` for dopamine-driven study sessions.

---

## 🛠 How to Deploy to Vercel

You can easily deploy your own instance of AI School OS to Vercel for free.

### Prerequisites
1. A [Vercel](https://vercel.com/) account.
2. A [Supabase](https://supabase.com/) account (the free tier is perfect).

### Setup Instructions

1. **Create a Supabase Project**
   - Head to Supabase and create a new project.
   - Run the provided `supabase/schema.sql` file in the Supabase SQL Editor to generate the necessary `users`, `courses`, `assignments`, and `notes` tables.
   - Go to Authentication -> URL Configuration and add your Vercel URL to your Redirect URLs (e.g., `https://your-app.vercel.app/*`).

2. **Deploy to Vercel**
   - Push this repository to your own GitHub account.
   - Import the repository into Vercel.
   - Add the following Environment Variables in Vercel before deploying:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.

3. **Configure Canvas Integration**
   - Once deployed, create an account on your live app.
   - Go to the **Settings** page within the app.
   - Enter your school's Canvas domain (e.g., `https://canvas.instructure.com`).
   - Generate a new API token in your Canvas Account Settings -> Approved Integrations -> "New Access Token" and paste it into the app.
   - Click **Save & Sync**.

---

## 📝 Roadmap & Philosophy

- **Zero-Friction UX**: The core philosophy is to remove the barriers between students and their study materials. Deployment is instant, and AI transcriptions run entirely in the browser without requiring local LLM installs or API keys.
- **Premium Aesthetics**: The UI is designed to wow—utilizing dark themes, smooth physics-based animations, glassmorphism, and careful typographic hierarchies.
- **Own Your Data**: All Canvas HTML is parsed cleanly into Markdown, empowering students to build their own interconnected knowledge graphs outside of the walled garden of a university LMS.
