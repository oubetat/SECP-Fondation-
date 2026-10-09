const fs = require('fs');
const file = 'src/engine/assembly/AssemblyInterferenceEngine.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    // If legacy solid is available, create equivalent OCCT primitive
    if (part.solid) {
      if (part.solid.mesh.facesCount > 20 || part.name.toLowerCase().includes('cyl') || part.name.toLowerCase().includes('shaft') || part.name.toLowerCase().includes('pin')) {
        return await kernel.createCylinder(20, 100);
      }
      return await kernel.createBox(50, 50, 50);
    }

    // Default primitive
    return await kernel.createBox(40, 40, 40);`;

const replacement = `    throw new Error(\`UNAVAILABLE: Component \${part.id} has no valid B-Rep geometry for interference detection. Refusing to fabricate synthetic geometry.\`);`;

if (code.includes(target)) {
  fs.writeFileSync(file, code.replace(target, replacement));
  console.log('Patched');
} else {
  console.log('Target not found');
}
