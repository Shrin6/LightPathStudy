# Lightpath Study

## Overview

Lightpath Study is an AI-powered study tutor application that helps users learn from their own notes. Users can upload documents (notes, slides, PDFs), and the system generates personalized study materials including flashcards, quizzes, worksheets, memory tricks, and simplified notes. The application also includes a Page Builder feature for generating website previews based on industry presets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC for fast compilation
- **Routing**: React Router DOM for client-side navigation
- **State Management**: TanStack React Query for server state, React useState for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (HSL color system)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for development execution
- **API Pattern**: RESTful API endpoints under `/api/*` prefix
- **Authentication**: Passport.js with local strategy, session-based auth using memory store
- **File Uploads**: Multer middleware for handling multipart form data

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **External Services**: Supabase for authentication and file storage (study-files bucket)
- **Migrations**: Drizzle Kit for database migrations (output to `/migrations`)

### Key Data Models
- Users, Collections, UploadedFiles, DocumentChunks (for RAG)
- Flashcards, StudySessions, LearningEvents
- ContentReports, Feedback

### Study Modes
The application supports multiple study modes:
1. Explain Mode - AI tutor explains concepts
2. Quiz Mode - Multiple choice quizzes with explanations
3. Flashcards - Spaced repetition cards
4. Memory Tricks - Mnemonic devices
5. Worksheet - Practice problems
6. Notes - Simplified study notes

### Layout Components (Dec 2025)
- **PublicShell**: Layout wrapper for public pages (Home) with sticky nav, footer
  - Location: `src/components/layout/PublicShell.tsx`
- **AppShell**: Layout wrapper for authenticated pages (Dashboard) with sidebar navigation
  - Location: `src/components/layout/AppShell.tsx`
  - Responsive sidebar with mobile hamburger menu
- **Study Layout**: Custom TopBar + Sidebar for the Study workspace (specialized for study modes)

### Recent UI Updates (Dec 2025)
- **Modern landing page**: Hero section, feature cards, how-it-works steps, CTA
- **Dashboard redesign**: Summary stat cards (4-column grid), collection progress, quick actions
- **Study workspace**: Compact header (h-12), 2-column study modes grid, Sparkles branding
- **Quiz panel**: Percentage clamping (0-100%), GraduationCap icon, compact cards
- **Flashcard viewer**: Smaller cards (max-w-xl), refined button layout
- **Data-testid attributes**: Comprehensive coverage for testing

### Page Builder Feature
A secondary feature for generating website homepage previews with:
- **Industry Presets**: Restaurant, Plumbing, Lawyers, Health - each with unique themes and layouts
- **Website Scraping**: Enter a URL to auto-populate business info (name, phone, address, etc.)
- **Manual Mode**: Override scraped data or enter info manually
- **Theme Customization**: Background style, colors, fonts, button/card styles, radius, spacing
- **Section Editor**: Enable/disable sections, change variants, edit content
- **Live Preview**: Full-width homepage preview that updates in real-time
- **Route**: `/page-builder`
- **Components**: `src/pages/PageBuilder.tsx`, `src/components/pagebuilder/*`
- **API Endpoint**: `POST /api/scrape-website` for website data extraction

## External Dependencies

### Authentication & Backend Services
- **Supabase**: Authentication, file storage, and some database operations
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)

### AI/ML Services
- Edge functions on Supabase for AI operations (flashcard generation, quiz creation, document parsing)
- OCR processing for image-based notes

### Key NPM Packages
- `@supabase/supabase-js` - Supabase client
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `passport` / `passport-local` - Authentication
- `express-session` / `memorystore` - Session management
- `jspdf` / `docx` - Document export functionality
- `react-day-picker` - Calendar components
- `embla-carousel-react` - Carousel functionality

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret (auto-generated if not provided)
- Supabase configuration (URL and anon key configured in client)