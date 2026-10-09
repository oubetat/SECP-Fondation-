const fs = require('fs');
let code = fs.readFileSync('src/components/CadViewport3D.tsx', 'utf8');

// Fix materials to use THREE.Color
code = code.replace(/color: (0x[0-9a-fA-F]+)/g, 'color: new THREE.Color($1)');

// Fix renderer local clipping
code = code.replace(/renderer\.localClippingEnabled = true;/g, 'renderer.localClippingEnabled = showSectionPlane;');

// Revert to MeshStandardMaterial
code = code.replace(/new THREE\.MeshNormalMaterial/g, 'new THREE.MeshStandardMaterial');

fs.writeFileSync('src/components/CadViewport3D.tsx', code);
