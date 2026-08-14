/**
 * SECP OCCT Kernel Adapter
 * Future implementation of Open CASCADE Technology via WebAssembly or Native.
 */

import { KernelAdapter } from '../KernelAdapter';
import { ShapeHandle } from '../../geometry/ShapeHandle';
import { Vector3, Plane, ShapeType, IdentityContext, KernelManifest, TopologyReference } from '../../geometry/GeometryTypes';
import { SketchDefinition } from '../../geometry/SketchTypes';
import { OcctShape } from './OcctShape';
import { generateDeterministicHash } from '../../../lib/hash';

const KERNEL_VERSION = 'OCCT-7.8.1-SECP';

import { OCCT_MANIFEST } from './OcctManifest';
import { ShapeIdentity } from '../../geometry/GeometryTypes';

export class OcctKernelAdapter extends KernelAdapter {
  private oc: any = null;

  constructor(ocInstance: any) {
    super();
    this.oc = ocInstance;
  }

  private async generateIdentity(context?: IdentityContext): Promise<ShapeIdentity> {
    const kernel = KERNEL_VERSION;
    const featureId = context?.featureId || 'anonymous_feature';
    const revision = context?.revision || 0;
    
    // Replace Math.random() with a standard UUID
    const shapeId = crypto.randomUUID();

    const geometryHash = await generateDeterministicHash(context ? {
      op: context.operation,
      params: context.parameters,
      parent: context.parentHash,
      kernel
    } : { shapeId });
    
    const topologyHash = await generateDeterministicHash({ geometryHash, type: 'topology' });

    return {
      shapeId,
      featureId,
      revision,
      kernel,
      geometryHash,
      topologyHash
    };
  }

  async createBox(dx: number, dy: number, dz: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle> {
    const builder = new this.oc.BRepPrimAPI_MakeBox_1(dx, dy, dz);
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, builder.Shape(), this.oc, identity.geometryHash, context);
  }

  async createCylinder(radius: number, height: number, plane?: Plane, context?: IdentityContext): Promise<ShapeHandle> {
    const cylBuilder = new this.oc.BRepPrimAPI_MakeCylinder_1(radius, height);
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, cylBuilder.Shape(), this.oc, identity.geometryHash, context);
  }

  async createSphere(radius: number, center?: Vector3, context?: IdentityContext): Promise<ShapeHandle> {
    const sphereBuilder = new this.oc.BRepPrimAPI_MakeSphere_1(radius);
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, sphereBuilder.Shape(), this.oc, identity.geometryHash, context);
  }

  async createPoint(x: number, y: number, z: number): Promise<Vector3> {
    return { x, y, z };
  }

  async createLine(p1: Vector3, p2: Vector3, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const pt1 = new this.oc.gp_Pnt_3(p1.x, p1.y, p1.z);
      const pt2 = new this.oc.gp_Pnt_3(p2.x, p2.y, p2.z);
      const edge = new this.oc.BRepBuilderAPI_MakeEdge_3(pt1, pt2).Edge();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.WIRE, edge, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      throw new Error(`createLine failed: ${err.message || err}`);
    }
  }

  async createCircle(center: Vector3, radius: number, normal?: Vector3, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const ocCenter = new this.oc.gp_Pnt_3(center.x, center.y, center.z);
      const ocNormal = normal 
        ? new this.oc.gp_Dir_4(normal.x, normal.y, normal.z)
        : new this.oc.gp_Dir_4(0, 0, 1);
      
      const ax2 = new this.oc.gp_Ax2_3(ocCenter, ocNormal);
      const circ = new this.oc.gp_Circ_2(ax2, radius);
      const edge = new this.oc.BRepBuilderAPI_MakeEdge_10(circ).Edge();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.WIRE, edge, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      throw new Error(`createCircle failed: ${err.message || err}`);
    }
  }

  async createArc(p1: Vector3, p2: Vector3, p3: Vector3, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const pt1 = new this.oc.gp_Pnt_3(p1.x, p1.y, p1.z);
      const pt2 = new this.oc.gp_Pnt_3(p2.x, p2.y, p2.z);
      const pt3 = new this.oc.gp_Pnt_3(p3.x, p3.y, p3.z);
      const edge = new this.oc.BRepBuilderAPI_MakeEdge_6(pt1, pt2, pt3).Edge();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.WIRE, edge, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      throw new Error(`createArc failed: ${err.message || err}`);
    }
  }

  async createWire(edges: ShapeHandle[], context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const wireMaker = new this.oc.BRepBuilderAPI_MakeWire_1();
      for (const edge of edges) {
        wireMaker.Add_1(edge.getNative());
      }
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.WIRE, wireMaker.Wire(), this.oc, identity.geometryHash, context);
    } catch (err: any) {
      throw new Error(`createWire failed: ${err.message || err}`);
    }
  }

  async makeFaceFromWire(wire: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_1(wire.getNative(), false);
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.FACE, faceMaker.Face(), this.oc, identity.geometryHash, context);
    } catch (err: any) {
      throw new Error(`makeFaceFromWire failed: ${err.message || err}`);
    }
  }

  async createRectangularFace(w: number, h: number, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const p1 = new this.oc.gp_Pnt_3(-w / 2, -h / 2, 0);
      const p2 = new this.oc.gp_Pnt_3(w / 2, -h / 2, 0);
      const p3 = new this.oc.gp_Pnt_3(w / 2, h / 2, 0);
      const p4 = new this.oc.gp_Pnt_3(-w / 2, h / 2, 0);

      const edge1 = new this.oc.BRepBuilderAPI_MakeEdge_3(p1, p2).Edge();
      const edge2 = new this.oc.BRepBuilderAPI_MakeEdge_3(p2, p3).Edge();
      const edge3 = new this.oc.BRepBuilderAPI_MakeEdge_3(p3, p4).Edge();
      const edge4 = new this.oc.BRepBuilderAPI_MakeEdge_3(p4, p1).Edge();

      const wire = new this.oc.BRepBuilderAPI_MakeWire_5(edge1, edge2, edge3, edge4).Wire();
      const face = new this.oc.BRepBuilderAPI_MakeFace_1(wire, false).Face();

      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.FACE, face, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] createRectangularFace failed', err);
      throw new Error(`createRectangularFace failed: ${err.message || err}`);
    }
  }

  async fuse(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    const fuse = new this.oc.BRepAlgoAPI_Fuse_3(target.getNative(), tool.getNative());
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, fuse.Shape(), this.oc, identity.geometryHash, context);
  }

  async cut(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    const cut = new this.oc.BRepAlgoAPI_Cut_3(target.getNative(), tool.getNative());
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, cut.Shape(), this.oc, identity.geometryHash, context);
  }

  async common(target: ShapeHandle, tool: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    const common = new this.oc.BRepAlgoAPI_Common_3(target.getNative(), tool.getNative());
    const identity = await this.generateIdentity(context);
    return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, common.Shape(), this.oc, identity.geometryHash, context);
  }

  async evaluateSketch(sketch: SketchDefinition, context?: IdentityContext): Promise<ShapeHandle> {
    const identity = await this.generateIdentity(context);
    const wireMaker = new this.oc.BRepBuilderAPI_MakeWire_1();
    
    // Process line entities
    for (const key of Object.keys(sketch.entities)) {
      const entity = sketch.entities[key];
      if (entity.type === 'LINE') {
        const p1 = sketch.entities[entity.startPointId];
        const p2 = sketch.entities[entity.endPointId];
        if (p1 && p1.type === 'POINT' && p2 && p2.type === 'POINT') {
          const gpP1 = new this.oc.gp_Pnt_3(p1.position.x, p1.position.y, 0);
          const gpP2 = new this.oc.gp_Pnt_3(p2.position.x, p2.position.y, 0);
          const edgeMaker = new this.oc.BRepBuilderAPI_MakeEdge_3(gpP1, gpP2);
          wireMaker.Add_1(edgeMaker.Edge());
        }
      }
    }

    const wire = wireMaker.Wire();
    const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_15(wire, false);
    
    return new OcctShape(
      identity.shapeId, 
      identity, 
      ShapeType.FACE, 
      faceMaker.Face(), 
      this.oc, 
      identity.geometryHash, 
      context
    );
  }

  async fillet(shape: ShapeHandle, radius: number, edgeReferences?: any[], context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const filletMaker = new this.oc.BRepFilletAPI_MakeFillet(
        shape.getNative(),
        this.oc.ChFi3d_FilletShape.ChFi3d_Rational
      );
      const edgeExp = new this.oc.TopExp_Explorer_2(
        shape.getNative(),
        this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );
      let index = 0;
      let added = false;
      while (edgeExp.More()) {
        const edge = this.oc.TopoDS.Edge_1(edgeExp.Value());
        // Match by index or signature
        const isTarget = !edgeReferences || edgeReferences.some(ref => {
          return ref.index === index || ref.signature === index.toString();
        });

        if (isTarget) {
          filletMaker.Add_2(radius, edge);
          added = true;
        }
        index++;
        edgeExp.Next();
      }
      if (!added && (!edgeReferences || edgeReferences.length === 0)) {
        // Fallback to first edge only if NO references were provided
        const firstExp = new this.oc.TopExp_Explorer_2(
          shape.getNative(),
          this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
        );
        if (firstExp.More()) {
          const edge = this.oc.TopoDS.Edge_1(firstExp.Value());
          filletMaker.Add_2(radius, edge);
          added = true;
        }
      }

      if (!added && edgeReferences && edgeReferences.length > 0) {
         throw new Error(`Fillet failed: No matching edges found for the provided references.`);
      }

      const outShape = filletMaker.Shape();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, shape.type, outShape, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'OCCT WASM Exception');
      console.error('[OcctKernelAdapter] Fillet failed:', msg);
      throw new Error(`Fillet operation failed in OCCT: ${msg}`);
    }
  }

  async chamfer(shape: ShapeHandle, distance: number, edgeReferences?: any[], context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const MakeChamfer = this.oc.BRepFilletAPI_MakeChamfer;
      if (!MakeChamfer) {
        throw new Error('BRepFilletAPI_MakeChamfer not found in OCCT WebAssembly instance.');
      }
      const chamferMaker = new MakeChamfer(shape.getNative());
      const edgeExp = new this.oc.TopExp_Explorer_2(
        shape.getNative(),
        this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );
      let index = 0;
      let added = false;
      while (edgeExp.More()) {
        const edge = this.oc.TopoDS.Edge_1(edgeExp.Value());
        const isTarget = !edgeReferences || edgeReferences.some(ref => {
          return ref.index === index || ref.signature === index.toString();
        });

        if (isTarget) {
          chamferMaker.Add_2(distance, edge);
          added = true;
        }
        index++;
        edgeExp.Next();
      }
      if (!added && (!edgeReferences || edgeReferences.length === 0)) {
        const firstExp = new this.oc.TopExp_Explorer_2(
          shape.getNative(),
          this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
        );
        if (firstExp.More()) {
          const edge = this.oc.TopoDS.Edge_1(firstExp.Value());
          chamferMaker.Add_2(distance, edge);
          added = true;
        }
      }

      if (!added && edgeReferences && edgeReferences.length > 0) {
        throw new Error(`Chamfer failed: No matching edges found for the provided references.`);
      }

      const outShape = chamferMaker.Shape();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, shape.type, outShape, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'OCCT WASM Exception');
      console.error('[OcctKernelAdapter] Chamfer failed:', msg);
      throw new Error(`Chamfer operation failed in OCCT: ${msg}`);
    }
  }

  async revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const axisPointPnt = new this.oc.gp_Pnt_3(axisPoint.x, axisPoint.y, axisPoint.z);
      const axisDirDir = new this.oc.gp_Dir_4(axisDir.x, axisDir.y, axisDir.z);
      const axisAx1 = new this.oc.gp_Ax1_2(axisPointPnt, axisDirDir);
      
      const MakeRevol = this.oc.BRepPrimAPI_MakeRevol_1 || this.oc.BRepPrimAPI_MakeRevol_2 || this.oc.BRepPrimAPI_MakeRevol;
      if (!MakeRevol) {
        throw new Error('BRepPrimAPI_MakeRevol not found in OCCT WebAssembly instance.');
      }
      const revolveMaker = new MakeRevol(shape.getNative(), axisAx1, angle, true);
      const outShape = revolveMaker.Shape();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, outShape, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Revolve failed', err);
      throw new Error(`Revolve operation failed in OCCT: ${err.message || err}`);
    }
  }

  async sweep(profile: ShapeHandle, path: ShapeHandle, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const MakePipe = this.oc.BRepOffsetAPI_MakePipe_1 || this.oc.BRepOffsetAPI_MakePipe_2 || this.oc.BRepOffsetAPI_MakePipe;
      if (!MakePipe) {
        throw new Error('BRepOffsetAPI_MakePipe not found in OCCT WebAssembly instance.');
      }
      const pipeMaker = new MakePipe(path.getNative(), profile.getNative());
      const outShape = pipeMaker.Shape();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, outShape, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Sweep failed', err);
      throw new Error(`Sweep operation failed in OCCT: ${err.message || err}`);
    }
  }

  async extrude(shape: ShapeHandle, dx: number, dy: number, dz: number, context?: IdentityContext): Promise<ShapeHandle> {
    try {
      const vec = new this.oc.gp_Vec_4(dx, dy, dz);
      const prismMaker = new this.oc.BRepPrimAPI_MakePrism_1(shape.getNative(), vec, false, true);
      const outShape = prismMaker.Shape();
      const identity = await this.generateIdentity(context);
      return new OcctShape(identity.shapeId, identity, ShapeType.SOLID, outShape, this.oc, identity.geometryHash, context);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Extrude failed', err);
      throw new Error(`Extrude operation failed in OCCT: ${err.message || err}`);
    }
  }

  async translate(shape: ShapeHandle, vector: Vector3): Promise<ShapeHandle> {
    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetTranslation_1(new this.oc.gp_Vec_4(vector.x, vector.y, vector.z));
    const loc = new this.oc.TopLoc_Location_2(trsf);
    const moved = shape.getNative().Moved(loc);
    // Transformations preserve the original hash but get a new ID derived from the move
    const newIdentity: ShapeIdentity = { ...shape.identity, shapeId: crypto.randomUUID() };
    return new OcctShape(`${shape.id}_translated`, newIdentity, shape.type, moved, this.oc, shape.identityHash, shape.metadata);
  }

  async rotate(shape: ShapeHandle, axis: Vector3, angle: number): Promise<ShapeHandle> {
    try {
      const trsf = new this.oc.gp_Trsf_1();
      const gpAxis = new this.oc.gp_Ax1_2(
        new this.oc.gp_Pnt_3(0, 0, 0),
        new this.oc.gp_Dir_4(axis.x, axis.y, axis.z)
      );
      trsf.SetRotation_1(gpAxis, angle);
      const loc = new this.oc.TopLoc_Location_2(trsf);
      const moved = shape.getNative().Moved(loc);
      const newIdentity: ShapeIdentity = { ...shape.identity, shapeId: crypto.randomUUID() };
      return new OcctShape(`${shape.id}_rotated`, newIdentity, shape.type, moved, this.oc, shape.identityHash, shape.metadata);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Rotate failed', err);
      throw new Error(`Rotate operation failed in OCCT: ${err.message || err}`);
    }
  }

  getManifest(): KernelManifest {
    return OCCT_MANIFEST;
  }

  async exportStep(shape: ShapeHandle): Promise<string> {
    return this.exportStepAP(shape, '214'); // Default to AP214
  }

  async exportStepAP(shape: ShapeHandle, ap: '203' | '214' | '242'): Promise<string> {
    try {
      const writer = new this.oc.STEPControl_Writer_1();
      
      // Set the STEP schema if the interface is available in the build
      if (this.oc.Interface_Static_SetCVal) {
        this.oc.Interface_Static_SetCVal('write.step.schema', ap === '242' ? 'AP242' : (ap === '214' ? 'AP214' : 'AP203'));
      }

      writer.Transfer(shape.getNative(), this.oc.STEPControl_StepModelType.STEPControl_AsIs, true);
      const filename = `export_ap${ap}_${Date.now()}.step`;
      writer.Write(filename);
      const bytes = this.oc.FS.readFile(filename);
      return Buffer.from(bytes).toString('utf8');
    } catch (err: any) {
      console.error(`[OcctKernelAdapter] exportStepAP(${ap}) failed`, err);
      throw new Error(`STEP export failed: ${err.message || err}`);
    }
  }

  async importStep(stepContent: string): Promise<ShapeHandle> {
    const filename = `import_${Date.now()}.step`;
    this.oc.FS.writeFile(filename, stepContent);
    const reader = new this.oc.STEPControl_Reader_1();
    reader.ReadFile(filename);
    reader.TransferRoots();
    // Step imports get a content-derived ID for determinism
    const hash = await generateDeterministicHash({ content: stepContent });
    const identity: ShapeIdentity = { shapeId: crypto.randomUUID(), featureId: 'import', revision: 0, kernel: KERNEL_VERSION, geometryHash: hash, topologyHash: hash };
    return new OcctShape(`step_import_${hash}`, identity, ShapeType.SOLID, reader.OneShape(), this.oc, hash, { source: 'step_import' });
  }

  async heal(shape: ShapeHandle): Promise<ShapeHandle> {
    try {
      if (this.oc.ShapeFix_Shape) {
        const sfs = new this.oc.ShapeFix_Shape(shape.getNative());
        sfs.Perform();
        const fixedShape = sfs.Shape();
        const newIdentity: ShapeIdentity = { ...shape.identity, shapeId: crypto.randomUUID() };
        return new OcctShape(
          `${shape.id}_healed`,
          newIdentity,
          shape.type,
          fixedShape,
          this.oc,
          shape.identityHash,
          { ...shape.metadata, healed: true }
        );
      } else {
        throw new Error('HEAL_NOT_SUPPORTED: ShapeFix_Shape is missing from the current OCCT build.');
      }
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Healing failed', err);
      throw new Error(`Healing failed: ${err.message || err}`);
    }
  }

  async validate(shape: ShapeHandle): Promise<boolean> {
    const props = await shape.getProperties();
    if (!props.isValid && props.validationMessages) {
      console.warn(`[OcctKernelAdapter] Shape validation failed for ${shape.id}:`, props.validationMessages);
    }
    return props.isValid || false;
  }
}
