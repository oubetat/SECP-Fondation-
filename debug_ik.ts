
import { HumanEnvironmentInteractionEngine } from './src/engine/dhm/interaction/HumanEnvironmentInteractionEngine';
import { InteractionStatus } from './src/engine/dhm/interaction/types';

const target = { x: 400, y: -206, z: 200 };
const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
  {
    taskId: 'DEBUG',
    name: 'Debug',
    dhmProfileId: 'ANSUR2_MALE_P50',
    states: [{
      stateId: 'S1',
      description: 'D',
      targetPositionWCS: target,
      effectorRegion: 'RIGHT_HAND',
      requiresReachability: true,
      requiresVisibility: false
    }]
  },
  { objects: [] },
  { documentId: 'D', revision: 1 }
);

const s0 = analysis.states[0];
console.log('Status:', s0.status);
console.log('Reach Status:', s0.reachability?.status);
console.log('Residual:', s0.reachability?.positionResidualMm);
console.log('Solved Pose Hand Pos:', s0.reachability?.ikResult?.fkResult?.endEffectors['RIGHT_HAND']?.positionMm);
