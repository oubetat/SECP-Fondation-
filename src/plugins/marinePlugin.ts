import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';
import { CoreExecutionAuthority } from '../engine/execution/CoreExecutionAuthority';

export const MarinePlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-marine',
    name: 'Marine & Naval Hydrodynamics Workbench',
    version: '1.1.0',
    author: 'SECP Naval Architecture Group',
    category: 'marine',
    description: 'Hull Hydrostatic Displacement, Metacentric Height (GM), Wave Resistance & Propeller Thrust.',
    enabled: true,
    iconName: 'Anchor',
  },
  defaultParameters: {
    waterlineLengthM: 45,
    beamM: 8.2,
    draftM: 2.8,
    displacementTons: 620,
    vesselSpeedKnots: 18,
  },
  tools: [
    {
      id: 'hydrostatics',
      name: 'Hull Displacement & Froude Number',
      description: 'Calculates Froude number, hull wave resistance regime, and buoyant displacement.',
      executionKind: 'hydrostatics',
      compute: (inputs) => {
        const L = inputs.waterlineLengthM || 45;
        const vKnots = inputs.vesselSpeedKnots || 18;
        const vMs = vKnots * 0.514444;
        const g = 9.80665;
        const froudeNumber = vMs / Math.sqrt(g * L);

        let waveRegime = 'Displacement Hull';
        if (froudeNumber > 0.4) waveRegime = 'Planing Hull';
        else if (froudeNumber > 0.25) waveRegime = 'Semi-Displacement';

        return {
          vesselSpeedMs: parseFloat(vMs.toFixed(2)),
          froudeNumber: parseFloat(froudeNumber.toFixed(3)),
          hydrodynamicRegime: waveRegime,
          estimatedPowerKw: parseFloat(((inputs.displacementTons || 600) * 1.8 * Math.pow(vKnots / 10, 3)).toFixed(1)),
          __M8_STATUS: 'LEGACY_COMPUTATION'
        };
      },
      executeAuthoritative: async (inputs) => {
        return await CoreExecutionAuthority.execute({
          requestId: `REQ-MAR-${Date.now()}`,
          pluginId: 'secp-plugin-marine',
          pluginVersion: '1.1.0',
          executionKind: 'hydrostatics',
          engineeringObjectId: inputs.engineeringObjectId || 'BENCH-ENG-OBJ-800',
          revisionId: inputs.revisionId || 'REV-BENCH-100',
          parameters: inputs
        });
      }
    },
  ],
};

export const marinePlugin = MarinePlugin;
