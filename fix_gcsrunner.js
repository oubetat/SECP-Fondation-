const fs = require('fs');
let code = fs.readFileSync('src/engine/benchmark/gcs/GCSRunner.ts', 'utf8');

// Replace createFailureRecord
code = code.replace(/Math\.random\(\)\.toString\(16\)\.slice\(2, 10\)/g, "crypto.createHash('sha256').update(c.id + errorMsg).digest('hex').slice(0, 8)");

// Replace computeGeometryHash
code = code.replace(
  /let hash = 0;\s*for \(let i = 0; i < raw\.length; i\+\+\) \{\s*hash = \(hash << 5\) - hash \+ raw\.charCodeAt\(i\);\s*hash \|= 0;\s*\}\s*return `sha256-geom-\$\{Math\.abs\(hash\)\.toString\(16\)\.padStart\(8, '0'\)\}`;/g,
  "return crypto.createHash('sha256').update(raw).digest('hex');"
);

// Replace computeConstraintHash
code = code.replace(
  /let hash = 0;\s*for \(let i = 0; i < raw\.length; i\+\+\) \{\s*hash = \(hash << 5\) - hash \+ raw\.charCodeAt\(i\);\s*hash \|= 0;\s*\}\s*return `sha256-constr-\$\{Math\.abs\(hash\)\.toString\(16\)\.padStart\(8, '0'\)\}`;/g,
  "return crypto.createHash('sha256').update(raw).digest('hex');"
);

// Replace createSignature
code = code.replace(
  /let hash = 0;\s*for \(let i = 0; i < payload\.length; i\+\+\) \{\s*hash = \(hash << 5\) - hash \+ payload\.charCodeAt\(i\);\s*hash \|= 0;\s*\}\s*return `sha256-secp173-\$\{Math\.abs\(hash\)\.toString\(16\)\.padStart\(12, '0'\)\}`;/g,
  "return crypto.createHash('sha256').update(payload).digest('hex');"
);

// Replace createSignature name to createAttestationDigest
code = code.replace(/createSignature\(/g, "createAttestationDigest(");
code = code.replace(/attestationSignature/g, "attestationDigest");

// Prepend import * as crypto
if (!code.includes("import * as crypto")) {
  code = "import * as crypto from 'crypto';\n" + code;
}

fs.writeFileSync('src/engine/benchmark/gcs/GCSRunner.ts', code);
console.log("Fixed GCSRunner");
