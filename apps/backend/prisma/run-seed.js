const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@madadvision.ai';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('✔  Admin already exists:', email);
    return;
  }
  const password = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.create({
    data: { name: 'Admin', email, password, role: 'ADMIN', isActive: true },
  });
  console.log('');
  console.log('✅ Admin created!');
  console.log('   Email   :', admin.email);
  console.log('   Password: Admin@12345');
  console.log('   Role    : ADMIN');
  console.log('');
  console.log('⚠  Change the password after first login!');
}

main()
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
