import { readFileSync, writeFileSync } from 'fs';

const path = 'src/verification/patch034/__tests__/KernelIntegration-001.test.ts';
let code = readFileSync(path, 'utf8');

// Add import
if (!code.includes('BooleanValidator')) {
  code = code.replace("import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';", "import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';\nimport { BooleanValidator } from '../../../engine/cad-kernel/boolean/BooleanValidator';");
}

// Add volume check for V1
code = code.replace('expect(evidence20.geometryHash).toBeDefined();', `expect(evidence20.geometryHash).toBeDefined();

    const vol20 = BooleanValidator.computeSolidVolume(solid20 as any);
    expect(Math.round(vol20)).toBe(100000);`);

// Add volume check for V2
code = code.replace('const evidence40 = BRepHasher.computeEvidence(solid40);', `const evidence40 = BRepHasher.computeEvidence(solid40);
    const vol40 = BooleanValidator.computeSolidVolume(solid40 as any);
    expect(Math.round(vol40)).toBe(200000);`);

// Add geometric proof check
code = code.replace('// Proof of Real Causal Change: Geometry must change, topology must be identical', `// Proof of Real Causal Change: Parameter -> Volume -> Geometry -> Topology -> Hash
    expect(Math.round(vol20)).not.toEqual(Math.round(vol40));

    // Proof of Real Causal Change: Geometry must change, topology must be identical`);

// Do we need to do it for Undo and Redo as well?
code = code.replace('const evidenceUndo = BRepHasher.computeEvidence(regenUndo.finalGeometry);', `const evidenceUndo = BRepHasher.computeEvidence(regenUndo.finalGeometry);
    const volUndo = BooleanValidator.computeSolidVolume(regenUndo.finalGeometry as any);
    expect(Math.round(volUndo)).toBe(100000);`);

code = code.replace('const evidenceRedo = BRepHasher.computeEvidence(regenRedo.finalGeometry);', `const evidenceRedo = BRepHasher.computeEvidence(regenRedo.finalGeometry);
    const volRedo = BooleanValidator.computeSolidVolume(regenRedo.finalGeometry as any);
    expect(Math.round(volRedo)).toBe(200000);`);

writeFileSync(path, code);
console.log("Done");
