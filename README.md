# DCCortex: Full-Stack Scripting Platform

**Write scripts. Get apps. Multi-tenant SaaS.**

Users write `backend.bgs` and `frontend.bgs` scripts. DCCortex compiles them to production code and hosts everything in isolated Docker containers.

---

## Quick Start

**See `RUN_THIS_FIRST.md` for local setup (Docker + dashboard + DB).**

**For production deployment, see `DEPLOYMENT.md`**

### Quick Steps

1. **Set environment variables**:
   ```bash
   cd platform-api
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   ```

2. **Build and start**:
   ```bash
   # Build compiler
   cd compiler && npm install && npm run build && cd ..
   
   # Build platform API
   cd platform-api && npm install && npm run build && cd ..
   
   # Start services
   docker-compose up
   ```

3. **Run test**:
   ```bash
   ./test-end-to-end.sh
   ```

### Deploy an App

```bash
# Deploy user's app
curl -X POST http://localhost:3001/api/v1/apps/user1/app1/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "script": "model User { id: uuid primary email: string unique } route GET /users { auth required @ai { Get all users } }",
    "projectName": "my-app"
  }'

# Returns: {"success": true, "url": "http://user1-app1.localhost"}
```

---

## Architecture

```
User writes script → Platform API → Compiler → Generated Code → Docker Container → Live App
```

### Components

1. **Compiler** - Parses `.bgs` scripts and generates Node.js/Express code
2. **Platform API** - Manages compilation, deployments, and containers
3. **Traefik** - Routes subdomains to user containers
4. **Docker** - Isolated containers for each user's app

### Multi-Tenant Flow

```
user1-app1.dccortex.com → Traefik → Container (user1-app1)
user2-app1.dccortex.com → Traefik → Container (user2-app1)
```

Each user gets their own isolated container with their own subdomain.

---

## Project Structure

```
DCCortex/
├── compiler/              # Script parser and code generator
│   ├── src/
│   │   ├── parser/       # Parses .bgs files to AST
│   │   └── generator/    # Generates Node.js/Express code
│   └── tests/            # Parser tests
│
├── platform-api/         # Main API service
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   └── services/     # Compiler & Docker services
│   └── Dockerfile
│
├── docker-compose.yml    # Traefik + Platform API
├── traefik_dynamic.yml   # Traefik config
└── examples/             # Example .bgs scripts
```

---

## API Endpoints

### Compilation
- `POST /api/v1/compile/compile` - Compile script to code
- `POST /api/v1/compile/validate` - Validate script syntax
- `POST /api/v1/compile/preview` - Preview compilation (for IDE)

### Deployment
- `POST /api/v1/apps/:userId/:appId/deploy` - Deploy app (compile + container)
- `POST /api/v1/apps/:userId/:appId/stop` - Stop app container
- `DELETE /api/v1/apps/:userId/:appId` - Delete app container
- `GET /api/v1/apps/:userId/apps` - List user's apps

### Usage Tracking
- `GET /api/v1/usage/:userId` - Get AI usage for user
- `GET /api/v1/usage/:userId/stats` - Get usage statistics

---

## How It Works

### 1. User Writes Script

```hbs
// backend.bgs
model User {
  id: uuid primary
  email: string unique
}

route GET /users {
  auth required
  @ai { Get all users }
}
```

### 2. Platform API Compiles

- Parser converts script to AST
- Generator creates Express.js code
- Returns complete project structure

### 3. Platform API Deploys

- Builds Docker image from generated code
- Creates container with Traefik labels
- Container starts automatically
- Returns URL: `http://user1-app1.localhost`

### 4. Traefik Routes Traffic

- Detects new container via Docker API
- Routes `user1-app1.localhost` → container
- App is live and accessible

---

## Technology Stack

- **Compiler**: TypeScript (parser + generator)
- **Platform API**: Node.js/Express
- **Reverse Proxy**: Traefik
- **Containers**: Docker
- **Database**: PostgreSQL (via Prisma in generated apps)

---

## Development

### Build Everything
```bash
cd compiler && npm run build
cd ../platform-api && npm run build
```

### Run Locally
```bash
docker-compose up
```

### Test
```bash
# Compiler tests
cd compiler && npm test

# Test API
curl http://localhost:3001/health
```

---

## Production

1. Get wildcard SSL certificate (`*.dccortex.com`)
2. Update `docker-compose.yml` with cert paths
3. Set `DOMAIN=dccortex.com` and `NODE_ENV=production`
4. Deploy to server

See `architecture/MULTI_TENANT.md` for production setup.

---

## Documentation

- `START_HERE.md` - **Start here!** Quick setup guide
- `HOW_IT_WORKS.md` - Complete flow explanation
- `TEST_LOCALLY.md` - Detailed testing instructions
- `architecture/ARCHITECTURE.md` - System architecture
- `architecture/MULTI_TENANT.md` - Multi-tenant setup
- `architecture/BACKEND_SCRIPT_SPEC.md` - Script language reference
- `STATUS.md` - Current status and next steps

---

## Current Status

✅ **Compiler** - Parses scripts, generates Node.js code  
✅ **Platform API** - Compilation and deployment endpoints  
✅ **Docker Service** - Container management  
✅ **Traefik** - Multi-tenant routing  
✅ **Claude API Integration** - @ai block processing  
✅ **Usage Tracking** - Per-tenant AI usage tracking  
✅ **Route Logic Generation** - Full implementations (not stubs)  
⏳ **Frontend Dashboard** - Next up

**Core platform 100% complete. Ready for dashboard!**

## Environment Variables

Set in `platform-api/.env`:
- `ANTHROPIC_API_KEY` - Claude API key (for @ai blocks)
- `DOMAIN` - Domain for subdomains (default: localhost)
- `PORT` - Platform API port (default: 3001)
