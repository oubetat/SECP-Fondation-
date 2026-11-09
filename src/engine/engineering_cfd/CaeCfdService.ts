/**
 * SECP Industrial OS - PATCH-377 CFD Engineering Service
 * Orchestrates CFD solver execution, provenance tracking, and canonical dispatch
 * for digital thread compliance.
 */
import { CfdEngine, CfdFlowResult } from '../cfdEngine';
import { CfdTool277 } from '../viewport/CfdTool277';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { MeshSet } from '../physics/mesh/MeshTypes';

export interface CfdSimulationParams {
  inletVelocity: number;
  fluidViscosity: number;
  density: number;
  maxSteps: number;
  mesh?: MeshSet; // Optional explicit mesh
}

export class CaeCfdService {
  private static instance: CaeCfdService;
  private cfdTool: CfdTool277;

  private constructor() {
    this.cfdTool = new CfdTool277();
  }

  public static getInstance(): CaeCfdService {
    if (!CaeCfdService.instance) {
      CaeCfdService.instance = new CaeCfdService();
    }
    return CaeCfdService.instance;
  }

  public async runSimulation(params: CfdSimulationParams, expectedGeometryHash?: string): Promise<CfdFlowResult> {
    // If no mesh is provided, we use a fallback to keep the service functional,
    // but the guardrail in CfdEngine will now enforce structural integrity if a mesh object is passed.
    
    if (params.mesh) {
      return CfdEngine.runSimulation(
        params.mesh,
        params.inletVelocity,
        params.density,
        params.fluidViscosity,
        params.maxSteps,
        expectedGeometryHash
      );
    }

    // Legacy fallback for when mesh-less simulation is requested (e.g. analytical 1D)
    return CfdEngine.solveIncompressibleRANS(
      null,
      params.inletVelocity,
      params.fluidViscosity,
      params.maxSteps,
      params.density
    );
  }

  public async commitToCanonicalDocument(
    document: EngineeringDocument,
    params: CfdSimulationParams,
    result: CfdFlowResult
  ): Promise<EngineeringDocument | null> {
    const intent = this.cfdTool.createIntent(document.documentId, {
      inletVelocity: params.inletVelocity,
      fluidDensity: params.density,
      viscosity: params.fluidViscosity,
      convergenceIterations: params.maxSteps,
      cellCount: result.points?.length || 250,
      results: {
        reynoldsNumber: result.reynoldsNumber,
        pressureDropPa: result.pressureDropPa || (result.pressureDropKPa * 1000),
        flowRegime: result.flowRegime,
        maxVelocity: result.maxVelocityMS,
      },
    });

    const dispatchResult = await this.cfdTool.execute(intent, document);
    if (dispatchResult.success && dispatchResult.document) {
      return dispatchResult.document;
    }
    console.error('CFD Canonical Intent Dispatch Failed:', dispatchResult.error);
    return null;
  }
}
