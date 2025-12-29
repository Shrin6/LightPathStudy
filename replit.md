# LightPath Study

AI-powered study application where students upload materials (PDFs, slides, Word docs, images) and receive personalized AI tutoring, flashcards, quizzes, worksheets, and memory tricks from their own content.

## Project Overview

**Tech Stack:**
- Frontend: React + Vite + TypeScript
- UI: shadcn/ui components + Tailwind CSS
- Backend: Supabase (auth, database, edge functions)
- State: TanStack Query

**Key Routes:**
- `/` - Landing page
- `/auth` - Login/Register
- `/dashboard` - User dashboard with progress tracking
- `/study` - Main study workspace with all modes
- `/settings` - User settings and saved quotes

## Project Architecture

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   │   ├── breadcrumbs.tsx   # Navigation breadcrumbs
│   │   ├── back-button.tsx   # Context-aware back navigation
│   │   └── footer-nav.tsx    # Mobile bottom navigation
│   ├── study/           # Study-specific components
│   │   ├── Sidebar.tsx       # Collection + mode selection
│   │   ├── TopBar.tsx        # Header with nav + breadcrumbs
│   │   ├── ChatPane.tsx      # AI tutor chat
│   │   ├── QuizPanel.tsx     # Quiz mode
│   │   ├── FlashcardsViewer.tsx
│   │   ├── WorksheetPanel.tsx
│   │   └── NotesViewer.tsx
│   └── feedback/        # Feedback dialog
├── pages/               # Route pages
├── integrations/        # Supabase client
├── lib/                 # Utilities
└── assets/              # Static assets
```

## Study Modes

1. **Explain Mode** - AI tutoring with step-by-step explanations
2. **Quiz Mode** - Practice quizzes with detailed explanations
3. **Flashcards** - Auto-generated flashcards with export
4. **Memory Tricks** - Mnemonics and memory techniques
5. **Worksheet** - 20-question practice batches
6. **Simple Notes** - Condensed study notes

## Recent Changes

**Dec 29, 2024 - Study Workspace UI Overhaul:**
- Updated all study mode panels with consistent header design (icon + title + subtitle)
- Improved sidebar with uppercase section labels, better spacing
- Enhanced ChatPane with centered empty states, improved message bubbles
- Updated QuizPanel with professional header and progress dialog
- Updated FlashcardsViewer with card count in header
- Improved CollectionsList with file counts and cleaner selection states
- Updated StudyModes with cleaner button layout
- Added Material Type dropdown with professional styling
- All components now have consistent data-testid attributes

**Dec 2024 - UI Navigation Makeover:**
- Added breadcrumbs component for context-aware navigation
- Added mobile footer navigation
- Compact headers (h-12) with consistent styling
- Sticky header on Dashboard
- BackButton component for contextual back navigation
- CollectionHeader for collection context bar

## User Preferences

- Academic/professional design style
- Compact, information-dense layouts
- No emojis or decorative noise
- Bible quotes for motivation (stored per user)
- Per-collection progress tracking

## Development Notes

- DEV_MODE flag in Study.tsx bypasses auth for testing
- Supabase edge functions handle: document parsing, chat-tutor AI, embeddings
- Do NOT modify Supabase schema, RLS, or edge functions without explicit request
- All existing functionality must remain intact during UI updates
