# CodeLensAI

CodeLensAI is an AI-powered developer workspace where you can paste code (or a public GitHub file link), generate explanations, improve code, and visualize structure with call graph/data flow insights.

## Features

- Monaco-based code editor with language detection
- AI code explanation pipeline:
  - Summary
  - Line-by-line explanation
  - Generated commented code
  - Time complexity
  - Space complexity
  - Complexity explanation
- Improve Code action (optimized code suggestions)
- Text-to-speech explanation playback
- GitHub file link analysis (fetches source from public repo file URLs)
- Dedicated GitHub Insights section with:
  - Full explanation insights
  - Call Graph visualization
  - Data Flow visualization
- AI-generated program title
- Auth with Firebase OAuth:
  - Google login
  - GitHub login
- Profile menu/logout
- Guided first-time product tour for new users
- Light/Dark theme toggle
- Multi-page sections: Home, About, Contact Us, Profile

## Tech Stack

- Frontend: React + Vite
- Editor: Monaco (`@monaco-editor/react`)
- Graphs: Cytoscape.js
- AST Parsing: `@babel/parser`
- Backend: Vercel Serverless Functions
- AI Provider: Groq API (Llama model)
- Auth: Firebase Authentication (Google + GitHub OAuth)

## Project Structure

```txt
CodeLensAI/
  api/
    explain.js
    improve.js
    program-title.js
  lib/
    githubFetcher.js
    utils.js
  src/
    analysis/
      codeAnalysis.js
    services/
      apiClient.js
    auth/
      firebase.js
    components/
      CodeEditor.jsx
      ExplanationPanel.jsx
      GraphView.jsx
      AuthModal.jsx
      TourGuide.jsx
    App.jsx
    App.css
    index.css
  .env
```

## Prerequisites

- Node.js 18+
- npm
- Groq API key
- Firebase project configured with Authentication providers

## Environment Variables

Create a root `.env` file:

```env
# Backend (Groq)
GROQ_API_KEY=your_groq_api_key

# Frontend (Firebase via Vite)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

```

## Firebase Setup Checklist

1. Create a Firebase project.
2. Enable Authentication providers:
   - Google
   - GitHub (add client ID/secret)
3. Add authorized domains (`localhost` for local dev).
4. Copy Firebase web config values into `.env` as `VITE_FIREBASE_*`.

## Installation

```bash
npm install
```

## Run Locally

Start frontend:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

## How to Use

### Home (Editor workflow)

1. Paste code into editor.
2. Click `Explain Code` to generate AI insights.
3. Click `Improve Code` to generate optimized code.

### GitHub Link Insights workflow

1. Paste a public GitHub file URL in the GitHub Insights section.
2. Click `Get Insights`.
3. Review:
   - Insights tab
   - Call Graph tab
   - Data Flow tab

Supported GitHub URL format:

```txt
https://github.com/{owner}/{repo}/blob/{branch}/{path-to-file}
```

## API Endpoints (Backend)

- `POST /api/explain`
- `POST /api/improve`
- `POST /api/program-title`

All endpoints accept:

```json
{ "code": "..." }
```

## Notes

- Call Graph/Data Flow are strongest for JavaScript/TypeScript-style source.
- GitHub file analysis requires public repository files.
- If `Improve Code` fails on Vercel, verify `GROQ_API_KEY` is configured in the Vercel project environment.
- If Firebase OAuth shows configuration errors, re-check enabled providers and authorized domains.

## Security

- Do not commit `.env` to GitHub.
- Rotate any API keys that were ever exposed in logs/screenshots.

## License

Add your preferred license (MIT/Apache-2.0/etc.) before publishing.
