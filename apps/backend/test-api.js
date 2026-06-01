const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Step 1: Login
  console.log('1. Logging in as admin@madad.ai ...');
  const login = await post('/api/auth/login', { email: 'admin@madad.ai', password: 'admin123' });
  console.log(`   Status: ${login.status}`);
  if (login.status !== 200 && login.status !== 201) {
    console.log('   FAILED:', login.body);
    return;
  }
  const token = login.body.access_token;
  const role = login.body.user?.role;
  console.log(`   OK — role=${role}, token=${token?.slice(0, 40)}...`);

  // Step 2: Create camera
  console.log('\n2. Creating camera with RTSP URL ...');
  const cam = await post(
    '/api/cameras',
    { name: 'Test Camera 1', rtsp_url: 'rtsp://192.168.18.15:1945/', location: 'Main Entrance', status: 'OFFLINE' },
    token
  );
  console.log(`   Status: ${cam.status}`);
  if (cam.status === 201 || cam.status === 200) {
    console.log('   SUCCESS — Camera created:', cam.body);
  } else {
    console.log('   FAILED:', cam.body);
  }
}

main().catch(console.error);
