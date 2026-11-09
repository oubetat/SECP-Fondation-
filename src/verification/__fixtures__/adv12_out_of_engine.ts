import { CanonicalDomainBindingEngine } from "../../engine/crossdomain/CanonicalDomainBindingEngine";

export function executeOutOfEngineBypass(binding: any) {
  return CanonicalDomainBindingEngine.sealBinding(binding, null as any);
}
