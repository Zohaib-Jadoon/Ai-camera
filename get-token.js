const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst().then(user => {
  if (user) {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: user.id, role: user.role }, 'madad-vision-jwt-secret-2024');
    console.log('Token:', token);
  } else {
    console.log('No user');
  }
}).finally(() => prisma.$disconnect());
