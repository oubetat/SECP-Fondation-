# SECP CAD KERNEL PHASE 0B — REPRODUCIBILITY & VERIFICATION GUIDE

**Mission Reference**: `SECP-CAD-KERNEL-PHASE-0B`  
**Purpose**: Provide an exact, executable protocol allowing any independent reviewer or engineer to reproduce every forensic finding reported in Phase 0B.

---

## 1. Reproduction Steps for Verified Strengths

### 1.1 Parametric Regeneration & PLM Causal Flow
To verify that the existing CAD kernel successfully executes topological sorting, deterministic recomputation, and PLM hash propagation:
```bash
npx vitest run src/engine/cad-kernel/__tests__/KernelTruthQualification.test.ts src/engine/cad-kernel/__tests__/BooleanEngine.test.ts
```
**Expected Output**:
- `KernelTruthQualification.test.ts`: 8/8 tests pass.
- `BooleanEngine.test.ts`: 20/20 tests pass.
- Stage 3 through Stage 10 truth chains emit deterministic SHA-256 hashes and invalidate downstream FEA/CFD/CAM artifacts upon parameter edits.

### 1.2 Cox-de Boor Basis Functions
Inspect `src/engine/cad-kernel/nurbs/NurbsBasis.ts`:
- Binary search span discovery: lines 8–31.
- Recurrence evaluation of non-zero basis functions: lines 37–56.
Verify with:
```bash
npx vitest run src/engine/cad-kernel/__tests__/Nurbs.test.ts
```

---

## 2. Reproduction Steps for Verified Gaps

### 2.1 Primitive Polyhedral Approximation
Inspect lines 1097–1140 of `src/engine/cad-kernel/brep/BRepKernel.ts`:
```typescript
// createSphere takes a 2D circle and calls extrudePolygon:
public createSphere(radiusM: Meters, idPrefix = 'sphere'): BRepSolid {
  const heightM = (radiusM * 2) as Meters;
  const segments = 16;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const th = (i / segments) * 2 * Math.PI;
    pts.push({ x: (radiusM as number) * Math.cos(th), y: (radiusM as number) * Math.sin(th) });
  }
  return this.extrudePolygon(pts as any, heightM, idPrefix, undefined, 'm');
}
```
**Observation**: The resulting shape has 18 planar faces (1 bottom, 1 top, 16 lateral quads), representing a 16-sided regular polygonal prism rather than a sphere.

### 2.2 Boolean Engine Surface Restriction
Inspect lines 47–72 of `src/engine/cad-kernel/boolean/BooleanIntersector.ts`:
- The conditional branching checks only `surfA.type === 'PLANE' && surfB.type === 'CYLINDER'` and `surfA.type === 'PLANE' && surfB.type === 'SPHERE'`.
- Any other combination increments `unsupportedCount`.
- In `BooleanEngine.ts` line 111:
```typescript
if (intRes.unsupportedCount > 0) {
  return this.buildResult(op, 'UNSUPPORTED', null, solidA, solidB, model, diagnostics, null);
}
```
**Observation**: Calling `BooleanEngine.execute` on two intersecting cylinders or spheres returns status `UNSUPPORTED`.

### 2.3 Fillet & Chamfer Metadata Spread
Inspect lines 723–729 and 751–757 of `src/engine/cad-kernel/history/FeatureExecution.ts`:
```typescript
return {
  status: 'SUCCESS',
  outputGeometry: { ...targetSolid, id: `${feature.id}_solid`, filletRadius: filParams.radius },
  diagnostics: [`Fillet applied with radius ${filParams.radius}`],
  ...
};
```
**Observation**: No new vertices, edges, or blend faces are created in the B-Rep data structure; the solid object simply receives an extra JavaScript property.

### 2.4 Shell Fixed 0.8 Scaling
Inspect lines 97–107 and 124–133 of `src/engine/cad-kernel/evaluators/ShellEvaluator.ts`:
```typescript
const scale = 0.8;
const inV1 = new BRepVertex(`${edge?.startVertex?.id || 'V'}_inner_${featureId}`, {
  x: v1.x * scale,
  y: v1.y * scale,
  z: Math.max(0, v1.z - thickness)
});
```
**Observation**: The inner cavity coordinates are calculated using `v * 0.8`, which ignores wall thickness in X/Y and produces distorted geometry for off-center parts.

### 2.5 STEP AP242 JSON Serialization
Inspect lines 6–16 of `src/engine/interop/STEPAP242Translator.ts`:
```typescript
public static exportToStepPart21(model: AP242SemanticModel): string {
  return JSON.stringify(model);
}
public static importFromStepPart21(stepText: string): AP242SemanticModel {
  if (stepText.includes('CORRUPTED') || !stepText.trim().startsWith('{')) {
    throw new Error('Malformed STEP Part 21 content or corrupted syntax.');
  }
  return JSON.parse(stepText) as AP242SemanticModel;
}
```
**Observation**: The output is JSON and not ISO 10303-21 standard syntax.

### 2.6 OCCT Package Absence & Static Mock Fallback
Run:
```bash
ls -la node_modules/opencascade.js
```
**Output**: `ls: cannot access 'node_modules/opencascade.js': No such file or directory`  
Inspect `src/engine/kernels/occt/loader.ts` lines 56–271:
- `createBrowserMockOcInstance()` provides mock classes returning constants (`Mass() { return 27000; }`, `CornerMin() { return new MockPnt(-15, -15, -15); }`).
