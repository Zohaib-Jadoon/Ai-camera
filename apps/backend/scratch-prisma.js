const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const cameras = await prisma.camera.findMany();
  console.log('Cameras in DB:', cameras);
  
  if (cameras.length > 0) {
    const cam = cameras[0];
    try {
      const zone = await prisma.zone.create({
        data: {
          camera_id: cam.id,
          name: 'Test Zone',
          rule_type: 'intrusion',
          polygon_points: [{x: 0.1, y: 0.2}]
        }
      });
      console.log('Zone created successfully via Prisma:', zone);
    } catch (e) {
      console.error('Error creating zone:', e);
    }
  } else {
    console.log('No cameras found!');
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
