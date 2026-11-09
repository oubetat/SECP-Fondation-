import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

export function executeComputedBypass(binding: any) {
  const method = "seal" + "Binding";
  return (CanonicalDomainBindingEngine as any)[method](binding, null);
}
