export async function executeDynamicImportBypass(binding: any) {
  const mod = await import("../../../crossdomain/CanonicalDomainBindingEngine");
  return mod.CanonicalDomainBindingEngine.sealBinding(binding, null as any);
}
