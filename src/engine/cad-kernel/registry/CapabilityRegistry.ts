/**
 * SECP CAD Kernel — Capability Registry
 */

export type CapabilityStatus = 
  | 'IMPLEMENTED' 
  | 'PARTIAL' 
  | 'BACKEND_DELEGATED' 
  | 'UNIMPLEMENTED' 
  | 'UNPROVEN';

export interface KernelOperationCapability {
  operation: string;
  status: CapabilityStatus;
  backend?: string;
  notes?: string;
}

export class CapabilityRegistry {
  private static capabilities: Map<string, KernelOperationCapability> = new Map();

  public static register(capability: KernelOperationCapability): void {
    this.capabilities.set(capability.operation, capability);
  }

  public static get(operation: string): KernelOperationCapability {
    return this.capabilities.get(operation) || {
      operation,
      status: 'UNIMPLEMENTED',
      notes: 'Unregistered capability'
    };
  }

  public static getAll(): KernelOperationCapability[] {
    return Array.from(this.capabilities.values());
  }

  public static isSupported(operation: string): boolean {
    const cap = this.get(operation);
    return cap.status === 'IMPLEMENTED' || cap.status === 'PARTIAL' || cap.status === 'BACKEND_DELEGATED';
  }
}
