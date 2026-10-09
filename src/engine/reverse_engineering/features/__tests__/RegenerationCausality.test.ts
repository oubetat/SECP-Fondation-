import { describe, it, expect } from 'vitest';
import { FeatureRegenerationEngine324 } from '../FeatureRegenerationEngine324';
import { 
  ParametricFeatureTree, 
  FeatureType, 
  ClassificationStatus, 
  ConfidenceLevel, 
  ParameterType 
} from '../ParametricFeatureTypes324';

describe('PATCH-SECP-083: Parametric Feature Reconstruction Truth', () => {
  const createBaseTree = (id: string, thickness: number): ParametricFeatureTree => {
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
          confidenceScore: 0.98,
          parameters: [
            {
              id: 'PARAM-DEPTH',
              name: 'depthMm',
              type: ParameterType.LENGTH,
              value: thickness,
              unit: 'mm'
            },
            {
              id: 'PARAM-WIDTH',
              name: 'widthMm',
              type: ParameterType.LENGTH,
              value: 120,
              unit: 'mm'
            },
            {
              id: 'PARAM-LENGTH',
              name: 'lengthMm',
              type: ParameterType.LENGTH,
              value: 120,
              unit: 'mm'
            }
          ],
          references: [],
          isSuppressed: false
        }
      ],
      version: 1,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  };

  it('PHASE 3: Should demonstrate causality between parameter change and geometry change with arbitrary IDs', () => {
    // 1. Initial State (10mm thickness) - ID: PAD_ALPHA
    const tree10 = createBaseTree('PAD_ALPHA', 10);
    const result10 = FeatureRegenerationEngine324.rebuild(tree10);
    
    expect(result10.isValid).toBe(true);
    const vol10 = result10.solidVolumeMm3 || 0;
    
    // 2. Modified State (20mm thickness) - ID: PAD_BETA
    const tree20 = createBaseTree('PAD_BETA', 20);
    const result20 = FeatureRegenerationEngine324.rebuild(tree20);
    
    expect(result20.isValid).toBe(true);
    const vol20 = result20.solidVolumeMm3 || 0;
    
    // 3. Verify Change
    expect(vol20).toBeGreaterThan(vol10);
    expect(vol20).toBeCloseTo(vol10 * 2, 0);
    
    // Verify ID independence in face lineage
    expect(result10.topologySummary?.faceIds?.[0]).toContain('PAD_ALPHA');
    expect(result20.topologySummary?.faceIds?.[0]).toContain('PAD_BETA');
  });

  it('PHASE 4: Should fail when dependency is missing and report broken reference', () => {
    const tree: ParametricFeatureTree = {
      id: 'TREE-MISSING-DEP',
      rootId: 'FEAT-HOLE-001',
      features: [
        {
          id: 'FEAT-HOLE-001',
          name: 'Hole_001',
          type: FeatureType.HOLE,
          status: ClassificationStatus.RECONSTRUCTED,
          confidence: ConfidenceLevel.HIGH,
          confidenceScore: 0.9,
          parentId: 'NON_EXISTENT_PARENT', 
          parameters: [],
          references: ['NON_EXISTENT_PARENT'],
          isSuppressed: false
        }
      ],
      version: 1,
      metadata: { createdAt: '', updatedAt: '' }
    };

    const result = FeatureRegenerationEngine324.rebuild(tree);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Broken dependency');
    expect(result.errors[0]).toContain('NON_EXISTENT_PARENT');
  });

  it('PHASE 4: Should detect dependency cycles', () => {
    // Note: Our converter handles linear trees well, but we need to prove cycle detection
    // if the kernel logic is called.
    const tree: ParametricFeatureTree = {
      id: 'TREE-CYCLE',
      rootId: 'FEAT-A',
      features: [
        {
          id: 'FEAT-A',
          name: 'A',
          type: FeatureType.EXTRUDE,
          parentId: 'FEAT-B',
          parameters: [{ id: 'P1', name: 'depthMm', type: ParameterType.LENGTH, value: 10 }],
          status: ClassificationStatus.RECONSTRUCTED,
          confidence: ConfidenceLevel.HIGH,
          confidenceScore: 1,
          references: ['FEAT-B'],
          isSuppressed: false
        },
        {
          id: 'FEAT-B',
          name: 'B',
          type: FeatureType.EXTRUDE,
          parentId: 'FEAT-A', // Cycle A -> B -> A
          parameters: [{ id: 'P1', name: 'depthMm', type: ParameterType.LENGTH, value: 10 }],
          status: ClassificationStatus.RECONSTRUCTED,
          confidence: ConfidenceLevel.HIGH,
          confidenceScore: 1,
          references: ['FEAT-A'],
          isSuppressed: false
        }
      ],
      version: 1,
      metadata: { createdAt: '', updatedAt: '' }
    };

    const result = FeatureRegenerationEngine324.rebuild(tree);
    // Cycle detection happens in updateFeatureParameter or recomputeTree
    // If the converter just passes it, the kernel might loop or recomputeTree might catch it
    // Our buildFromPlan currently doesn't check cycles immediately but updateFeatureParameter does.
    // Let's see if we can trigger it.
    // Actually NativeCADFeatureKernel.detectCircularDependencies is available.
    
    // We expect failure if we try to compute a cycle
    expect(result.isValid).toBe(false);
  });

  it('PHASE 5: Should prove topology lineage and ID preservation', () => {
    // 1. Base Pad
    const treePad = createBaseTree('BASE_PAD', 10);
    const resultPad = FeatureRegenerationEngine324.rebuild(treePad);
    const facesPad = resultPad.topologySummary?.faceIds || [];
    
    expect(facesPad.length).toBe(6);
    expect(facesPad[0]).toBe('BASE_PAD_Face_0');

    // 2. Add Hole - New IDs generated for hole, Pad IDs preserved
    const treeHole = createBaseTree('BASE_PAD', 10);
    treeHole.features.push({
      id: 'MOUNTING_HOLE',
      name: 'Hole_1',
      type: FeatureType.HOLE,
      status: ClassificationStatus.RECONSTRUCTED,
      confidence: ConfidenceLevel.HIGH,
      confidenceScore: 0.95,
      parentId: 'BASE_PAD',
      parameters: [{ id: 'D1', name: 'diameterMm', type: ParameterType.LENGTH, value: 10 }],
      references: ['BASE_PAD'],
      isSuppressed: false
    });
    
    const resultHole = FeatureRegenerationEngine324.rebuild(treeHole);
    const facesHole = resultHole.topologySummary?.faceIds || [];
    
    expect(facesHole).toContain('BASE_PAD_Face_0');
    expect(facesHole).toContain('MOUNTING_HOLE_Instance_0_CylFace');
    expect(facesHole.length).toBe(8); // 6 (pad) + 2 (hole cylinder + loop)
  });

  it('PHASE 8: Adversarial - Suppressed feature should not contribute to geometry', () => {
    const tree = createBaseTree('PAD', 10);
    tree.features.push({
      id: 'HOLE',
      name: 'Hole',
      type: FeatureType.HOLE,
      parentId: 'PAD',
      parameters: [{ id: 'D1', name: 'diameterMm', type: ParameterType.LENGTH, value: 10 }],
      status: ClassificationStatus.RECONSTRUCTED,
      confidence: ConfidenceLevel.HIGH,
      confidenceScore: 1,
      references: ['PAD'],
      isSuppressed: true // SUPPRESSED
    });

    const result = FeatureRegenerationEngine324.rebuild(tree);
    const volWithSuppressedHole = result.solidVolumeMm3;
    
    // Volume should be same as pad without hole
    const resultPadOnly = FeatureRegenerationEngine324.rebuild(createBaseTree('PAD', 10));
    expect(volWithSuppressedHole).toBe(resultPadOnly.solidVolumeMm3);
  });

  it('PHASE 3/7: Should prove parametric restoration and round-trip consistency', () => {
    // 1. Initial State (100mm)
    const tree100 = createBaseTree('REGEN_RESTORE', 100);
    const result100 = FeatureRegenerationEngine324.rebuild(tree100);
    const vol100 = result100.solidVolumeMm3;

    // 2. Mutate to 150mm
    const tree150 = createBaseTree('REGEN_RESTORE', 150);
    const result150 = FeatureRegenerationEngine324.rebuild(tree150);
    expect(result150.solidVolumeMm3).not.toBe(vol100);

    // 3. Restore to 100mm
    const treeRestored = createBaseTree('REGEN_RESTORE', 100);
    const resultRestored = FeatureRegenerationEngine324.rebuild(treeRestored);
    
    console.log(`Restoration Proof: Original = ${vol100}, Restored = ${resultRestored.solidVolumeMm3}`);
    expect(resultRestored.solidVolumeMm3).toBe(vol100);

    // 4. Round-trip (Serialize -> Parse -> Rebuild)
    const serialized = JSON.stringify(tree100);
    const parsed = JSON.parse(serialized) as ParametricFeatureTree;
    const resultRoundTrip = FeatureRegenerationEngine324.rebuild(parsed);
    
    expect(resultRoundTrip.solidVolumeMm3).toBe(vol100);
    expect(resultRoundTrip.topologySummary?.facesCount).toBe(result100.topologySummary?.facesCount);
  });

  it('PHASE 4: Should fail when parameters are invalid (Negative depth)', () => {
    const tree = createBaseTree('INVALID_PARAM', -50); // Physically invalid
    const result = FeatureRegenerationEngine324.rebuild(tree);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('PHASE 6: Should demonstrate deterministic behavior', () => {
    const tree = createBaseTree('DETERMINISM', 15);
    const result1 = FeatureRegenerationEngine324.rebuild(tree);
    const result2 = FeatureRegenerationEngine324.rebuild(tree);
    
    expect(result1.solidVolumeMm3).toBe(result2.solidVolumeMm3);
    expect(result1.rebuildTimeMs).toBeDefined();
    expect(result1.isWatertight).toBe(result2.isWatertight);
    expect(result1.topologySummary?.facesCount).toBe(result2.topologySummary?.facesCount);
  });
});
