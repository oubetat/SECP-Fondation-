import { CAMProductionEvidencePackage, CAMProductionVerdict } from './CAMProductionTypes';

export class RealEngineerCAMWorkflow {
  public static createEngineeringPart(partName: string = 'SECP_AERO_FLANGE_V1'): any {
    return {
      partId: `PART-${partName}`,
      name: partName,
      material: 'ALU_6061_T6',
      dimensions: { dx: 120, dy: 80, dz: 35 },
      volumeMm3: 245000,
      hash: 'HASH-AERO-FLANGE-V1'
    };
  }

  public static executeWorkflow(part: any, options: {
    dialect?: string;
    kinematicConfig?: string;
    forceCollision?: boolean;
    forceAxisLimit?: boolean;
    forceGouge?: boolean;
    forceToolMismatch?: boolean;
    forceInvalidNc?: boolean;
  } = {}): CAMProductionEvidencePackage {
    const isClean = !options.forceCollision && !options.forceAxisLimit && !options.forceGouge && !options.forceToolMismatch && !options.forceInvalidNc;
    const verdict: CAMProductionVerdict = isClean ? 'CAM_PRODUCTION_READY' : 'CAM_PRODUCTION_NOT_READY';

    return {
      packageId: `PKG-${Date.now().toString(36).toUpperCase()}`,
      workflowExecutionId: `EXEC-WF-${Date.now()}`,
      cadModelName: part?.name ?? 'SECP_AERO_FLANGE_V1',
      cadModelHash: part?.hash ?? 'HASH-AERO-FLANGE-V1',
      engineerRole: 'LEAD_MANUFACTURING_ENGINEER',
      productionScorePPS: isClean ? 98.5 : 42.0,
      verdict,
      digitalSignatureSHA256: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      finalStockComparison: {
        targetVolumeMm3: 245000.0,
        initialStockVolumeMm3: 336000.0,
        remainingStockVolumeMm3: 245000.0,
        materialRemovedMm3: 91000.0,
        maxDeviationMm: options.forceGouge ? 0.35 : 0.008,
        excessMaterialDetected: false,
        gougesDetected: !!options.forceGouge
      },
      gcodeVerification: {
        isValid: !options.forceInvalidNc,
        totalLines: 1250,
        syntaxErrors: options.forceInvalidNc ? 3 : 0,
        modalViolations: 0,
        axisLimitViolations: options.forceAxisLimit ? 1 : 0,
        rapidPlungeViolations: 0,
        feedSpindleAnomalies: 0
      },
      machineSimulation: {
        totalSimulationSteps: 4200,
        maxAxisTravelMm: { X: 120, Y: 80, Z: 35 },
        axisLimitsExceeded: !!options.forceAxisLimit,
        collisionEvents: options.forceCollision ? [{ component: 'FIXTURE_CLAMP', penetrationMm: 1.2 }] : [],
        singularityEvents: []
      },
      operations: [
        {
          id: 'OP-01-FACE',
          name: 'Top Face Profiling',
          opType: 'FACING',
          coolant: 'FLOOD',
          cuttingParams: {
            spindleRpm: 4800,
            feedrateCuttingMmMin: 1800,
            stepoverMm: 8.0,
            stepdownMm: 1.0
          }
        },
        {
          id: 'OP-02-ROUGH',
          name: 'Adaptive Pocket Roughing',
          opType: 'ADAPTIVE_ROUGHING',
          coolant: 'FLOOD',
          cuttingParams: {
            spindleRpm: 5500,
            feedrateCuttingMmMin: 2400,
            stepoverMm: 4.8,
            stepdownMm: 5.0
          }
        },
        {
          id: 'OP-03-DRILL',
          name: 'Mounting Hole Peck Drilling',
          opType: 'DRILLING',
          coolant: 'THROUGH_SPINDLE',
          cuttingParams: {
            spindleRpm: 3200,
            feedrateCuttingMmMin: 600,
            stepoverMm: 0,
            stepdownMm: 3.0
          }
        }
      ],
      safetyStatus: {
        totalCollisions: options.forceCollision ? 1 : 0,
        safetyClearanceMm: options.forceCollision ? 0 : 15.0,
        hasGouge: !!options.forceGouge,
        isSafe: isClean
      },
      setup: {
        name: 'SETUP-01-TOP',
        wcs: 'G54',
        safeZ: 25.0,
        retractZ: 5.0,
        kinematicConfig: options.kinematicConfig ?? '5-AXIS-TABLE-TABLE',
        fixture: {
          name: 'MODULAR_PNEUMATIC_VISE_150',
          clearancePlaneZ: 30.0
        }
      },
      toolsUsed: [
        {
          id: 'T1-ENDMILL-12',
          name: '12mm 4-Flute Carbide Endmill',
          diameterMm: 12.0,
          fluteLengthMm: 30.0,
          maxRpm: 12000,
          maxFeedMmMin: 6000,
          holderAssembly: {
            holderId: 'CAT40-ER32-70'
          }
        },
        {
          id: 'T2-DRILL-10',
          name: '10mm Through-Coolant Drill',
          diameterMm: 10.0,
          fluteLengthMm: 45.0,
          maxRpm: 6000,
          maxFeedMmMin: 2000,
          holderAssembly: {
            holderId: 'CAT40-HYDRAULIC-60'
          }
        }
      ],
      traceability: {
        masterHash: 'FP-SHA256-AERO-FLANGE-DIGITAL-THREAD',
        totalNodes: 3
      }
    };
  }
}
