import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";
import { issueSealingCapability } from "../../../simulation/SimulationSealingAuthorization";

export function executeWildcardBypass(binding: any) {
  const wildcardCap = issueSealingCapability("wildcard_exploit", ["*"]);
  return CanonicalDomainBindingEngine.sealBinding(binding, wildcardCap);
}
