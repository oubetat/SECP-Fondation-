import { describe, it, expect } from 'vitest';
import { FeatureRegenerationEngine324 } from '../FeatureRegenerationEngine324';
import { 
  ParametricFeatureTree, 
  FeatureType, 
  ClassificationStatus, 
  ConfidenceLevel, 
  ParameterType 
} from '../ParametricFeatureTypes324';

/**
 * SECP-083 — FINAL FORENSIC EVIDENCE SUITE
 * 
 * This suite provides the empirical proof for the Engineering Truth Closure.
 */
describe('PATCH-SECP-083: Forensic Evidence Reconciliation', () => {

  const createBaseTree = (id: string, params: Record<string, number>): ParametricFeatureTree => {
    return {
      id: `TREE-${id}`,
      rootId: id,
      features: [
        {
          id: id,
          name: `Pad_${id}`,
          type: FeatureType.EXTRUDE,
          status: ClassificationStatus.RECONSTRUCTED,
          confidence: ConfidenceLevel.HIGH,
          confidenceScore: 1.0,
          parameters: Object.entries(params).map(([name, value]) => ({
            id: `PARAM-${name}`,
            name,
            type: ParameterType.LENGTH,
            value,
            unit: 'mm'
          })),
          references: [],
          isSuppressed: false
        }
      ],
      version: 1,
      metadata: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
    };
  };

  it('POINT 2: Dependency Truth Proof', () => {
    console.log('\n--- POINT 2: Dependency Truth ---');
    
    // A. Valid dependency
    const validTree = createBaseTree('BASE', { depthMm: 10 });
    validTree.features.push({
      id: 'HOLE',
      name: 'Hole',
      type: FeatureType.HOLE,
      parentId: 'BASE',
      parameters: [{ id: 'D1', name: 'diameterMm', type: ParameterType.LENGTH, value: 10 }],
      status: ClassificationStatus.RECONSTRUCTED,
      confidence: ConfidenceLevel.HIGH,
      confidenceScore: 1,
      references: ['BASE'],
      isSuppressed: false
    });
    const resA = FeatureRegenerationEngine324.rebuild(validTree);
    console.log(`A. Valid dependency: ${resA.isValid ? 'PASS' : 'FAIL'} (Volume: ${resA.solidVolumeMm3})`);
    expect(resA.isValid).toBe(true);

    // B. Missing dependency
    const missingTree = JSON.parse(JSON.stringify(validTree));
    missingTree.features[1].parentId = 'MISSING_PARENT';
    missingTree.features[1].references = ['MISSING_PARENT'];
    const resB = FeatureRegenerationEngine324.rebuild(missingTree);
    console.log(`B. Missing dependency: ${resB.isValid ? 'PASS' : 'FAIL'} (Message: ${resB.errors[0]})`);
    expect(resB.isValid).toBe(false);
    expect(resB.errors[0]).toContain('Broken dependency');

    // D. Valid Step-N alias
    const aliasTree = JSON.parse(JSON.stringify(validTree));
    aliasTree.features[1].parentId = 'Step 1'; // Alias for first feature
    aliasTree.features[1].references = ['Step 1'];
    const resD = FeatureRegenerationEngine324.rebuild(aliasTree);
    console.log(`D. Step-N Alias dependency: ${resD.isValid ? 'PASS' : 'FAIL'} (Volume: ${resD.solidVolumeMm3})`);
    expect(resD.isValid).toBe(true);
    expect(resD.solidVolumeMm3).toBe(resA.solidVolumeMm3);

    // E. Dependency cycle
    const cycleTree = JSON.parse(JSON.stringify(validTree));
    cycleTree.features[0].parentId = 'HOLE'; // A depends on B
    cycleTree.features[0].references = ['HOLE']; // B already depends on A
    const resE = FeatureRegenerationEngine324.rebuild(cycleTree);
    console.log(`E. Dependency cycle: ${resE.isValid ? 'PASS' : 'FAIL'} (Message: ${resE.errors[0]})`);
    expect(resE.isValid).toBe(false);
    expect(resE.errors[0]).toContain('Circular dependency');
  });

  it('POINT 3 & 6: ID Independence & True Parametric Causality', () => {
    console.log('\n--- POINT 3 & 6: ID Independence & Causality ---');
    
    // Model A: IDs = ALPHA
    const modelA = createBaseTree('PAD_ALPHA', { depthMm: 10, widthMm: 100, lengthMm: 100 });
    const resA = FeatureRegenerationEngine324.rebuild(modelA);
    
    // Model B: IDs = RANDOM_731 (Same parameters)
    const modelB = createBaseTree('PAD_RANDOM_731', { depthMm: 10, widthMm: 100, lengthMm: 100 });
    const resB = FeatureRegenerationEngine324.rebuild(modelB);
    
    console.log(`ID Independence: Model A (PAD_ALPHA) Volume = ${resA.solidVolumeMm3}`);
    console.log(`ID Independence: Model B (PAD_RANDOM_731) Volume = ${resB.solidVolumeMm3}`);
    expect(resA.solidVolumeMm3).toBe(resB.solidVolumeMm3);
    expect(resA.topologySummary?.facesCount).toBe(resB.topologySummary?.facesCount);

    // Causality check
    const modelAMod = createBaseTree('PAD_ALPHA', { depthMm: 20, widthMm: 100, lengthMm: 100 });
    const resAMod = FeatureRegenerationEngine324.rebuild(modelAMod);
    console.log(`Causality: Depth 10 -> 20 | Volume ${resA.solidVolumeMm3} -> ${resAMod.solidVolumeMm3}`);
    expect(resAMod.solidVolumeMm3).toBe(resA.solidVolumeMm3 * 2);
  });

  it('POINT 4: True Topology Lineage', () => {
    console.log('\n--- POINT 4: Topology Lineage ---');
    
    const tree = createBaseTree('SOT_PAD', { depthMm: 10, widthMm: 100, lengthMm: 100 });
    const res1 = FeatureRegenerationEngine324.rebuild(tree);
    const ids1 = res1.topologySummary?.faceIds || [];
    console.log('Original IDs (Pad Only):', ids1.slice(0, 3), '...');

    tree.features.push({
      id: 'HOLE_BETA',
      name: 'Hole',
      type: FeatureType.HOLE,
      parentId: 'SOT_PAD',
      parameters: [{ id: 'D1', name: 'diameterMm', type: ParameterType.LENGTH, value: 20 }],
      status: ClassificationStatus.RECONSTRUCTED,
      confidence: ConfidenceLevel.HIGH,
      confidenceScore: 1,
      references: ['SOT_PAD'],
      isSuppressed: false
    });

    const res2 = FeatureRegenerationEngine324.rebuild(tree);
    const ids2 = res2.topologySummary?.faceIds || [];
    console.log('New IDs (Pad + Hole):', ids2.length, 'total');
    
    // Check preservation
    const preserved = ids1.every(id => ids2.includes(id));
    console.log(`Lineage: Pad IDs preserved? ${preserved}`);
    expect(preserved).toBe(true);

    // Check new IDs
    const newIds = ids2.filter(id => !ids1.includes(id));
    console.log('New IDs generated:', newIds);
    expect(newIds.some(id => id.includes('HOLE_BETA'))).toBe(true);
    
    // Check for duplicates
    const duplicates = ids2.filter((item, index) => ids2.indexOf(item) !== index);
    console.log(`Duplicates check: ${duplicates.length === 0 ? 'CLEAN' : 'FAIL'}`);
    expect(duplicates.length).toBe(0);
  });

  it('POINT 5 & 7: Serialization Round-trip & Determinism', () => {
    console.log('\n--- POINT 5 & 7: Serialization & Determinism ---');
    
    const tree = createBaseTree('REGEN_SOT', { depthMm: 15, widthMm: 120, lengthMm: 120 });
    tree.features.push({
      id: 'HOLE_1',
      name: 'Hole',
      type: FeatureType.HOLE,
      parentId: 'REGEN_SOT',
      parameters: [{ id: 'D1', name: 'diameterMm', type: ParameterType.LENGTH, value: 10 }],
      status: ClassificationStatus.RECONSTRUCTED,
      confidence: ConfidenceLevel.HIGH,
      confidenceScore: 1,
      references: ['REGEN_SOT'],
      isSuppressed: false
    });

    const res1 = FeatureRegenerationEngine324.rebuild(tree);
    
    // 1. Serialization
    const serialized = JSON.stringify(tree);
    const deserialized = JSON.parse(serialized) as ParametricFeatureTree;
    const res2 = FeatureRegenerationEngine324.rebuild(deserialized);

    console.log(`Round-trip: Original Volume = ${res1.solidVolumeMm3}, Restored = ${res2.solidVolumeMm3}`);
    expect(res1.solidVolumeMm3).toBe(res2.solidVolumeMm3);
    expect(res1.topologySummary?.facesCount).toBe(res2.topologySummary?.facesCount);
    expect(res1.topologySummary?.faceIds).toEqual(res2.topologySummary?.faceIds);

    // 2. Determinism (Run twice from clean state)
    const res3 = FeatureRegenerationEngine324.rebuild(tree);
    console.log(`Determinism: Run 1 vs Run 3 Volume matching? ${res1.solidVolumeMm3 === res3.solidVolumeMm3}`);
    expect(res1.solidVolumeMm3).toBe(res3.solidVolumeMm3);
    expect(res1.topologySummary?.faceIds).toEqual(res3.topologySummary?.faceIds);
  });
});
