/**
 * SECP OCCT Shape
 * Represents an OCCT TopoDS_Shape within the SECP Geometry API.
 */

import { ShapeHandle } from '../../geometry/ShapeHandle';
import { ShapeType, GeometricProperties, BoundingBox, Vector3 } from '../../geometry/GeometryTypes';

export class OcctShape implements ShapeHandle {
  constructor(
    public readonly id: string,
    public readonly type: ShapeType,
    private nativeShape: any, // TopoDS_Shape
    private oc: any // OCCT Instance
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
    let faceCount = 0;
    const faceExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (faceExp.More()) { faceCount++; faceExp.Next(); }

    let edgeCount = 0;
    const edgeExp = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_EDGE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (edgeExp.More()) { edgeCount++; edgeExp.Next(); }

    // Shape Validity check
    let isValid = !this.nativeShape.IsNull();
    try {
      if (this.oc.BRepCheck_Analyzer) {
        const analyzer = new this.oc.BRepCheck_Analyzer(this.nativeShape, true);
        isValid = analyzer.IsValid();
      }
    } catch (e) {
      // Fallback
    }

    return {
      volume: gprops.Mass(),
      surfaceArea: gpropsSurf.Mass(),
      centerOfMass,
      faceCount,
      edgeCount,
      isValid
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

  async tessellate(linearDeflection: number, angularDeflection: number): Promise<any> {
    // 1. Generate mesh
    new this.oc.BRepMesh_IncrementalMesh_2(this.nativeShape, linearDeflection, false, angularDeflection, false);

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    // 2. Explore faces
    const explorer = new this.oc.TopExp_Explorer_2(this.nativeShape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE, this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
      const face = this.oc.TopoDS.Face_1(explorer.Value());
      const location = new this.oc.TopLoc_Location_1();
      const triangulation = this.oc.BRep_Tool.Triangulation(face, location);

      if (!triangulation.IsNull()) {
        const trsf = location.Transformation();
        const nbNodes = triangulation.NbNodes();
        const nbTriangles = triangulation.NbTriangles();

        // Extract Nodes
        for (let i = 1; i <= nbNodes; i++) {
          let pnt = triangulation.Node(i);
          pnt.Transform(trsf);
          positions.push(pnt.X(), pnt.Y(), pnt.Z());
          // Normals calculation simplified for PoC
          normals.push(0, 0, 1); 
        }

        // Extract Triangles
        const orient = face.Orientation();
        for (let i = 1; i <= nbTriangles; i++) {
          const tri = triangulation.Triangle(i);
          let n1, n2, n3;
          if (orient === this.oc.TopAbs_Orientation.TopAbs_REVERSED) {
            n1 = tri.Value(1); n2 = tri.Value(3); n3 = tri.Value(2);
          } else {
            n1 = tri.Value(1); n2 = tri.Value(2); n3 = tri.Value(3);
          }
          indices.push(n1 - 1 + indexOffset, n2 - 1 + indexOffset, n3 - 1 + indexOffset);
        }
        indexOffset += nbNodes;
      }
      explorer.Next();
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices)
    };
  }

  getNative(): any {
    return this.nativeShape;
  }
}
