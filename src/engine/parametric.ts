import { Parameter } from '../types/domainModel';

export interface ParametricModel {
  id: string;
  parameters: Record<string, {
    id: string;
    name: string;
    value: number;
    unit: string;
    expression?: string;
    description?: string;
  }>;
  constraints: Array<{ id: string; name: string; kind: string }>;
  features: Array<{ id: string; name: string; type: string }>;
  activeSolid: { volumeM3: number; surfaceAreaM2: number };
}

export class ParametricEngine {
  static getInitialMachineParameters(): Record<string, Parameter> {
    return {
      'Cylinders': { id: 'P1', name: 'Cylinders', value: 6, unit: 'count' },
      'Stroke': { id: 'P2', name: 'Stroke', value: 90, unit: 'mm' },
      'Bore': { id: 'P3', name: 'Bore', value: 85, unit: 'mm' },
      'CompressionRatio': { id: 'P4', name: 'CompressionRatio', value: 10.5, unit: 'ratio' }
    };
  }

  static getInitialConstraints() {
    return [];
  }

  static createDefaultParametricBox(): ParametricModel {
    const length = 500;
    const width = 300;
    const height = 200;
    const holeRadius = 25;

    return {
      id: 'param-box-01',
      parameters: {
        Length: { id: 'P_LEN', name: 'Length', value: length, unit: 'mm', expression: '500', description: 'Overall Box Length' },
        Width: { id: 'P_WID', name: 'Width', value: width, unit: 'mm', expression: '300', description: 'Overall Box Width' },
        Height: { id: 'P_HGT', name: 'Height', value: height, unit: 'mm', expression: '200', description: 'Extrusion Height' },
        HoleRadius: { id: 'P_RAD', name: 'Hole Radius', value: holeRadius, unit: 'mm', expression: '25', description: 'Center Bore Diameter / 2' }
      },
      constraints: [
        { id: 'c-01', name: 'Symmetry X-Axis', kind: 'COINCIDENT' },
        { id: 'c-02', name: 'Bore Center Alignment', kind: 'CONCENTRIC' },
        { id: 'c-03', name: 'Base Plane Grounding', kind: 'FIXED' }
      ],
      features: [
        { id: 'f-01', name: 'Base Sketch 2D', type: 'SKETCH' },
        { id: 'f-02', name: 'Pad Extrusion 3D', type: 'EXTRUDE' },
        { id: 'f-03', name: 'Center Hole Pocket', type: 'CUT_EXTRUDE' }
      ],
      activeSolid: {
        volumeM3: (length * width * height - Math.PI * holeRadius * holeRadius * height) / 1e9,
        surfaceAreaM2: (2 * (length * width + length * height + width * height)) / 1e6
      }
    };
  }

  static updateParameter(model: any, name: string, value: number): ParametricModel {
    const currentParam = model?.parameters?.[name];
    const updatedParam = typeof currentParam === 'object' && currentParam !== null
      ? { ...currentParam, value }
      : { id: `P_${name}`, name, value, unit: 'mm', expression: String(value) };

    const newParameters = {
      ...(model?.parameters || {}),
      [name]: updatedParam
    };

    const length = typeof newParameters.Length === 'object' ? newParameters.Length.value : (typeof newParameters.Length === 'number' ? newParameters.Length : 500);
    const width = typeof newParameters.Width === 'object' ? newParameters.Width.value : (typeof newParameters.Width === 'number' ? newParameters.Width : 300);
    const height = typeof newParameters.Height === 'object' ? newParameters.Height.value : (typeof newParameters.Height === 'number' ? newParameters.Height : 200);
    const holeRadius = typeof newParameters.HoleRadius === 'object' ? newParameters.HoleRadius.value : (typeof newParameters.HoleRadius === 'number' ? newParameters.HoleRadius : 25);

    return {
      id: model?.id || 'param-box-01',
      parameters: newParameters,
      constraints: model?.constraints || [
        { id: 'c-01', name: 'Symmetry X-Axis', kind: 'COINCIDENT' },
        { id: 'c-02', name: 'Bore Center Alignment', kind: 'CONCENTRIC' },
        { id: 'c-03', name: 'Base Plane Grounding', kind: 'FIXED' }
      ],
      features: model?.features || [
        { id: 'f-01', name: 'Base Sketch 2D', type: 'SKETCH' },
        { id: 'f-02', name: 'Pad Extrusion 3D', type: 'EXTRUDE' },
        { id: 'f-03', name: 'Center Hole Pocket', type: 'CUT_EXTRUDE' }
      ],
      activeSolid: {
        volumeM3: Math.max(0.000001, (length * width * height - Math.PI * holeRadius * holeRadius * height) / 1e9),
        surfaceAreaM2: Math.max(0.0001, (2 * (length * width + length * height + width * height)) / 1e6)
      }
    };
  }
}
