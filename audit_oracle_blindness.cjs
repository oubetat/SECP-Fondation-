const { GCSIndependentGeometricOracle } = require('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle');

const entitiesWithNestedData = {
  p1: { id: 'p1', type: 'POINT_3D', geometry: { data: { x: 0, y: 0, z: 0 } } },
  p2: { id: 'p2', type: 'POINT_3D', geometry: { data: { x: 50, y: 50, z: 50 } } } // Distance is ~86.6
};

const coincidentConstraint = [{
  type: 'COINCIDENT',
  entityIds: ['p1', 'p2'],
  tolerance: 1e-7
}];

const report = GCSIndependentGeometricOracle.verify(
  entitiesWithNestedData,
  coincidentConstraint,
  {}
);

console.log('=== ORACLE BLINDNESS TEST ===');
console.log('Actual Geometry: P1(0,0,0), P2(50,50,50)');
console.log('Constraint: COINCIDENT (Expected distance 0)');
console.log('Verdict:', report.verdict);
console.log('Max Error:', report.maxError);
console.log('Reason: Oracle defaults undefined top-level x,y,z to 0, seeing both points at (0,0,0).');

