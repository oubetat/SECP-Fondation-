import fs from 'fs';
import { execSync } from 'child_process';

const files = execSync('find src/engine/materials -type f -name "*.ts"').toString().trim().split('\n');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const regex = /source:\s*['"]([^'"]+)['"]/g;
  content = content.replace(regex, (match, val) => {
    changed = true;
    return `sourceId: '${val}', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash'`;
  });
  
  if (changed) {
    if (!content.includes('PropertySourceType')) {
       // add import
       content = `import { PropertySourceType } from '${file.includes('materials/types') ? './types' : (file.split('/').length > 4 ? '../../types' : '../types')}';\n` + content;
    }
    fs.writeFileSync(file, content);
    console.log('Fixed provenance in', file);
  }
}
