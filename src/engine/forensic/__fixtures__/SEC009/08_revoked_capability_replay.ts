import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";
import { issueSealingCapability, revokeAllCapabilities } from "../../../simulation/SimulationSealingAuthorization";

export function executeRevokedReplay(binding: any) {
  const cap = issueSealingCapability("transient_replay", ["pcb"]);
  revokeAllCapabilities();
  return CanonicalDomainBindingEngine.sealBinding(binding, cap);
}
