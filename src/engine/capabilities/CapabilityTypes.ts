/**
 * SECP Industrial OS v3 — PATCH-187: Industrial Capability Dashboard Types
 * Defines the formal structure for engineering capabilities, maturity models, and industrial metrics.
 */

export enum CapabilityMaturity {
  EXPERIMENTAL = 'EXPERIMENTAL',
  IMPLEMENTED = 'IMPLEMENTED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  INDUSTRIAL = 'INDUSTRIAL',
  PRODUCTION_PROVEN = 'PRODUCTION_PROVEN'
}

export enum CapabilityStatus {
  SUPPORTED = 'SUPPORTED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  PRODUCTION_PROVEN = 'PRODUCTION_PROVEN',
  UNSUPPORTED = 'UNSUPPORTED',
  PARTIALLY_SUPPORTED = 'PARTIALLY_SUPPORTED',
  KNOWN_LIMITATION = 'KNOWN_LIMITATION'
}

export type EngineeringDomain = 
  | 'CAD' 
  | 'CFD' 
  | 'FEM' 
  | 'CAM' 
  | 'ASSEMBLY' 
  | 'PLM' 
  | 'HPC' 
  | 'INTEROP';

export interface PerformanceMetrics {
  medianExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  memoryUsageMb: number;
  throughput?: number;
  scalabilityFactor?: number;
  cpuUtilization?: number;
  gpuUtilization?: number;
  workerScaling?: number;
}

export interface EngineeringCapability {
  id: string;
  domain: EngineeringDomain;
  name: string;
  description: string;
  maturity: CapabilityMaturity;
  status: CapabilityStatus;
  isVerified: boolean;
  isValidated: boolean;
  isProductionProven: boolean;
  coverage: number; // 0.0 - 1.0
  performance: PerformanceMetrics;
  supportedScope: string[];
  unsupportedScope: string[];
  knownLimitations: string[];
  evidenceReferences: string[];
  benchmarkReferences: string[];
  lastVerification: string;
  runtimeVersion: string;
  determinismStatus: 'PASS' | 'FAIL' | 'UNPROVEN';
  industrialScore: number; // 0-100
}

export interface DomainCapabilityReport {
  domain: EngineeringDomain;
  overallStatus: CapabilityStatus;
  maturity: CapabilityMaturity;
  capabilities: EngineeringCapability[];
  score: number;
}

export interface IndustrialCapabilityState {
  version: {
    secp: string;
    kernel: string;
    solver: string;
    runtime: string;
    benchmark: string;
  };
  domains: Record<EngineeringDomain, DomainCapabilityReport>;
  globalScore: number;
  timestamp: string;
}

export interface RegressionImpact {
  capabilityId: string;
  affectedBy: string; // e.g. "CAD_KERNEL_UPDATE"
  previousStatus: CapabilityStatus;
  currentStatus: CapabilityStatus;
  deltaPerformance?: number;
  evidenceId: string;
}
