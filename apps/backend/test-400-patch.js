const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!user) return console.log('No admin found');
  
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, 'madad-vision-jwt-secret-2024');
  
  const zone = await prisma.zone.findFirst();
  if (!zone) return console.log('No zone found');
  
  const res = await fetch('http://localhost:3001/api/zones/' + zone.id, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      polygon_points: [[0.5, 0.5], [0.9, 0.9]]
    })
  });
  
  const json = await res.json();
  console.log('PATCH Status:', res.status);
  console.log(JSON.stringify(json, null, 2));
}

run().finally(() => prisma.$disconnect());
