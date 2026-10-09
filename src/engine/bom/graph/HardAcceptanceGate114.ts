import { BOMGraphData, BOMItemType, QuantityBasis, UnitOfMeasure, BOMEdgeType, SourcingType, BOMLifecycleState } from './types';
import { BOMGraphEngine } from './BOMGraphEngine';
import { BOMValidator } from './BOMValidator';
import { BOMCanonicalizer } from './BOMCanonicalizer';
import { BOMRollupEngine } from './BOMRollupEngine';
import { BOMDiffEngine } from './BOMDiffEngine';
import { BOMDependencyGraph } from './BOMDependencyGraph';

export class HardAcceptanceGate114 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const checks = [];

    // 1. Basic Structure
    const bom: BOMGraphData = {
      bomId: 'BOM-001',
      bomRevision: 'A',
      configurationId: 'DEFAULT',
      nodes: [
        {
          bomNodeId: 'NODE-1',
          itemType: BOMItemType.ASSEMBLY,
          partId: 'P-001',
          partRevision: '1.0',
          assemblyId: 'A-001',
          assemblyRevision: '1.0',
          occurrenceIds: ['OCC-1'],
          parentBomNodeId: null,
          quantity: 1,
          unitOfMeasure: UnitOfMeasure.EA,
          quantityBasis: QuantityBasis.OCCURRENCE_COUNT,
          configurationState: 'DEFAULT',
          effectivity: [],
          lifecycleState: BOMLifecycleState.RELEASED,
          sourcingType: SourcingType.MAKE,
          sourceReference: { sourceType: 'ASSEMBLY', sourceId: 'A-001', sourceRevision: '1.0', sourceAssemblyRevision: '1.0' }
        },
        {
          bomNodeId: 'NODE-2',
          itemType: BOMItemType.PART,
          partId: 'P-002',
          partRevision: '1.0',
          assemblyId: 'A-001',
          assemblyRevision: '1.0',
          occurrenceIds: ['OCC-2', 'OCC-3'],
          parentBomNodeId: 'NODE-1',
          quantity: 2,
          unitOfMeasure: UnitOfMeasure.EA,
          quantityBasis: QuantityBasis.OCCURRENCE_COUNT,
          configurationState: 'DEFAULT',
          effectivity: [],
          lifecycleState: BOMLifecycleState.RELEASED,
          sourcingType: SourcingType.BUY,
          sourceReference: { sourceType: 'ASSEMBLY', sourceId: 'A-001', sourceRevision: '1.0', sourceAssemblyRevision: '1.0' }
        }
      ],
      edges: [
        {
          edgeId: 'EDGE-1',
          parentNodeId: 'NODE-1',
          childNodeId: 'NODE-2',
          edgeType: BOMEdgeType.REQUIRES,
          quantity: 2,
          unitOfMeasure: UnitOfMeasure.EA,
          sequence: 10,
          effectivity: []
        }
      ],
      substitutes: []
    };

    const errors = BOMValidator.validate(bom);
    checks.push({
      checkId: 'GATE-114-01',
      name: 'BOM Graph Validation & Part Separation',
      passed: errors.length === 0,
      details: errors.length === 0 ? 'Passed without errors' : `Errors: ${errors.join(', ')}`
    });

    // 2. Quantity Rollup
    const totals = BOMRollupEngine.calculateTotalQuantities(bom);
    const passedRollup = totals.get('NODE-2') === 2 && totals.get('NODE-1') === 1;
    checks.push({
      checkId: 'GATE-114-02',
      name: 'Deterministic Quantity Roll-Up',
      passed: passedRollup,
      details: `Totals calculated properly. Node-2: ${totals.get('NODE-2')}`
    });

    // 3. Diff Engine
    const bom2 = JSON.parse(JSON.stringify(bom)) as BOMGraphData;
    bom2.nodes[1].quantity = 4;
    bom2.edges[0].quantity = 4;
    
    const diff = BOMDiffEngine.diff(bom, bom2);
    const passedDiff = diff.changes.length === 1 && diff.changes[0].type === 'CHANGED_QUANTITY';
    checks.push({
      checkId: 'GATE-114-03',
      name: 'Semantic BOM Diff Engine',
      passed: passedDiff,
      details: 'Detected CHANGED_QUANTITY accurately'
    });

    // 4. Traceability & Where-Used
    const whereUsed = BOMDependencyGraph.whereUsed('NODE-2', bom);
    const passedWhereUsed = whereUsed.length === 1 && whereUsed[0] === 'NODE-1';
    checks.push({
      checkId: 'GATE-114-04',
      name: 'Where-Used Impact Analysis',
      passed: passedWhereUsed,
      details: 'Found parent dependencies accurately'
    });

    // 5. Canonicalization & Determinism
    const hash1 = BOMCanonicalizer.computeHash(bom);
    const hash2 = BOMCanonicalizer.computeHash(bom2);
    const passedHash = hash1 !== hash2 && hash1.length === 64;
    checks.push({
      checkId: 'GATE-114-05',
      name: 'Deterministic Hashing & Tamper Detection',
      passed: passedHash,
      details: `Hashes differentiate state: ${hash1.substring(0, 8)} != ${hash2.substring(0, 8)}`
    });

    // 6. Security Negative Attack (Cycles)
    const bomCyclic = JSON.parse(JSON.stringify(bom)) as BOMGraphData;
    bomCyclic.edges.push({
      edgeId: 'EDGE-2',
      parentNodeId: 'NODE-2',
      childNodeId: 'NODE-1', // cycle
      edgeType: BOMEdgeType.REQUIRES,
      quantity: 1,
      unitOfMeasure: UnitOfMeasure.EA,
      sequence: 20,
      effectivity: []
    });
    const errorsCycle = BOMValidator.validate(bomCyclic);
    const passedCycle = errorsCycle.includes('BOM_CYCLE');
    checks.push({
      checkId: 'GATE-114-06',
      name: 'Containment Cycle Prevention',
      passed: passedCycle,
      details: 'Detected BOM_CYCLE securely'
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
