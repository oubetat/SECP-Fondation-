import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ARTIFACT_DIR = 'qualification-002/final-comprehensive-closure-015';

function getHash(filePath: string): string {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), filePath));
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'NOT_FOUND';
  }
}

const manifestPath = path.join(ARTIFACT_DIR, 'source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('=== SOURCE HASH VERIFICATION ===');
let allMatched = true;

for (const entry of manifest) {
  const currentHash = getHash(entry.path);
  const match = currentHash === entry.sha256;
  console.log(`[${match ? 'MATCH' : 'MISMATCH'}] ${entry.path}`);
  console.log(`  Manifest: ${entry.sha256}`);
  console.log(`  Current : ${currentHash}`);
  if (!match) allMatched = false;
}

console.log(`\nOverall Hash Verification: ${allMatched ? 'ALL MATCHED' : 'HASH MISMATCH DETECTED'}`);
