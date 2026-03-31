/**
 * Seed system roles for no-code RBAC.
 * Run after migration: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-roles.ts
 * Or: npx tsx prisma/seed-roles.ts
 */

import { PrismaClient } from '@prisma/client';

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
        data: { permissions: permissions as any },
      });
      console.log(`Updated system role: ${name}`);
    } else {
      await prisma.role.create({
        data: {
          name,
          organizationId: null,
          permissions: permissions as any,
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
