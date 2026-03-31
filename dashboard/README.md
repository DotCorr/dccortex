# DCCortex Dashboard (IDE)

Full-featured IDE for writing scripts with live preview and AI assistant.

## Features

### IDE Experience
- **Split View**: Script editor (left) + Live preview (right)
- **Monaco Editor**: VS Code in browser with syntax highlighting
- **Real-time Compilation**: See generated code as you type
- **AI Assistant Panel**: Watch AI process @ai blocks
- **File Tabs**: Switch between backend.bgs and frontend.bgs
- **Import/Export**: Upload scripts or download projects

### Script Editor (Left Panel)
- Monaco Editor with `.bgs` syntax highlighting
- Auto-completion
- Error detection and highlighting
- Find & replace
- Line numbers
- Auto-save

### Live Preview (Right Panel)
- Real-time code generation
- Tabs: Express Server, Prisma Schema, Route Handlers
- Syntax highlighting for generated code
- Expand/collapse sections
- Copy to clipboard

### AI Assistant
- Shows AI processing status
- Real-time updates for @ai blocks
- Displays generated code snippets
- Shows AI reasoning (optional)

### App Management
- List all apps
- View deployment status
- View logs and metrics
- Manage API keys

### Deployment
- One-click deploy
- View deployment progress
- Download generated projects (iOS, Android)
- View live URLs

## Technology Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Editor**: Monaco Editor
- **State**: React Query
- **Auth**: NextAuth.js

## Pages

```
/                    # Dashboard home
/apps                # List apps
/apps/new           # Create new app
/apps/[id]          # App details
/apps/[id]/editor   # Script editor
/apps/[id]/deploy   # Deployment settings
/apps/[id]/keys     # API key management
/apps/[id]/logs     # Logs and metrics
/settings            # User settings
```

## Getting Started

```bash
cd dashboard
npm install
npm run dev
```

