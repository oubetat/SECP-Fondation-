const fs = require('fs');
let code = fs.readFileSync('src/components/CadViewport3D.tsx', 'utf8');

// Completely remove clipping planes from getMat
code = code.replace(/const getMat = \(opts: any\) => \{[\s\S]*?return new THREE\.MeshStandardMaterial\(opts\);\s*\};/, `const getMat = (opts: any) => { return new THREE.MeshStandardMaterial(opts); };`);

fs.writeFileSync('src/components/CadViewport3D.tsx', code);
