const { GCSIndependentGeometricOracle } = require('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle');

console.log('=== BENCH-TRUTH-009 — ORACLE KILL TEST V2 ===');

function run(label, entities, constraints) {
  try {
    const r = GCSIndependentGeometricOracle.verify(
      entities,
      constraints,
      {} // solverResult ignored by verify
    );

    console.log(`\n[${label}]`);
    console.log(`Verdict: ${r.verdict}`);
    console.log(`Max Error: ${r.maxError}`);
    if (r.violations && r.violations.length > 0) {
      console.log(`Violations: ${r.violations[0]}`);
    }
    return r;
  } catch (e) {
    console.log(`\n[${label}] EXCEPTION`);
    console.log(e.stack);
    return null;
  }
}

// Oracle expects x, y, z at top level of entity
const entities = {
  p1: { id: 'p1', type: 'POINT_3D', x: 0, y: 0, z: 0 },
  p2: { id: 'p2', type: 'POINT_3D', x: 3, y: 4, z: 0 } // Actual dist = 5
};

// Oracle expects entityIds as array of strings
const contradictoryConstraint = [{
  id: 'KILL-DISTANCE',
  type: 'DISTANCE',
  entityIds: ['p1', 'p2'],
  value: 100,
  tolerance: 1e-7
}];

run('KILL-V2-001 — Correct Schema, Wrong Geometry (5 vs 100)', entities, contradictoryConstraint);

const correctEntities = {
  p1: { id: 'p1', type: 'POINT_3D', x: 0, y: 0, z: 0 },
  p2: { id: 'p2', type: 'POINT_3D', x: 100, y: 0, z: 0 } // Actual dist = 100
};

run('KILL-V2-002 — Correct Schema, Correct Geometry (100 vs 100)', correctEntities, contradictoryConstraint);

