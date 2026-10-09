const fs = require('fs');
let code = fs.readFileSync('src/engine/benchmark/gcs/GCSDeterminismAuditor.ts', 'utf8');

code = code.replace(
  /let hash = 0;\s*for \(let i = 0; i < str\.length; i\+\+\) \{\s*hash = \(hash << 5\) - hash \+ str\.charCodeAt\(i\);\s*hash \|= 0;\s*\}\s*return `sha256-det-\$\{Math\.abs\(hash\)\.toString\(16\)\.padStart\(8, '0'\)\}`;/g,
  "return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);"
);

if (!code.includes("import * as crypto")) {
  code = "import * as crypto from 'crypto';\n" + code;
}

fs.writeFileSync('src/engine/benchmark/gcs/GCSDeterminismAuditor.ts', code);
console.log("Fixed GCSDeterminismAuditor");
