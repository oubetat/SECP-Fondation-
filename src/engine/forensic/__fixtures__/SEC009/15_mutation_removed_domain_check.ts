import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";
import { issueSealingCapability } from "../../../simulation/SimulationSealingAuthorization";

// Simulates an unauthorized caller executing under a removed domain-scope validation mutation
export function executeMutatedDomainBypass(binding: any) {
  const emptyDomainCap = issueSealingCapability("empty_domain_exploit", []);
  return CanonicalDomainBindingEngine.sealBinding(binding, emptyDomainCap);
}
