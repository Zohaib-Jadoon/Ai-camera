/**
 * Madad Vision AI — Admin Seed Script
 * Creates the first ADMIN user if one doesn't already exist.
 * Run: npx ts-node prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@madadvision.ai';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✔  Admin already exists: ${email}`);
    return;
  }

  const initialPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!initialPassword || initialPassword.length < 16 || Buffer.byteLength(initialPassword, 'utf8') > 72) {
    throw new Error('Set SEED_ADMIN_PASSWORD to a unique password of at least 16 characters and at most 72 UTF-8 bytes');
  }
  const password = await bcrypt.hash(initialPassword, 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email,
      password,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('');
  console.log('✅ Admin account created successfully!');
  console.log('   Email   :', admin.email);
  console.log('   Role    : ADMIN');
  console.log('');
  console.log('⚠  Change the password immediately after first login.');
}

main()
  .catch((e) => {
    console.error('Seed failed. Verify database access and SEED_ADMIN_PASSWORD configuration.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
