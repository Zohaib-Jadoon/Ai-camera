const { PrismaClient } = require('./apps/backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.camera.findFirst().then(camera => {
  if (camera) {
    console.log(camera.id);
  } else {
    console.log('No camera');
  }
}).finally(() => prisma.$disconnect());
