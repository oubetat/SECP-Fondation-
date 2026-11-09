import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

export function unauthenticatedSealWrapper(binding: any, uncheckedToken: any) {
  return CanonicalDomainBindingEngine.sealBinding(binding, uncheckedToken);
}
