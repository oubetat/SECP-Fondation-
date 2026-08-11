import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';

export const EnergyPlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-energy',
    name: 'Energy Systems & Turbomachinery Workbench',
    version: '1.3.0',
    author: 'SECP Renewable Energy Labs',
    category: 'energy',
    description: 'Wind Turbine Blade Aerodynamics ($P = \\frac{1}{2}\\rho A v^3 C_p$), Solar Thermal Loads & Pressure Vessel Stress.',
    enabled: true,
    iconName: 'Zap',
  },
  defaultParameters: {
    windSpeedMS: 12,
    rotorRadiusM: 42,
    powerCoefficientCp: 0.44,
    airDensityKgM3: 1.225,
    generatorEfficiencyPct: 92,
  },
  tools: [
    {
      id: 'wind-power',
      name: 'Wind Turbine Kinetic Power Output',
      description: 'Calculates Betz limit aerodynamic kinetic power extraction and electrical MW generation.',
      compute: (inputs) => {
        const vMs = inputs.windSpeedMS || 12;
        const radiusM = inputs.rotorRadiusM || 42;
        const cp = inputs.powerCoefficientCp || 0.44;
        const rho = inputs.airDensityKgM3 || 1.225;
        const eta = (inputs.generatorEfficiencyPct || 92) / 100;

        const sweptAreaM2 = Math.PI * Math.pow(radiusM, 2);
        const windKineticPowerW = 0.5 * rho * sweptAreaM2 * Math.pow(vMs, 3);
        const aeroPowerW = windKineticPowerW * cp;
        const electricalPowerKw = (aeroPowerW * eta) / 1000;
        const electricalPowerMw = electricalPowerKw / 1000;

        return {
          sweptAreaM2: parseFloat(sweptAreaM2.toFixed(1)),
          aeroPowerKW: parseFloat((aeroPowerW / 1000).toFixed(1)),
          electricalPowerMW: parseFloat(electricalPowerMw.toFixed(3)),
          capacityFactorPct: parseFloat(((electricalPowerMw / 3.5) * 100).toFixed(1)),
        };
      },
    },
  ],
};
