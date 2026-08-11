import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';

export const MarinePlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-marine',
    name: 'Marine & Naval Hydrodynamics Workbench',
    version: '1.1.0',
    author: 'SECP Naval Architecture Center',
    category: 'marine',
    description: 'Hull Hydrodynamic Drag, Archimedes Buoyancy Displacement, Metacentric Height ($GM$) & Wave Slamming.',
    enabled: true,
    iconName: 'Anchor',
  },
  defaultParameters: {
    hullLengthM: 45,
    hullBeamM: 8.5,
    draftM: 2.8,
    shipSpeedKnots: 18,
    seawaterDensityKgM3: 1025,
  },
  tools: [
    {
      id: 'buoyancy-gm',
      name: 'Hydrodynamic Buoyancy & Metacentric Stability',
      description: 'Calculates displacement mass, Froude number, and metacentric height ($GM$) stability index.',
      compute: (inputs) => {
        const lengthM = inputs.hullLengthM || 45;
        const beamM = inputs.hullBeamM || 8.5;
        const draftM = inputs.draftM || 2.8;
        const speedMs = (inputs.shipSpeedKnots || 18) * 0.514444;
        const rho = inputs.seawaterDensityKgM3 || 1025;

        const blockCoeff = 0.65; // Typical hull form coefficient
        const displacedVolM3 = lengthM * beamM * draftM * blockCoeff;
        const displacementTonnes = (displacedVolM3 * rho) / 1000;

        const froudeNumber = speedMs / Math.sqrt(9.81 * lengthM);
        const GM = (Math.pow(beamM, 2) / (12 * draftM)) * 0.8; // Metacentric height estimate

        return {
          displacementTonnes: parseFloat(displacementTonnes.toFixed(1)),
          froudeNumber: parseFloat(froudeNumber.toFixed(3)),
          metacentricHeightGMM: parseFloat(GM.toFixed(2)),
          stabilityStatus: GM > 0.5 ? 'EXCELLENT_STABILITY' : 'MARGINAL_HEEL',
        };
      },
    },
  ],
};
