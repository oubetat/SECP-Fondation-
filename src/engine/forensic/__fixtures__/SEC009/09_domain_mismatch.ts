import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";
import { issueSealingCapability } from "../../../simulation/SimulationSealingAuthorization";

export function executeDomainMismatchBypass(binding: any) {
  const cfdOnlyCap = issueSealingCapability("cfd_agent", ["cfd"]);
  return CanonicalDomainBindingEngine.sealBinding(binding, cfdOnlyCap);
}
