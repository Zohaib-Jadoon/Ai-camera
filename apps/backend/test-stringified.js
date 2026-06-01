const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!user) return console.log('No admin found');
  
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, 'madad-vision-jwt-secret-2024');
  
  const cam = await prisma.camera.findFirst();
  if (!cam) return console.log('No camera found');
  
  const res = await fetch('http://localhost:3001/api/zones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      camera_id: cam.id,
      rule_type: 'intrusion',
      polygon_points: '[[0.1, 0.1], [0.9, 0.9]]'
    })
  });
  
  const json = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(json, null, 2));
}

run().finally(() => prisma.$disconnect());
