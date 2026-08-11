import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';

export const AerospacePlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-aerospace',
    name: 'Aerospace & Avionics Workbench',
    version: '1.4.0',
    author: 'SECP Flight Dynamics Group',
    category: 'aerospace',
    description: 'Compressible Supersonic Mach Flow, Wing Spar Deflection, Thermal Protection Shielding & Flight Envelope.',
    enabled: true,
    iconName: 'Plane',
  },
  defaultParameters: {
    altitudeM: 11000,
    velocityMs: 250,
    wingSpanM: 18.5,
    chordM: 2.8,
    fuelMassKg: 4200,
  },
  tools: [
    {
      id: 'mach-flow',
      name: 'Compressible Mach Number & Shock Wave',
      description: 'Determines local Mach number, speed of sound at altitude, and shock wave angle.',
      compute: (inputs) => {
        const altM = inputs.altitudeM || 11000;
        const vMs = inputs.velocityMs || 250;

        // Speed of sound at standard atmosphere model
        const tempK = Math.max(216.65, 288.15 - 0.0065 * altM);
        const speedOfSoundMs = Math.sqrt(1.4 * 287.05 * tempK);
        const machNumber = vMs / speedOfSoundMs;

        let regime = 'Subsonic';
        if (machNumber >= 5.0) regime = 'Hypersonic';
        else if (machNumber >= 1.2) regime = 'Supersonic';
        else if (machNumber >= 0.8) regime = 'Transonic';

        const machAngleDeg = machNumber > 1.0 ? (Math.asin(1 / machNumber) * 180) / Math.PI : 0;

        return {
          machNumber: parseFloat(machNumber.toFixed(3)),
          speedOfSoundMs: parseFloat(speedOfSoundMs.toFixed(1)),
          flowRegime: regime,
          machShockAngleDeg: parseFloat(machAngleDeg.toFixed(1)),
        };
      },
    },
  ],
};
