const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { role: 'ADMIN' },
  });
  console.log(`Updated ${result.count} users to ADMIN`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
