import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CORE_DIR = 'src/engine/fem/core';
const MANIFEST_PATH = '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814/FEM_BASELINE_MANIFEST.json';

function computeSha256(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return 'FILE_NOT_FOUND';
  const data = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const files = fs.readdirSync(CORE_DIR).filter(f => !fs.lstatSync(path.join(CORE_DIR, f)).isDirectory());
const manifest = {
  module: "src/engine/fem/core",
  timestamp: new Date().toISOString(),
  totalFiles: files.length,
  files: files.map(f => ({
    file: path.join(CORE_DIR, f),
    sha256: computeSha256(path.join(CORE_DIR, f))
  }))
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log('Manifest updated successfully.');
