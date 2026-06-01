const { PrismaClient } = require('./apps/backend/node_modules/@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
prisma.user.findFirst().then(async user => {
  if (user) {
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'madad-vision-jwt-secret-2024');
    
    // Create a zone first
    const zoneRes = await fetch("http://localhost:3001/api/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        camera_id: "5979b5da-9543-4fbd-b949-532c10c3491f",
        polygon_points: [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]],
        rule_type: "intrusion"
      })
    });
    const zone = await zoneRes.json();
    console.log('Created:', zone);
    
    // Update it
    const updateRes = await fetch(`http://localhost:3001/api/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        polygon_points: [[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]]
      })
    });
    console.log('Updated:', await updateRes.text());
  } else {
    console.log('No user');
  }
}).finally(() => prisma.$disconnect());
