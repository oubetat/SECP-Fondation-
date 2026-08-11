import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';

export const OilGasPlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-oil-gas',
    name: 'Oil, Gas & Subsea Infrastructure Workbench',
    version: '1.2.0',
    author: 'SECP Petroleum Engineering Group',
    category: 'oil-gas',
    description: 'High-Pressure Offshore Pipeline Barlow Hoop Stress ($\\sigma = \\frac{P \\cdot D}{2t}$), Valve Cavitation & Subsea Manifolds.',
    enabled: true,
    iconName: 'Database',
  },
  defaultParameters: {
    internalPressureMPa: 18.5,
    outerDiameterMm: 508, // 20 inch pipe
    wallThicknessMm: 15.8,
    materialYieldStrengthMPa: 450, // API 5L X65
    safetyFactorASME: 1.39,
  },
  tools: [
    {
      id: 'barlow-stress',
      name: 'ASME B31.8 Barlow Pipeline Hoop Stress',
      description: 'Calculates hoop stress, maximum allowable operating pressure (MAOP), and burst safety factor.',
      compute: (inputs) => {
        const pressMPa = inputs.internalPressureMPa || 18.5;
        const outerDiamMm = inputs.outerDiameterMm || 508;
        const wallThickMm = inputs.wallThicknessMm || 15.8;
        const yieldMPa = inputs.materialYieldStrengthMPa || 450;
        const sfAsme = inputs.safetyFactorASME || 1.39;

        // Barlow equation: Hoop Stress = P * D / (2 * t)
        const hoopStressMPa = (pressMPa * outerDiamMm) / (2 * wallThickMm);

        // MAOP = (2 * t * Yield * DesignFactor) / D
        const maopMPa = (2 * wallThickMm * yieldMPa * (1 / sfAsme)) / outerDiamMm;
        const actualSafetyFactor = yieldMPa / hoopStressMPa;

        return {
          hoopStressMPa: parseFloat(hoopStressMPa.toFixed(1)),
          maopMPa: parseFloat(maopMPa.toFixed(2)),
          actualSafetyFactor: parseFloat(actualSafetyFactor.toFixed(2)),
          asmeCompliance: hoopStressMPa <= yieldMPa / sfAsme ? 'COMPLIANT_PASS' : 'EXCEEDS_ASME_LIMIT',
        };
      },
    },
  ],
};
