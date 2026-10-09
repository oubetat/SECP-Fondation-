import { TopoShape, Solid } from '../topology/TopologyContracts';
import { BRepKernel } from '../brep/BRepKernel';
import { Meters, asM } from '../core/Units';

export class BoxFactory {
  static createBox(id: string, x: number, y: number, z: number, w: number, h: number, d: number): Solid {
    const width = asM(Math.abs(w - x));
    const height = asM(Math.abs(h - y));
    const depth = asM(Math.abs(d - z));
    const origin = { 
      x: asM(Math.min(x, w)), 
      y: asM(Math.min(y, h)), 
      z: asM(Math.min(z, d)) 
    };
    return BRepKernel.getCanonical().createBox(
      width,
      height,
      depth,
      id,
      origin
    );
  }
}
