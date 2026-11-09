import { 
  BearingDefinition, 
  ShaftRecognitionResult, 
  BearingInstance 
} from './BearingTypes';
import { AssemblyComponent } from '../AssemblyConstraintTypes';
import { AssemblyConstraint } from '../AssemblyConstraintTypes';

export class BearingPlacementEngine {
  public static recognizeShaft(
    component: AssemblyComponent, 
    bearingBore: number, 
    bearingDef: BearingDefinition
  ): ShaftRecognitionResult {
    return {
      shaftInstanceId: component.instanceId,
      detectedDiameterMm: bearingBore, // Perfect match for simulation
      bearingBoreMm: bearingBore,
      differenceMm: 0,
      verdict: 'COMPATIBLE',
      suggestedFitClass: 'k5',
      axisCenter: { x: 0, y: 0, z: 0 },
      axisDirection: { x: 0, y: 0, z: 1 }
    };
  }

  public static placeBearingOnShaft(
    bearing: BearingDefinition,
    shaft: AssemblyComponent,
    recognition: ShaftRecognitionResult,
    assemblyId: string,
    offsetZ: number
  ): { 
    bearingInstance: BearingInstance; 
    assemblyComponent: AssemblyComponent;
    constraints: AssemblyConstraint[];
  } {
    const instId = `inst-brg-${bearing.bearingId.toLowerCase()}`;
    
    const bearingInstance: BearingInstance = {
      instanceId: instId,
      bearingDefinitionId: bearing.bearingId,
      partNumber: bearing.partNumber,
      name: `${bearing.standard} ${bearing.partNumber} Bearing`,
      assemblyId,
      placementTransform: {
        position: { x: 0, y: 0, z: offsetZ },
        rotation: { x: 0, y: 0, z: 0 },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, offsetZ, 0, 0, 0, 1]
      },
      worldTransform: {
        position: { x: 0, y: 0, z: offsetZ },
        rotation: { x: 0, y: 0, z: 0 },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, offsetZ, 0, 0, 0, 1]
      },
      motionModel: 'ROTATIONAL_FREE',
      currentRotationDeg: 0,
      innerRingSpeedRpm: 0,
      outerRingSpeedRpm: 0,
      cageSpeedRpm: 0,
      ballSpinSpeedRpm: 0,
      matingShaftId: shaft.instanceId,
      suppressed: false,
      fixed: false,
      revision: 1
    };

    const assemblyComponent = new AssemblyComponent({
      id: instId,
      instanceId: instId,
      partId: bearing.partNumber,
      name: bearingInstance.name,
      placementTransform: bearingInstance.placementTransform,
      worldTransform: bearingInstance.worldTransform,
      suppressed: false,
      fixed: false,
      revision: 1
    });

    const constraints: AssemblyConstraint[] = [
      new AssemblyConstraint({
        id: `const-conc-${instId}`,
        constraintId: `const-conc-${instId}`,
        name: 'Concentric',
        type: 'CONCENTRIC' as any,
        componentA: instId,
        componentB: shaft.instanceId,
        entityA: 'bearing_bore',
        entityB: 'shaft_cyl',
        parameters: {},
        isSuppressed: false,
        status: 'RESOLVED'
      }),
      new AssemblyConstraint({
        id: `const-mate-${instId}`,
        constraintId: `const-mate-${instId}`,
        name: 'Mate',
        type: 'MATE' as any,
        componentA: instId,
        componentB: shaft.instanceId,
        entityA: 'bearing_face',
        entityB: 'shaft_shoulder',
        parameters: { offset: 0 },
        isSuppressed: false,
        status: 'RESOLVED'
      })
    ];

    return {
      bearingInstance,
      assemblyComponent,
      constraints
    };
  }
}
