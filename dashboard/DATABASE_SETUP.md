# Database Setup for DCCortex Dashboard

## Why PostgreSQL?

For a SaaS platform like DCCortex, PostgreSQL is the right choice:
- ✅ **Concurrent writes** - Multiple users can write simultaneously
- ✅ **Network access** - Can be accessed from multiple services
- ✅ **Scalability** - Handles thousands of concurrent connections
- ✅ **Production-ready** - Industry standard for SaaS platforms
- ✅ **Advanced features** - Full-text search, JSON support, etc.

SQLite is fine for tiny local apps, but not for production SaaS.

---

## Setup with Docker (Recommended - Everything in Containers!)

**Everything runs in Docker containers - no local installations needed!**

### Step 1: Install Docker Desktop (if not installed)
- Download from https://www.docker.com/products/docker-desktop
- Start Docker Desktop

### Step 2: Start PostgreSQL Container
```bash
cd DCCortex
docker compose up -d postgres
```

This starts PostgreSQL in a container - no local installation needed!

### Step 3: Run Migrations
```bash
cd dashboard
npx prisma migrate dev
```

The `.env` file is already configured to connect to the Docker PostgreSQL container.

---

### Alternative: Cloud PostgreSQL (For Production)

**Free options:**
- **Neon** (https://neon.tech) - Serverless PostgreSQL, free tier
- **Supabase** (https://supabase.com) - PostgreSQL + extras, free tier
- **Railway** (https://railway.app) - PostgreSQL, free tier

**Setup:**
1. Create account and database
2. Copy connection string
3. Update `.env`:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   ```
4. Run migrations:
   ```bash
   cd dashboard
   npx prisma migrate dev
   ```

---

## Migrations on deploy

The dashboard image uses `entrypoint.sh`: it runs `npx prisma migrate deploy` before starting the app, so all tables (including `app_screens`, `internal_datasources`) are applied when the container starts. No separate migration step is needed if the dashboard is started via that image.

---

## Current Status

✅ Schema updated to PostgreSQL  
✅ Docker Compose configured  
⏳ Need to start PostgreSQL (choose option above)

---

## Quick Start (After PostgreSQL is Running)

```bash
cd dashboard
npx prisma migrate dev
npx prisma generate
npm run dev
```

