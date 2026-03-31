/**
 * Seed system roles for no-code RBAC.
 * Run after migration: npm run db:seed-roles (uses node, no tsx needed)
 */
const path = require('path');
const fs = require('fs');

// Load .env from dashboard root so DATABASE_URL is set (Node doesn't load .env for standalone scripts)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { name: 'Basic', permissions: ['app.view', 'data.read'] },
  {
    name: 'Development',
    permissions: ['app.view', 'app.edit', 'data.read', 'data.write'],
  },
  {
    name: 'Administration',
    permissions: ['app.view', 'app.edit', 'data.read', 'data.write', 'org.manage'],
  },
];

async function main() {
  for (const { name, permissions } of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { name, organizationId: null },
    });
    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { permissions },
      });
      console.log(`Updated system role: ${name}`);
    } else {
      await prisma.role.create({
        data: {
          name,
          organizationId: null,
          permissions,
        },
      });
      console.log(`Created system role: ${name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
