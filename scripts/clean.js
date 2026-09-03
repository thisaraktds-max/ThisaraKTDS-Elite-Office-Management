import fs from 'fs';
import path from 'path';

const targets = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'server.js'),
  path.join(process.cwd(), 'data', 'school-office.db'),
];

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[Clean] Removed: ${target}`);
    }
  } catch (err) {
    console.error(`[Clean] Failed to remove ${target}:`, err);
  }
}
