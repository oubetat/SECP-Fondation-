/**
 * PATCH-SECP-005 — Parametric Modeling Engine
 * Parameter -> Constraint -> Feature -> Geometry propagation loop.
 */

import { Parameter, Constraint, Feature } from '../types/domainModel';
import { CadGeometryKernel, CadSolidEntity } from './cadKernel';

export interface ParametricModel {
  parameters: Record<string, Parameter>;
  constraints: Constraint[];
  features: Feature[];
  activeSolid: CadSolidEntity;
}

export class ParametricEngine {
  public static createDefaultParametricBox(): ParametricModel {
    const parameters: Record<string, Parameter> = {
      Length: { id: 'p1', name: 'Length', value: 500, unit: 'mm', description: 'Main Box Length' },
      Width: { id: 'p2', name: 'Width', value: 300, unit: 'mm', description: 'Main Box Width' },
      Height: { id: 'p3', name: 'Height', value: 100, unit: 'mm', description: 'Main Box Height' },
      HoleRadius: { id: 'p4', name: 'HoleRadius', value: 25, unit: 'mm', expression: 'Width * 0.0833' },
    };

    const constraints: Constraint[] = [
      {
        id: 'c1',
        type: 'DIMENSIONAL',
        name: 'Length_Min_Limit',
        kind: 'DISTANCE',
        targetEntityIds: ['p1'],
        value: 100,
        unit: 'mm',
        satisfied: true,
      },
    ];

    const features: Feature[] = [
      {
        id: 'f1',
        name: 'Base_Box_Pad',
        type: 'PAD_EXTRUDE',
        parameters: [parameters.Length, parameters.Width, parameters.Height],
        dependencies: [],
        revisionNumber: 1,
        suppressed: false,
      },
      {
        id: 'f2',
        name: 'Center_Bore_Hole',
        type: 'HOLE',
        parameters: [parameters.HoleRadius],
        dependencies: ['f1'],
        revisionNumber: 1,
        suppressed: false,
      },
    ];

    const initialSolid = CadGeometryKernel.createBox(
      parameters.Length.value,
      parameters.Width.value,
      parameters.Height.value,
      'Parametric_Box'
    );

    return {
      parameters,
      constraints,
      features,
      activeSolid: initialSolid,
    };
  }

  /**
   * Update parameter value and re-run Parametric Propagation Loop
   */
  public static updateParameter(
    model: ParametricModel,
    paramName: string,
    newValue: number
  ): ParametricModel {
    const updatedParameters = { ...model.parameters };
    if (updatedParameters[paramName]) {
      updatedParameters[paramName] = {
        ...updatedParameters[paramName],
        value: newValue,
      };
    }

    // Evaluate dependent expressions (e.g. HoleRadius = Width * 0.0833)
    if (paramName === 'Width' && updatedParameters.HoleRadius) {
      updatedParameters.HoleRadius = {
        ...updatedParameters.HoleRadius,
        value: Math.round(newValue * 0.0833),
      };
    }

    // Re-evaluate constraints
    const updatedConstraints = model.constraints.map(c => ({
      ...c,
      satisfied: updatedParameters.Length.value >= 100,
    }));

    // Re-build geometry from parameters
    const length = updatedParameters.Length.value;
    const width = updatedParameters.Width.value;
    const height = updatedParameters.Height.value;

    let newSolid = CadGeometryKernel.createBox(length, width, height, 'Parametric_Box_Rebuilt');

    // If center bore hole feature is active, perform boolean cut
    if (!model.features[1]?.suppressed) {
      const holeRadius = updatedParameters.HoleRadius.value;
      const holeTool = CadGeometryKernel.createCylinder(holeRadius, height * 1.2, 'Bore_Tool');
      newSolid = CadGeometryKernel.applyBooleanOperation(newSolid, holeTool, 'CUT');
    }

    return {
      parameters: updatedParameters,
      constraints: updatedConstraints,
      features: model.features,
      activeSolid: newSolid,
    };
  }

  public static getInitialMachineParameters(): Record<string, Parameter> {
    return this.createDefaultParametricBox().parameters;
  }

  public static getInitialConstraints(): Constraint[] {
    return this.createDefaultParametricBox().constraints;
  }

  public static evaluateConstraints(params: any, constraints: any): any[] {
    return constraints;
  }
}
