import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

export function executeIndirectReflect(binding: any) {
  const fn = Reflect.get(CanonicalDomainBindingEngine, "sealBinding");
  return fn.apply(null, [binding, null]);
}
