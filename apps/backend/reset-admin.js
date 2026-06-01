const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.update({
    where: { email: 'admin@madad.ai' },
    data: { password: hash, role: 'ADMIN' },
  });
  console.log('Password reset to admin123 and role set to ADMIN for admin@madad.ai');
}

main().catch(console.error).finally(() => prisma.$disconnect());
