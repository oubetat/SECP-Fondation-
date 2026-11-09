import { CanonicalDomainBindingEngine } from "../../../crossdomain/CanonicalDomainBindingEngine";

const aliasSeal = CanonicalDomainBindingEngine.sealBinding;

export function executeAliasedBypass(binding: any) {
  return aliasSeal(binding, null as any);
}
