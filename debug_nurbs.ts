import { NURBSEngine322 } from './src/engine/reverse_engineering/surfaces/NURBSEngine322';
import { NURBSUtils322 } from './src/engine/reverse_engineering/surfaces/NURBSUtils322';
import { AnalyticalSurface321A } from './src/engine/reverse_engineering/surfaces/AnalyticalSurfaceTypes321A';

// 1. Create analytical sphere with EXACT same production parameters
const radius = 50;
const analyticalSphere: AnalyticalSurface321A = {
  surfaceId: 'sphere-1',
  surfaceType: 'SPHERE',
  parameters: { center: [0, 0, 0], radius: radius },
  provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
};

// 2. Reconstruct via production path
const engine = NURBSEngine322.getInstance();
const nurbs = engine.reconstructNURBS(analyticalSphere);

if (!nurbs) {
  console.error('NURBS Reconstruction failed!');
  process.exit(1);
}

const data = nurbs.data;

console.log('=== PRODUCTION PATH SPHERE VALIDATION DETAILS ===');
console.log(`Analytical Sphere Radius: ${radius}`);
console.log(`NURBS Degrees: degreeU = ${data.degreeU}, degreeV = ${data.degreeV}`);
console.log(`Control-Net Dimensions: U = ${data.controlPoints.length}, V = ${data.controlPoints[0].length}`);
console.log(`Knot Vector Lengths: knotsU.length = ${data.knotsU.length}, knotsV.length = ${data.knotsV.length}`);

// Control point rows at the poles
// Pole V=0 is v=0 (index 0 of dimension V). Pole V=1 is v=1 (index 4 of dimension V, since length is 5)
console.log('\n--- Pole Control Points & Weights (V=0, Pole North) ---');
for (let i = 0; i < data.controlPoints.length; i++) {
  const cp = data.controlPoints[i][0];
  const w = data.weights[i][0];
  console.log(`Row U=${i}, V=0: CP = [${cp.x.toFixed(4)}, ${cp.y.toFixed(4)}, ${cp.z.toFixed(4)}], w = ${w.toFixed(4)}`);
}

console.log('\n--- Pole Control Points & Weights (V=4, Pole South) ---');
for (let i = 0; i < data.controlPoints.length; i++) {
  const cp = data.controlPoints[i][4];
  const w = data.weights[i][4];
  console.log(`Row U=${i}, V=4: CP = [${cp.x.toFixed(4)}, ${cp.y.toFixed(4)}, ${cp.z.toFixed(4)}], w = ${w.toFixed(4)}`);
}

// Weights min/max
let minW = Infinity;
let maxW = -Infinity;
for (let i = 0; i < data.controlPoints.length; i++) {
  for (let j = 0; j < data.controlPoints[0].length; j++) {
    const w = data.weights[i][j];
    if (w < minW) minW = w;
    if (w > maxW) maxW = w;
  }
}
console.log(`\nWeights Range: Min Weight = ${minW.toFixed(4)}, Max Weight = ${maxW.toFixed(4)}`);

// Parameter domain
console.log(`Parameter Domain: U in [${data.knotsU[0]}, ${data.knotsU[data.knotsU.length-1]}], V in [${data.knotsV[0]}, ${data.knotsV[data.knotsV.length-1]}]`);

// Evaluations
const evalCoords = [
  [0, 0],
  [0, 0.1],
  [0, 0.2],
  [0.5, 0.5],
  [1, 1]
];

console.log('\n--- Evaluated Points and Distances ---');
evalCoords.forEach(([u, v]) => {
  const result = NURBSUtils322.evaluateSurface(data, u, v);
  const p = result.point;
  const dist = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
  console.log(`Evaluated at (u=${u}, v=${v}): Point = [${p[0].toFixed(6)}, ${p[1].toFixed(6)}, ${p[2].toFixed(6)}], Dist to Center = ${dist.toFixed(6)}, Dev = ${Math.abs(dist - radius).toExponential(4)}`);
});

console.log(`\nReconstructed RMS Deviation: ${nurbs.rmsDeviationMm.toExponential(4)}`);
console.log(`Reconstructed Max Deviation: ${nurbs.maxDeviationMm.toExponential(4)}`);

console.log('\n=== VERIFYING NURBS STRUCTURAL INVARIANTS ===');

// 1. Knot count relationship m = n + p + 1
// For U:
const mU = data.knotsU.length - 1;
const nU = data.controlPoints.length - 1;
const pU = data.degreeU;
const invariantU = mU === nU + pU + 1;
console.log(`U Invariant (m = n + p + 1): ${mU} === ${nU} + ${pU} + 1 -> ${invariantU ? 'PASS' : 'FAIL'}`);

// For V:
const mV = data.knotsV.length - 1;
const nV = data.controlPoints[0].length - 1;
const pV = data.degreeV;
const invariantV = mV === nV + pV + 1;
console.log(`V Invariant (m = n + p + 1): ${mV} === ${nV} + ${pV} + 1 -> ${invariantV ? 'PASS' : 'FAIL'}`);

// 2. Valid nondecreasing knot vectors
let nondecreasingU = true;
for (let i = 0; i < data.knotsU.length - 1; i++) {
  if (data.knotsU[i] > data.knotsU[i+1]) nondecreasingU = false;
}
let nondecreasingV = true;
for (let i = 0; i < data.knotsV.length - 1; i++) {
  if (data.knotsV[i] > data.knotsV[i+1]) nondecreasingV = false;
}
console.log(`Knot Vector U Nondecreasing: ${nondecreasingU ? 'PASS' : 'FAIL'}`);
console.log(`Knot Vector V Nondecreasing: ${nondecreasingV ? 'PASS' : 'FAIL'}`);

// 3. Valid control-net dimensions
const validNetDimensions = data.controlPoints.length > pU && data.controlPoints[0].length > pV;
console.log(`Control Net Dimensions Valid (> degree): ${validNetDimensions ? 'PASS' : 'FAIL'}`);

// 4. Finite control points
let finiteCP = true;
data.controlPoints.forEach(row => {
  row.forEach(cp => {
    if (!Number.isFinite(cp.x) || !Number.isFinite(cp.y) || !Number.isFinite(cp.z)) finiteCP = false;
  });
});
console.log(`Finite Control Points: ${finiteCP ? 'PASS' : 'FAIL'}`);

// 5. Strictly positive finite weights
let positiveWeights = true;
data.weights.forEach(row => {
  row.forEach(w => {
    if (!Number.isFinite(w) || w <= 0) positiveWeights = false;
  });
});
console.log(`Strictly Positive Finite Weights: ${positiveWeights ? 'PASS' : 'FAIL'}`);

// 6. Rational denominator is nonzero and partition of unity over domain grid
let nonzeroDenominator = true;
let partitionOfUnityPass = true;

const testSamples = 20;
for (let i = 0; i <= testSamples; i++) {
  for (let j = 0; j <= testSamples; j++) {
    const u = i / testSamples;
    const v = j / testSamples;
    
    const spanU = NURBSUtils322.findSpan(nU, pU, u, data.knotsU);
    const spanV = NURBSUtils322.findSpan(nV, pV, v, data.knotsV);
    
    const basisU = NURBSUtils322.basisFunctions(spanU, u, pU, data.knotsU);
    const basisV = NURBSUtils322.basisFunctions(spanV, v, pV, data.knotsV);
    
    // Sum of basis functions (partition of unity)
    let sumU = 0;
    for (let k = 0; k <= pU; k++) sumU += basisU[k];
    let sumV = 0;
    for (let k = 0; k <= pV; k++) sumV += basisV[k];
    
    if (Math.abs(sumU - 1.0) > 1e-9 || Math.abs(sumV - 1.0) > 1e-9) {
      partitionOfUnityPass = false;
    }
    
    // Calculate denominator (Sw.w)
    let wSum = 0;
    for (let col = 0; col <= pV; col++) {
      let uSum = 0;
      for (let row = 0; row <= pU; row++) {
        const wVal = data.weights[spanU - pU + row][spanV - pV + col];
        uSum += basisU[row] * wVal;
      }
      wSum += basisV[col] * uSum;
    }
    
    if (wSum <= 1e-9) nonzeroDenominator = false;
  }
}

console.log(`Nonzero Rational Denominator: ${nonzeroDenominator ? 'PASS' : 'FAIL'}`);
console.log(`Basis Function Partition of Unity: ${partitionOfUnityPass ? 'PASS' : 'FAIL'}`);
