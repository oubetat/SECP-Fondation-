/**
 * SECP OCCT Kernel Adapter
 * Future implementation of Open CASCADE Technology via WebAssembly or Native.
 */

import { KernelAdapter } from '../KernelAdapter';
import { ShapeHandle } from '../../geometry/ShapeHandle';
import { Vector3, Plane, ShapeType } from '../../geometry/GeometryTypes';
import { OcctShape } from './OcctShape';

export class OcctKernelAdapter extends KernelAdapter {
  private oc: any = null;

  constructor(ocInstance: any) {
    super();
    this.oc = ocInstance;
  }

  async createBox(dx: number, dy: number, dz: number, center?: Vector3): Promise<ShapeHandle> {
    const builder = new this.oc.BRepPrimAPI_MakeBox_1(dx, dy, dz);
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, builder.Shape(), this.oc);
  }

  async createCylinder(radius: number, height: number, plane?: Plane): Promise<ShapeHandle> {
    const cylBuilder = new this.oc.BRepPrimAPI_MakeCylinder_2(radius, height);
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, cylBuilder.Shape(), this.oc);
  }

  async createSphere(radius: number, center?: Vector3): Promise<ShapeHandle> {
    const sphereBuilder = new this.oc.BRepPrimAPI_MakeSphere_1(radius);
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, sphereBuilder.Shape(), this.oc);
  }

  async fuse(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    const fuse = new this.oc.BRepAlgoAPI_Fuse_3(target.getNative(), tool.getNative());
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, fuse.Shape(), this.oc);
  }

  async cut(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    const cut = new this.oc.BRepAlgoAPI_Cut_3(target.getNative(), tool.getNative());
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, cut.Shape(), this.oc);
  }

  async common(target: ShapeHandle, tool: ShapeHandle): Promise<ShapeHandle> {
    const common = new this.oc.BRepAlgoAPI_Common_3(target.getNative(), tool.getNative());
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, common.Shape(), this.oc);
  }

  async fillet(shape: ShapeHandle, radius: number, edgeIndices?: number[]): Promise<ShapeHandle> {
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
        if (!edgeIndices || edgeIndices.includes(index)) {
          const edge = this.oc.TopoDS.Edge_1(edgeExp.Value());
          filletMaker.Add_2(radius, edge);
          added = true;
        }
        index++;
        edgeExp.Next();
      }
      if (!added) {
        const firstExp = new this.oc.TopExp_Explorer_2(
          shape.getNative(),
          this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
        );
        if (firstExp.More()) {
          const edge = this.oc.TopoDS.Edge_1(firstExp.Value());
          filletMaker.Add_2(radius, edge);
        }
      }
      const outShape = filletMaker.Shape();
      return new OcctShape(Math.random().toString(), shape.type, outShape, this.oc);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Fillet failed', err);
      throw new Error(`Fillet operation failed in OCCT: ${err.message || err}`);
    }
  }

  async chamfer(shape: ShapeHandle, distance: number, edgeIndices?: number[]): Promise<ShapeHandle> {
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
        if (!edgeIndices || edgeIndices.includes(index)) {
          const edge = this.oc.TopoDS.Edge_1(edgeExp.Value());
          chamferMaker.Add_2(distance, edge);
          added = true;
        }
        index++;
        edgeExp.Next();
      }
      if (!added) {
        const firstExp = new this.oc.TopExp_Explorer_2(
          shape.getNative(),
          this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
        );
        if (firstExp.More()) {
          const edge = this.oc.TopoDS.Edge_1(firstExp.Value());
          chamferMaker.Add_2(distance, edge);
        }
      }
      const outShape = chamferMaker.Shape();
      return new OcctShape(Math.random().toString(), shape.type, outShape, this.oc);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Chamfer failed', err);
      throw new Error(`Chamfer operation failed in OCCT: ${err.message || err}`);
    }
  }

  async revolve(shape: ShapeHandle, axisPoint: Vector3, axisDir: Vector3, angle: number): Promise<ShapeHandle> {
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
      return new OcctShape(Math.random().toString(), ShapeType.SOLID, outShape, this.oc);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Revolve failed', err);
      throw new Error(`Revolve operation failed in OCCT: ${err.message || err}`);
    }
  }

  async sweep(profile: ShapeHandle, path: ShapeHandle): Promise<ShapeHandle> {
    try {
      const MakePipe = this.oc.BRepOffsetAPI_MakePipe_1 || this.oc.BRepOffsetAPI_MakePipe_2 || this.oc.BRepOffsetAPI_MakePipe;
      if (!MakePipe) {
        throw new Error('BRepOffsetAPI_MakePipe not found in OCCT WebAssembly instance.');
      }
      const pipeMaker = new MakePipe(path.getNative(), profile.getNative());
      const outShape = pipeMaker.Shape();
      return new OcctShape(Math.random().toString(), ShapeType.SOLID, outShape, this.oc);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Sweep failed', err);
      throw new Error(`Sweep operation failed in OCCT: ${err.message || err}`);
    }
  }

  async translate(shape: ShapeHandle, vector: Vector3): Promise<ShapeHandle> {
    const trsf = new this.oc.gp_Trsf();
    trsf.SetTranslation_1(new this.oc.gp_Vec_4(vector.x, vector.y, vector.z));
    const loc = new this.oc.TopLoc_Location_2(trsf);
    const moved = shape.getNative().Moved(loc);
    return new OcctShape(Math.random().toString(), shape.type, moved, this.oc);
  }

  async rotate(shape: ShapeHandle, axis: Vector3, angle: number): Promise<ShapeHandle> {
    try {
      const trsf = new this.oc.gp_Trsf();
      const gpAxis = new this.oc.gp_Ax1_2(
        new this.oc.gp_Pnt_3(0, 0, 0),
        new this.oc.gp_Dir_4(axis.x, axis.y, axis.z)
      );
      trsf.SetRotation_1(gpAxis, angle);
      const loc = new this.oc.TopLoc_Location_2(trsf);
      const moved = shape.getNative().Moved(loc);
      return new OcctShape(Math.random().toString(), shape.type, moved, this.oc);
    } catch (err: any) {
      console.error('[OcctKernelAdapter] Rotate failed', err);
      throw new Error(`Rotate operation failed in OCCT: ${err.message || err}`);
    }
  }

  async exportStep(shape: ShapeHandle): Promise<string> {
    const writer = new this.oc.STEPControl_Writer_1();
    writer.Transfer(shape.getNative(), this.oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    const filename = `export_${Date.now()}.step`;
    writer.Write(filename);
    const bytes = this.oc.FS.readFile(filename);
    return Buffer.from(bytes).toString('utf8');
  }

  async importStep(stepContent: string): Promise<ShapeHandle> {
    const filename = `import_${Date.now()}.step`;
    this.oc.FS.writeFile(filename, stepContent);
    const reader = new this.oc.STEPControl_Reader_1();
    reader.ReadFile(filename);
    reader.TransferRoots();
    return new OcctShape(Math.random().toString(), ShapeType.SOLID, reader.OneShape(), this.oc);
  }

  async heal(shape: ShapeHandle): Promise<ShapeHandle> {
    return shape; // Identity healing for PoC
  }
}
