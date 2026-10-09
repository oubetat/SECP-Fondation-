import { AdvancedAssemblyEngine } from './src/engine/patch035/AdvancedAssemblyEngine.ts';
import { BomEngine } from './src/engine/bomEngine.ts';

console.log("=== ASSEMBLY TEST ===");
const asm = new AdvancedAssemblyEngine();
asm.addMate({ id: 'm1', componentAId: 'A', componentBId: 'B', type: 'RIGID', degreesOfFreedomLocked: 6, offsetVector: [0, 0, 0] });
const resA = AdvancedAssemblyEngine.detectInterferences(['A', 'B']); // Overlapping/Same pos
console.log("Assembly A (Overlapping):", resA);

const asm2 = new AdvancedAssemblyEngine();
asm2.addMate({ id: 'm2', componentAId: 'A', componentBId: 'B', type: 'RIGID', degreesOfFreedomLocked: 6, offsetVector: [1000, 1000, 1000] });
const resB = AdvancedAssemblyEngine.detectInterferences(['A', 'B']); // Far apart
console.log("Assembly B (Separated):", resB);

console.log("\n=== BOM TEST ===");
const bomA = BomEngine.generateAssemblyBom('Assembly_A_Motor_Arm');
const bomB = BomEngine.generateAssemblyBom('Assembly_B_Motor_4Arms');
console.log("BOM A Total Items:", bomA.totalItemCount, "First Item:", bomA.items[0].description);
console.log("BOM B Total Items:", bomB.totalItemCount, "First Item:", bomB.items[0].description);
