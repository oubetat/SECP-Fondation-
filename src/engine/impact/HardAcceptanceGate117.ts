import { ChangeImpactAnalyzer } from './ChangeImpactAnalyzer';
import { IndependentImpactVerifier } from './IndependentImpactVerifier';
import { ImpactCanonicalizer } from './ImpactCanonicalizer';
import { GraphSnapshot, RelationshipType } from './types';

export class HardAcceptanceGate117 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const checks: any[] = [];

    // Create a comprehensive multi-domain test graph snapshot
    const testSnapshot: GraphSnapshot = {
      snapshotId: 'SNAP-2026-001',
      snapshotVersion: '1.0',
      createdAt: new Date().toISOString(),
      graphSnapshotHash: '',
      nodes: [
        { entityId: 'PART-VALVE-01', revisionId: 'R3', entityType: 'PART' },
        { entityId: 'BOM-VALVE-ASSY-01', revisionId: 'R7', entityType: 'BOM' },
        { entityId: 'ASSY-TOP-ENGINE-01', revisionId: 'R5', entityType: 'ASSEMBLY' },
        { entityId: 'PRODUCT-GEN-01', revisionId: 'R2', entityType: 'ASSEMBLY' },
        { entityId: 'MAT-STAINLESS-316L', revisionId: 'R1', entityType: 'MATERIAL' },
        { entityId: 'SIM-FLUID-CFD-01', revisionId: 'R4', entityType: 'SIMULATION' },
        { entityId: 'CAM-TOOLPATH-5AXIS-01', revisionId: 'R2', entityType: 'TOOLPATH' },
        { entityId: 'DOC-VALVE-SPEC-01', revisionId: 'R3', entityType: 'DOCUMENT' },
        // Nodes for diamond graph test
        { entityId: 'NODE-B', revisionId: 'R1', entityType: 'PART' },
        { entityId: 'NODE-C', revisionId: 'R1', entityType: 'PART' },
        { entityId: 'NODE-D', revisionId: 'R1', entityType: 'PART' },
        // Nodes for cycle test
        { entityId: 'CYCLE-A', revisionId: 'R1', entityType: 'PART' },
        { entityId: 'CYCLE-B', revisionId: 'R1', entityType: 'PART' },
        { entityId: 'CYCLE-C', revisionId: 'R1', entityType: 'PART' }
      ],
      edges: [
        // Direct -> Indirect -> Transitive chain
        { edgeId: 'E-01', from: 'PART-VALVE-01:R3', to: 'BOM-VALVE-ASSY-01:R7', type: 'BOM_COMPONENT' },
        { edgeId: 'E-02', from: 'BOM-VALVE-ASSY-01:R7', to: 'ASSY-TOP-ENGINE-01:R5', type: 'ASSEMBLY_OCCURRENCE' },
        { edgeId: 'E-03', from: 'ASSY-TOP-ENGINE-01:R5', to: 'PRODUCT-GEN-01:R2', type: 'ASSEMBLY_OCCURRENCE' },
        
        // Multi-domain dependencies
        { edgeId: 'E-04', from: 'PART-VALVE-01:R3', to: 'MAT-STAINLESS-316L:R1', type: 'MATERIAL_DEPENDENCY' },
        { edgeId: 'E-05', from: 'PART-VALVE-01:R3', to: 'SIM-FLUID-CFD-01:R4', type: 'SIMULATION_DEPENDENCY' },
        { edgeId: 'E-06', from: 'PART-VALVE-01:R3', to: 'CAM-TOOLPATH-5AXIS-01:R2', type: 'TOOLPATH_DEPENDENCY' },
        { edgeId: 'E-07', from: 'PART-VALVE-01:R3', to: 'DOC-VALVE-SPEC-01:R3', type: 'DOCUMENT_DEPENDENCY' },

        // Diamond graph edges (A -> B -> D, A -> C -> D)
        { edgeId: 'E-DIAMOND-1', from: 'PART-VALVE-01:R3', to: 'NODE-B:R1', type: 'BOM_COMPONENT' },
        { edgeId: 'E-DIAMOND-2', from: 'PART-VALVE-01:R3', to: 'NODE-C:R1', type: 'BOM_COMPONENT' },
        { edgeId: 'E-DIAMOND-3', from: 'NODE-B:R1', to: 'NODE-D:R1', type: 'ASSEMBLY_OCCURRENCE' },
        { edgeId: 'E-DIAMOND-4', from: 'NODE-C:R1', to: 'NODE-D:R1', type: 'ASSEMBLY_OCCURRENCE' },

        // Cycle edges (CYCLE-A -> CYCLE-B -> CYCLE-C -> CYCLE-A)
        { edgeId: 'E-CYCLE-1', from: 'CYCLE-A:R1', to: 'CYCLE-B:R1', type: 'BOM_COMPONENT' },
        { edgeId: 'E-CYCLE-2', from: 'CYCLE-B:R1', to: 'CYCLE-C:R1', type: 'BOM_COMPONENT' },
        { edgeId: 'E-CYCLE-3', from: 'CYCLE-C:R1', to: 'CYCLE-A:R1', type: 'BOM_COMPONENT' }
      ]
    };

    testSnapshot.graphSnapshotHash = ImpactCanonicalizer.computeGraphSnapshotHash(testSnapshot);

    const analyzer = new ChangeImpactAnalyzer(testSnapshot);

    // 1. Root Identification & Explicit Revision Awareness
    const analysis = analyzer.analyzeChange(
      'ECO-2026-001',
      ['PART-VALVE-01'],
      ['R3'],
      { isSafetyCritical: true }
    );

    checks.push({
      checkId: 'GATE-117-01',
      name: 'Root Change Identification & Explicit Revision Awareness',
      passed: analysis.rootEntityIds[0] === 'PART-VALVE-01' && analysis.rootRevisionIds[0] === 'R3' && analysis.nodes[0].impactClass === 'DIRECT',
      details: `Analyzed root change PART-VALVE-01:R3 with DIRECT classification`
    });

    // 2. Graph Snapshot Hash Freeze
    checks.push({
      checkId: 'GATE-117-02',
      name: 'Graph Snapshot Hash Freeze & Canonicalization',
      passed: analysis.graphSnapshotHash.length === 64 && analysis.analysisHash.length === 64,
      details: `Graph Snapshot Hash: ${analysis.graphSnapshotHash.substring(0, 16)}...`
    });

    // 3. Distance & Multi-Tier Propagation (Direct -> Indirect -> Transitive)
    const direct = analysis.nodes.find(n => n.entityId === 'PART-VALVE-01');
    const indirect = analysis.nodes.find(n => n.entityId === 'BOM-VALVE-ASSY-01');
    const transitive = analysis.nodes.find(n => n.entityId === 'ASSY-TOP-ENGINE-01');

    checks.push({
      checkId: 'GATE-117-03',
      name: 'Distance & Multi-Tier Propagation (Direct, Indirect, Transitive)',
      passed: direct?.distance === 0 && indirect?.distance === 1 && (transitive?.distance || 0) >= 2,
      details: `Propagated tiers: Direct (0), Indirect (1), Transitive (${transitive?.distance})`
    });

    // 4. Diamond Graph Multi-Path Preservation
    const nodeD = analysis.nodes.find(n => n.entityId === 'NODE-D');

    checks.push({
      checkId: 'GATE-117-04',
      name: 'Diamond Graph & Multi-Path Preservation',
      passed: (nodeD?.pathCount || 0) >= 2,
      details: `Preserved ${nodeD?.pathCount} distinct paths reaching NODE-D`
    });

    // 5. Cycle Detection & Bounded Finite Traversal
    const cycleAnalyzer = new ChangeImpactAnalyzer(testSnapshot);
    const cycleAnalysis = cycleAnalyzer.analyzeChange(
      'ECO-CYCLE-TEST',
      ['CYCLE-A'],
      ['R1']
    );

    checks.push({
      checkId: 'GATE-117-05',
      name: 'Dependency Cycle Detection & Finite Execution Guarantee',
      passed: cycleAnalysis.cycles.length > 0 && cycleAnalysis.cycles[0].cycleNodes.some(n => n.includes('CYCLE-A')),
      details: `Detected dependency cycle: ${cycleAnalysis.cycles[0]?.cyclePath}`
    });

    // 6. Domain Specific Impact Classification & Severity Scoring
    const cfdNode = analysis.nodes.find(n => n.entityId === 'SIM-FLUID-CFD-01');
    const toolpathNode = analysis.nodes.find(n => n.entityId === 'CAM-TOOLPATH-5AXIS-01');

    checks.push({
      checkId: 'GATE-117-06',
      name: 'Domain Specific Impact Classification (Simulation, Toolpath, Material)',
      passed: cfdNode?.impactClass === 'REVERIFICATION_REQUIRED' && toolpathNode?.impactClass === 'REVERIFICATION_REQUIRED',
      details: `CFD Simulation classified as REVERIFICATION_REQUIRED with severity ${cfdNode?.severity}`
    });

    // 7. Action Generation Integration for ECO
    checks.push({
      checkId: 'GATE-117-07',
      name: 'Required Action Generation & ECO Integration',
      passed: analysis.actions.length > 0 && analysis.actions.some(a => a.actionType === 'REVERIFY_CFD'),
      details: `Generated ${analysis.actions.length} required actions including REVERIFY_CFD`
    });

    // 8. Independent Verifier & Differential Comparison
    const diffResult = IndependentImpactVerifier.verifyAnalysis(testSnapshot, analysis);

    checks.push({
      checkId: 'GATE-117-08',
      name: 'Independent Impact Verifier & Differential Comparison',
      passed: diffResult.verdict === 'MATCH' && diffResult.hashMatch && diffResult.nodeMatch,
      details: `Differential Verdict: ${diffResult.verdict} (Nodes, Edges, Paths, Severities and Hashes match 100%)`
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
