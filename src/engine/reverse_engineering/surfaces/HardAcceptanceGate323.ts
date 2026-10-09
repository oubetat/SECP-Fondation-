import { NURBSEngine322 } from './NURBSEngine322';
import { BRepReconstructionEngine323 } from './BRepReconstructionEngine323';
import { BRepValidator323 } from './BRepValidator323';
import { BRepValidationReport } from './BRepReconstructionTypes323';
import { AnalyticalSurface321A } from './AnalyticalSurfaceTypes321A';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';

export class HardAcceptanceGate323 {
  public static runGate(): { passed: boolean; report: BRepValidationReport | { error: string } } {
    // 1. Analytical Ground Truth
    const sphereSurface: AnalyticalSurface321A = {
      surfaceId: 'analytical_sphere_1',
      surfaceType: 'SPHERE',
      parameters: { center: [0, 0, 0], radius: 100 },
      provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
    };

    // 2. NURBS Generation
    const nurbsEngine = NURBSEngine322.getInstance();
    const nurbs = nurbsEngine.reconstructNURBS(sphereSurface);
    if (!nurbs) {
      return { passed: false, report: { error: 'NURBS Reconstruction Failed' } };
    }

    // 3. B-Rep Reconstruction
    const brepEngine = BRepReconstructionEngine323;
    const model = brepEngine.reconstructPrimitive(nurbs);

    // 4. Independent Validation
    const nurbsMap = new Map();
    nurbsMap.set(nurbs.surfaceId, nurbs);
    const analyticalMap = new Map();
    analyticalMap.set(nurbs.surfaceId, sphereSurface);

    const validation = BRepValidator323.validate(model, nurbsMap, analyticalMap);
    model.validationReport = validation;

    // 5. Evidence Bus
    const evidenceBus = EvidenceBus314.getInstance();
    evidenceBus.registerEvidence(
      'CAD_KERNEL',
      model.modelId,
      'REVISION-323',
      'BREP_RECONSTRUCTION_COMPLETED',
      {
        modelId: model.modelId,
        sourceNurbsIds: [nurbs.surfaceId],
        vertexCount: validation.topology.vertexCount,
        edgeCount: validation.topology.edgeCount,
        faceCount: validation.topology.faceCount,
        shellCount: validation.topology.shellCount,
        solidCount: validation.topology.solidCount,
        manifoldStatus: validation.topology.isManifold ? 'MANIFOLD' : 'NON_MANIFOLD',
        closedStatus: validation.topology.isClosed ? 'CLOSED' : 'OPEN',
        eulerCharacteristic: validation.topology.eulerCharacteristic,
        rmsDeviationMm: validation.geometry.rmsDeviationMm,
        maxDeviationMm: validation.geometry.maxDeviationMm,
        validationPassed: validation.isValid
      },
      validation.isValid ? 'VALIDATED' : 'INVALID'
    );

    return {
      passed: validation.isValid,
      report: validation
    };
  }
}
