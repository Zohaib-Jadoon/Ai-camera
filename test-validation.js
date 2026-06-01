const { ValidationPipe } = require('@nestjs/common');
const { CreateZoneDto } = require('./apps/backend/dist/zone/dto/create-zone.dto');

async function run() {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  try {
    const result = await pipe.transform({
      camera_id: "5979b5da-9543-4fbd-b949-532c10c3491f",
      polygon_points: [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]],
      rule_type: "intrusion",
      name: "Test"
    }, { type: 'body', metatype: CreateZoneDto });
    console.log("Success:", result);
  } catch (err) {
    console.log("Error:", err.response);
  }
}
run();
