// Placeholder assets oluşturur (ilk kurulumda bir kez çalıştır)
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// Minimal geçerli PNG (1x1 piksel, koyu mor #1a1a2e)
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000' +
  '0090wc3d00000000c4944415478016360f8cfc0c0c000000000' +
  '5/00010000ffffffffffffffff00000000000049454e44ae426082',
  'hex'
).toString('base64');

// Daha güvenilir: doğrudan bilinen geçerli 1x1 PNG base64
const VALID_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
files.forEach(name => {
  const filePath = path.join(assetsDir, name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(VALID_PNG, 'base64'));
    console.log('✓ Oluşturuldu:', name);
  } else {
    console.log('· Zaten var:', name);
  }
});
console.log('\nAssets hazır! Şimdi: npm install && npx expo start');
