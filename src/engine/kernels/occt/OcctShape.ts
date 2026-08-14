/**
 * SECP OCCT Shape
 * Represents an OCCT TopoDS_Shape within the SECP Geometry API.
 */

import { ShapeHandle } from '../../geometry/ShapeHandle';
import { ShapeType, GeometricProperties, BoundingBox, Vector3, MeshResult, ShapeIdentity } from '../../geometry/GeometryTypes';

export class OcctShape implements ShapeHandle {
  constructor(
    public readonly id: string,
    public readonly identity: ShapeIdentity,
    public readonly type: ShapeType,
    private nativeShape: any, // TopoDS_Shape
    private oc: any, // OCCT Instance
    public readonly identityHash?: string,
    public readonly metadata?: any
  ) {}

  async getProperties(): Promise<GeometricProperties> {
    const gprops = new this.oc.GProp_GProps_1();
    const vpropKey = Object.keys(this.oc.BRepGProp).find(k => k.includes('VolumeProperties')) || 'VolumeProperties_1';
    this.oc.BRepGProp[vpropKey](this.nativeShape, gprops, false, false, false);
    
    // Surface properties
    const gpropsSurf = new this.oc.GProp_GProps_1();
    const spropKey = Object.keys(this.oc.BRepGProp).find(k => k.includes('SurfaceProperties')) || 'SurfaceProperties_1';
    this.oc.BRepGProp[spropKey](this.nativeShape, gpropsSurf, false, false);

    // Center of Mass (Centroid)
    const cog = gprops.CentreOfMass();
    const centerOfMass = { x: cog.X(), y: cog.Y(), z: cog.Z() };

    // Topology counting
    let vertexCount = 0;
    const vertexExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (vertexExp.More()) { vertexCount++; vertexExp.Next(); }

    let edgeCount = 0;
    const edgeExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_EDGE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (edgeExp.More()) { edgeCount++; edgeExp.Next(); }

    let faceCount = 0;
    const faceExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (faceExp.More()) { faceCount++; faceExp.Next(); }

    let shellCount = 0;
    const shellExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_SHELL, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (shellExp.More()) { shellCount++; shellExp.Next(); }

    let solidCount = 0;
    const solidExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_SOLID, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (solidExp.More()) { solidCount++; solidExp.Next(); }

    // Shape Validity check
    let isValid = !this.nativeShape.IsNull();
    const validationMessages: string[] = [];
    
    try {
      if (this.oc.BRepCheck_Analyzer) {
        const analyzer = new this.oc.BRepCheck_Analyzer(this.nativeShape, true);
        isValid = analyzer.IsValid();
        
        if (!isValid) {
          validationMessages.push('BRepCheck found errors in shape topology or geometry.');
          // Detailed status check if available
          const result = analyzer.Result(this.nativeShape);
          if (!result.IsNull()) {
            validationMessages.push('Status: ' + result.Status());
          }
        }
      }
    } catch (e: any) {
      validationMessages.push('Validation exception: ' + (e.message || e));
    }

    return {
      volume: gprops.Mass(),
      surfaceArea: gpropsSurf.Mass(),
      centerOfMass,
      vertexCount,
      edgeCount,
      faceCount,
      shellCount,
      solidCount,
      isValid,
      validationMessages
    };
  }

  async getBoundingBox(): Promise<BoundingBox> {
    const bbox = new this.oc.Bnd_Box();
    this.oc.BRepBndLib.Add(this.nativeShape, bbox, false);
    return {
      min: { x: bbox.CornerMin().X(), y: bbox.CornerMin().Y(), z: bbox.CornerMin().Z() },
      max: { x: bbox.CornerMax().X(), y: bbox.CornerMax().Y(), z: bbox.CornerMax().Z() }
    };
  }

  async tessellate(linearDeflection: number, angularDeflection: number): Promise<MeshResult> {
    // 1. Generate high-fidelity mesh on the native OCCT shape
    new this.oc.BRepMesh_IncrementalMesh_2(this.nativeShape, linearDeflection, false, angularDeflection, false);

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const faceIds: number[] = [];
    let indexOffset = 0;
    let faceIndex = 0;

    // 2. Explore faces
    const explorer = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
      faceIndex++;
      const face = this.oc.TopoDS.Face_1(explorer.Value());
      const location = new this.oc.TopLoc_Location_1();
      const triangulation = this.oc.BRep_Tool.Triangulation(face, location);

      if (!triangulation.IsNull()) {
        const trsf = location.Transformation();
        const nbNodes = triangulation.NbNodes();
        const nbTriangles = triangulation.NbTriangles();

        const surface = this.oc.BRep_Tool.Surface_1(face);
        const hasUV = triangulation.HasUVNodes();
        const orient = face.Orientation();
        const isReversed = (orient === this.oc.TopAbs_Orientation.TopAbs_REVERSED);

        // A. Extract all transformed 3D vertex positions for this face
        const faceNodes: { x: number; y: number; z: number }[] = [];
        const faceUVs: { u: number; v: number }[] = [];

        for (let i = 1; i <= nbNodes; i++) {
          const pnt = triangulation.Node(i);
          pnt.Transform(trsf);
          faceNodes.push({ x: pnt.X(), y: pnt.Y(), z: pnt.Z() });

          if (hasUV) {
            const uv = triangulation.UVNode(i);
            faceUVs.push({ u: uv.X(), v: uv.Y() });
          } else {
            faceUVs.push({ u: 0, v: 0 });
          }
        }

        // B. Extract and filter valid non-degenerate triangles
        interface ValidTriangle {
          idx1: number;
          idx2: number;
          idx3: number;
          normalX: number;
          normalY: number;
          normalZ: number;
        }

        const validTriangles: ValidTriangle[] = [];

        for (let i = 1; i <= nbTriangles; i++) {
          const tri = triangulation.Triangle(i);
          let n1 = tri.Value(1) - 1;
          let n2 = tri.Value(2) - 1;
          let n3 = tri.Value(3) - 1;

          // Apply orientation winding
          if (isReversed) {
            const tmp = n2;
            n2 = n3;
            n3 = tmp;
          }

          // Check for degenerate vertex indices
          if (n1 === n2 || n1 === n3 || n2 === n3) {
            continue;
          }
          if (n1 < 0 || n1 >= nbNodes || n2 < 0 || n2 >= nbNodes || n3 < 0 || n3 >= nbNodes) {
            continue;
          }

          // Compute facet normal from vertices (right-handed CCW rule)
          const p1 = faceNodes[n1];
          const p2 = faceNodes[n2];
          const p3 = faceNodes[n3];

          const e1x = p2.x - p1.x;
          const e1y = p2.y - p1.y;
          const e1z = p2.z - p1.z;

          const e2x = p3.x - p1.x;
          const e2y = p3.y - p1.y;
          const e2z = p3.z - p1.z;

          const crossX = e1y * e2z - e1z * e2y;
          const crossY = e1z * e2x - e1x * e2z;
          const crossZ = e1x * e2y - e1y * e2x;

          const crossMag = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);

          // Skip zero-area / colinear triangles
          if (crossMag < 1e-14) {
            continue;
          }

          validTriangles.push({
            idx1: n1,
            idx2: n2,
            idx3: n3,
            normalX: crossX / crossMag,
            normalY: crossY / crossMag,
            normalZ: crossZ / crossMag
          });
        }

        // C. Calculate True Normals for each node
        const faceNormals: { x: number; y: number; z: number }[] = [];
        const hasBuiltinNormals = typeof triangulation.HasNormals === 'function' && triangulation.HasNormals();

        for (let i = 0; i < nbNodes; i++) {
          let nx = 0, ny = 0, nz = 0;
          let normalFound = false;

          // Strategy 1: Check built-in OCCT triangulation normals
          if (hasBuiltinNormals) {
            try {
              const normDir = triangulation.Normal(i + 1);
              if (normDir) {
                const gpDir = new this.oc.gp_Dir_4(normDir.X(), normDir.Y(), normDir.Z());
                gpDir.Transform(trsf);
                nx = gpDir.X(); ny = gpDir.Y(); nz = gpDir.Z();
                if (isReversed) { nx = -nx; ny = -ny; nz = -nz; }
                normalFound = true;
              }
            } catch {
              // Fallback to next strategy
            }
          }

          // Strategy 2: Evaluate analytical surface normal at UV coordinates
          if (!normalFound && hasUV && surface && !surface.IsNull()) {
            const uv = faceUVs[i];
            try {
              const props = new this.oc.GeomLProp_SLProps_1(surface, uv.u, uv.v, 1, 1e-7);
              if (props.IsNormalDefined()) {
                const norm = props.Normal();
                const normDir = new this.oc.gp_Dir_4(norm.X(), norm.Y(), norm.Z());
                normDir.Transform(trsf);
                nx = normDir.X();
                ny = normDir.Y();
                nz = normDir.Z();
                if (isReversed) { nx = -nx; ny = -ny; nz = -nz; }
                normalFound = true;
              } else {
                // Surface derivatives evaluation
                const gpPnt = new this.oc.gp_Pnt_1();
                const d1u = new this.oc.gp_Vec_1();
                const d1v = new this.oc.gp_Vec_1();
                surface.D1(uv.u, uv.v, gpPnt, d1u, d1v);
                const normVec = d1u.Crossed(d1v);
                if (normVec.SquareMagnitude() > 1e-12) {
                  normVec.Normalize();
                  const normDir = new this.oc.gp_Dir_4(normVec.X(), normVec.Y(), normVec.Z());
                  normDir.Transform(trsf);
                  nx = normDir.X(); ny = normDir.Y(); nz = normDir.Z();
                  if (isReversed) { nx = -nx; ny = -ny; nz = -nz; }
                  normalFound = true;
                }
              }
            } catch {
              // Fallback to geometric triangulation normal accumulation
            }
          }

          // Strategy 3: Real geometric normal derived from adjacent triangulation facets
          if (!normalFound || (nx === 0 && ny === 0 && nz === 0)) {
            let sumX = 0, sumY = 0, sumZ = 0;
            let count = 0;

            for (const tri of validTriangles) {
              if (tri.idx1 === i || tri.idx2 === i || tri.idx3 === i) {
                sumX += tri.normalX;
                sumY += tri.normalY;
                sumZ += tri.normalZ;
                count++;
              }
            }

            if (count > 0) {
              const mag = Math.sqrt(sumX * sumX + sumY * sumY + sumZ * sumZ);
              if (mag > 1e-12) {
                nx = sumX / mag;
                ny = sumY / mag;
                nz = sumZ / mag;
                normalFound = true;
              }
            }
          }

          // Strategy 4: Fallback to average face normal across all valid triangles on this face
          if (!normalFound || (nx === 0 && ny === 0 && nz === 0)) {
            if (validTriangles.length > 0) {
              let avgX = 0, avgY = 0, avgZ = 0;
              for (const tri of validTriangles) {
                avgX += tri.normalX;
                avgY += tri.normalY;
                avgZ += tri.normalZ;
              }
              const avgMag = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
              if (avgMag > 1e-12) {
                nx = avgX / avgMag;
                ny = avgY / avgMag;
                nz = avgZ / avgMag;
              } else {
                nx = validTriangles[0].normalX;
                ny = validTriangles[0].normalY;
                nz = validTriangles[0].normalZ;
              }
            } else {
              // Planar default if face has no triangles
              nx = 0; ny = 0; nz = 1;
            }
          }

          // Normalize normal vector strictly
          const finalLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (finalLen > 1e-12) {
            nx /= finalLen;
            ny /= finalLen;
            nz /= finalLen;
          }

          faceNormals.push({ x: nx, y: ny, z: nz });
        }

        // D. Push face nodes, normals, and UVs to output buffers
        for (let i = 0; i < nbNodes; i++) {
          positions.push(faceNodes[i].x, faceNodes[i].y, faceNodes[i].z);
          normals.push(faceNormals[i].x, faceNormals[i].y, faceNormals[i].z);
          uvs.push(faceUVs[i].u, faceUVs[i].v);
        }

        // E. Push verified non-degenerate triangle indices
        for (const tri of validTriangles) {
          indices.push(
            tri.idx1 + indexOffset,
            tri.idx2 + indexOffset,
            tri.idx3 + indexOffset
          );
          faceIds.push(faceIndex);
        }

        indexOffset += nbNodes;
      }
      explorer.Next();
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      uvs: new Float32Array(uvs),
      faceIds: new Uint32Array(faceIds)
    };
  }

  getNative(): any {
    return this.nativeShape;
  }
}
