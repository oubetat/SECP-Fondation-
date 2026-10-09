const { GCSIndependentGeometricOracle } = require('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle');

console.log('=== BENCH-TRUTH-009 — ORACLE KILL TEST ===');

function run(label, entities, constraints, fakeSolverResult) {
  try {
    const r = GCSIndependentGeometricOracle.verify(
      entities,
      constraints,
      fakeSolverResult
    );

    console.log(`\n[${label}]`);
    console.log(JSON.stringify(r, null, 2));
    return r;
  } catch (e) {
    console.log(`\n[${label}] EXCEPTION`);
    console.log(e.stack);
    return null;
  }
}

const entities = {
  p1: {
    id: 'p1',
    name: 'P1',
    type: 'POINT_3D',
    geometry: {
      type: 'POINT_3D',
      data: { x: 0, y: 0, z: 0 }
    }
  },
  p2: {
    id: 'p2',
    name: 'P2',
    type: 'POINT_3D',
    geometry: {
      type: 'POINT_3D',
      data: { x: 3, y: 4, z: 0 }
    }
  }
};

const contradictoryConstraint = [{
  constraintId: 'KILL-DISTANCE',
  type: 'DISTANCE',
  entities: [
    { entityId: 'p1' },
    { entityId: 'p2' }
  ],
  parameters: {
    targetDistance: 100
  },
  tolerance: 1e-7,
  priority: 100,
  driving: true
}];

const truthfulSolverResult = {
  entities,
  state: 'SOLVED',
  converged: true,
  residualNorm: 0,
  dofReport: {
    remainingDOF: 0,
    redundantConstraintCount: 0
  }
};

const r1 = run(
  'KILL-001 — Actual distance 5 vs required 100',
  entities,
  contradictoryConstraint,
  truthfulSolverResult
);

const lyingSolverResult = {
  ...truthfulSolverResult,
  residualNorm: 0,
  state: 'SOLVED',
  converged: true
};

const r2 = run(
  'KILL-002 — Solver claims perfect solution despite geometry violation',
  entities,
  contradictoryConstraint,
  lyingSolverResult
);

console.log('\n=== FINAL ORACLE KILL TEST ===');

const v1 = r1?.verdict;
const v2 = r2?.verdict;

console.log(`KILL-001 verdict: ${v1}`);
console.log(`KILL-002 verdict: ${v2}`);

if (v1 === 'FAIL' && v2 === 'FAIL') {
  console.log('ORACLE_INDEPENDENCE_CONFIRMED');
} else {
  console.log('ORACLE_INDEPENDENCE_NOT_CONFIRMED');
}
