/**
 * One-off bootstrap: promote or create ADMIN.
 * Usage (from apps/api):
 *   BOOTSTRAP_ADMIN_EMAIL=you@company.com BOOTSTRAP_ADMIN_PASSWORD='...' npx ts-node prisma/seed-admin.ts
 *
 * Refuses production unless ALLOW_ADMIN_SEED=true
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const allowProd = process.env.ALLOW_ADMIN_SEED === 'true';

  if (process.env.NODE_ENV === 'production' && !allowProd) {
    console.error('Refusing to run in production without ALLOW_ADMIN_SEED=true');
    process.exit(1);
  }
  if (!email) {
    console.error('Set BOOTSTRAP_ADMIN_EMAIL');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.ADMIN, is_active: true },
    });
    console.log(`Updated ${email} → ADMIN`);
    return;
  }

  if (!password || password.length < 8) {
    console.error('User missing; set BOOTSTRAP_ADMIN_PASSWORD (min 8 chars)');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hash,
      name: 'Admin',
      role: Role.ADMIN,
      shop_id: '1',
    },
  });
  console.log(`Created ADMIN ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
