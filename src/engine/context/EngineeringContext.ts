/**
 * SECP Industrial OS — Engineering Truth Platform
 * Shared Engineering Context & Cross-Workbench Continuous State
 */

import { EngineeringDocument, FEAModel, CFDModel, CAMModel } from '../cad-kernel/document/CADDocument';
import { AssemblyComponentItem } from '../assembly';
import { CadSolidEntity } from '../cadKernel';

export type TruthOrigin = 
  | 'ACTIVE_MODEL'           // Directly derived from current CAD solid/BRep geometry (e.g. procedural FEM mesh, CAM toolpaths)
  | 'ANALYTICAL'              // CAD-derived analytical reduction / approximation (e.g. 1D/quasi-3D CFD)
  | 'REFERENCE_BENCHMARK'    // Benchmark verification dataset (explicitly loaded)
  | 'EMPTY_CANVAS';          // Active session has no CAD geometry or components (blank canvas)

export type EngineeringLifecycleState =
  | 'NOT_STARTED'
  | 'READY'
  | 'EXECUTING'
  | 'RESULT_AVAILABLE'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFIED'
  | 'FAILED'
  | 'RECOVERY_AVAILABLE';

export interface TruthProvenanceInput {
  hasActiveGeometry: boolean;
  algorithmType: 'PROCEDURAL_FEM_MESH' | 'ANALYTICAL_1D_CFD' | 'PARAMETRIC_CAM' | 'REFERENCE_BENCHMARK' | 'CLOSED_FORM';
  documentId?: string;
  revision?: number;
  inputHash?: string;
  isExecuting?: boolean;
  hasResult?: boolean;
  verificationPassed?: boolean;
  hasFailure?: boolean;
  evidenceId?: string;
  isBenchmarkMode?: boolean;
}

export interface TruthStatusDescriptor {
  status: TruthOrigin;
  lifecycle: EngineeringLifecycleState;
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  description: string;
  evidenceId?: string;
  revision?: number;
}

/**
 * Derives Truth Status from empirical engineering provenance rather than static UI flags.
 */
export function deriveTruthProvenance(input: TruthProvenanceInput): TruthStatusDescriptor {
  // 1. Determine Truth Origin based on algorithmic reality:
  let origin: TruthOrigin = 'EMPTY_CANVAS';
  if (input.isBenchmarkMode) {
    origin = 'REFERENCE_BENCHMARK';
  } else if (!input.hasActiveGeometry) {
    origin = 'EMPTY_CANVAS';
  } else if (input.algorithmType === 'ANALYTICAL_1D_CFD' || input.algorithmType === 'CLOSED_FORM') {
    origin = 'ANALYTICAL';
  } else if (input.hasActiveGeometry) {
    origin = 'ACTIVE_MODEL';
  }

  // 2. Determine Lifecycle State:
  let lifecycle: EngineeringLifecycleState = 'NOT_STARTED';
  if (input.hasFailure) {
    lifecycle = 'FAILED';
  } else if (input.isExecuting) {
    lifecycle = 'EXECUTING';
  } else if (input.verificationPassed && input.evidenceId) {
    lifecycle = 'VERIFIED';
  } else if (input.hasResult) {
    lifecycle = 'VERIFICATION_REQUIRED';
  } else if (input.hasActiveGeometry || input.isBenchmarkMode) {
    lifecycle = 'READY';
  }

  // 3. Construct descriptive label and telemetry styling
  let label = '';
  let colorClass = '';
  let borderClass = '';
  let bgClass = '';
  let description = '';

  switch (origin) {
    case 'ACTIVE_MODEL':
      label = `ACTIVE MODEL [REV ${input.revision ?? 1}] — ${lifecycle}`;
      colorClass = 'text-emerald-400';
      borderClass = 'border-emerald-500/40';
      bgClass = 'bg-emerald-950/30';
      description = 'Topology, boundary conditions, and solver pipelines execute directly on the active CAD B-Rep / solid geometry.';
      break;
    case 'ANALYTICAL':
      label = `CAD-DERIVED ANALYTICAL (1D/QUASI-3D) — ${lifecycle}`;
      colorClass = 'text-amber-400';
      borderClass = 'border-amber-500/40';
      bgClass = 'bg-amber-950/30';
      description = 'Derived from active model dimensions (hydraulic diameter, frontal area, span) using validated analytical flow equations.';
      break;
    case 'REFERENCE_BENCHMARK':
      label = `REFERENCE BENCHMARK DATASET — ${lifecycle}`;
      colorClass = 'text-sky-400';
      borderClass = 'border-sky-500/40';
      bgClass = 'bg-sky-950/30';
      description = 'Pre-calibrated benchmark model for verifying solver convergence and baseline numeric gate criteria.';
      break;
    case 'EMPTY_CANVAS':
      label = `BLANK PROJECT CANVAS (0 GEOMETRY) — ${lifecycle}`;
      colorClass = 'text-slate-400';
      borderClass = 'border-slate-700/60';
      bgClass = 'bg-slate-900/40';
      description = 'Active project canvas is empty. Draw or import CAD geometry to derive engineering calculations.';
      break;
  }

  return {
    status: origin,
    lifecycle,
    label,
    colorClass,
    borderClass,
    bgClass,
    description,
    evidenceId: input.evidenceId,
    revision: input.revision
  };
}

export function getTruthStatusDescriptor(origin: TruthOrigin): TruthStatusDescriptor {
  return deriveTruthProvenance({
    hasActiveGeometry: origin !== 'REFERENCE_BENCHMARK',
    algorithmType: origin === 'ANALYTICAL' ? 'ANALYTICAL_1D_CFD' : 'PROCEDURAL_FEM_MESH',
    isBenchmarkMode: origin === 'REFERENCE_BENCHMARK'
  });
}
