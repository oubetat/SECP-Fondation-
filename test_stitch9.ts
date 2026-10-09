import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';
import { BooleanTolerance } from './src/engine/cad-kernel/boolean/BooleanTolerance';
import { BooleanClassifier } from './src/engine/cad-kernel/boolean/BooleanClassifier';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);

const face = a.outerShell.orientedFaces.find(f => f.face.id === 'box_f_back')!.face;
const pts = BooleanClassifier.getLoopVertices(face.outerLoop!);
const allPoints = [];
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

// simulate what BooleanSplitter does exactly
const records = splitRes.splitFacesA;
const pointSet = new Set<string>();
for (const record of records) {
  if (record.face.outerLoop) {
    for (const oe of record.face.outerLoop.orientedEdges) {
      if (oe.edge && oe.edge.startVertex) {
        const v = oe.edge.startVertex.geometry;
        const key = BooleanSplitter['getCanonicalVertexId'](v);
        if (!pointSet.has(key)) {
          pointSet.add(key);
          allPoints.push(v);
        }
      }
    }
  }
}

for (let i = 0; i < pts.length; i++) {
  const p1 = pts[i];
  const p2 = pts[(i + 1) % pts.length];
  
  const collinear = [];
  for (const pt of allPoints) {
    if (BooleanTolerance.arePointsCoincident(pt, p1, model) || BooleanTolerance.arePointsCoincident(pt, p2, model)) continue;
    const vec12 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const len12Sq = vec12.x * vec12.x + vec12.y * vec12.y + vec12.z * vec12.z;
    if (len12Sq < 1e-10) continue;
    const vec1p = { x: pt.x - p1.x, y: pt.y - p1.y, z: pt.z - p1.z };
    const dot = vec1p.x * vec12.x + vec1p.y * vec12.y + vec1p.z * vec12.z;
    if (dot > 1e-8 && dot < len12Sq - 1e-8) {
      const t = dot / len12Sq;
      const proj = { x: p1.x + t * vec12.x, y: p1.y + t * vec12.y, z: p1.z + t * vec12.z };
      const dist = Math.hypot(pt.x - proj.x, pt.y - proj.y, pt.z - proj.z);
      if (dist <= model.absoluteLength) {
        collinear.push({ p: pt, dist: t });
      }
    }
  }
  console.log(`Edge ${i}: p1=${JSON.stringify(p1)}, p2=${JSON.stringify(p2)}`);
  for (const col of collinear) {
    console.log(`  collinear: ${JSON.stringify(col.p)} t=${col.dist}`);
  }
}

