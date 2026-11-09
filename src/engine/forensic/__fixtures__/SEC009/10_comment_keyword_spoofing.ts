import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

// capability note: SealingCapability is validated by external proxy
export function executeKeywordSpoofedBypass(binding: any) {
  return CanonicalDomainBindingEngine.sealBinding(binding, null as any);
}
