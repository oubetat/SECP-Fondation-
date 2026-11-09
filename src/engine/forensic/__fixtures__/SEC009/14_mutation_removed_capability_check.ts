import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

// Simulates an unauthenticated caller executing under a removed capability validation mutation
export function executeMutatedCapabilityBypass(binding: any) {
  const unvalidatedCap: any = undefined;
  return CanonicalDomainBindingEngine.sealBinding(binding, unvalidatedCap);
}
