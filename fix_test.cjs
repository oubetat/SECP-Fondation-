const fs = require('fs');
let code = fs.readFileSync('src/components/CadViewport3D.tsx', 'utf8');

code = code.replace(/return new THREE\.MeshStandardMaterial\(opts\);/, `return new THREE.MeshNormalMaterial(opts);`);

fs.writeFileSync('src/components/CadViewport3D.tsx', code);
