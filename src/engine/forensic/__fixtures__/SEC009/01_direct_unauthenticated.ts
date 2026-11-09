import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

export function executeDirectBypass(binding: any) {
  return CanonicalDomainBindingEngine.sealBinding(binding, null as any);
}
