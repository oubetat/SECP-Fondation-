
import { HumanEnvironmentInteractionEngine } from './src/engine/dhm/interaction/HumanEnvironmentInteractionEngine';
import { HumanTaskDefinition, InteractionObject } from './src/engine/dhm/interaction/types';

const profileId = 'ANSUR2_MALE_P50';

const steeringWheel: InteractionObject = {
  objectId: 'STEERING_WHEEL_001',
  name: 'Steering Wheel',
  type: 'CONTROL',
  documentId: 'CAD_WHEEL_V1',
  interactionPoints: {
    'GRASP_TOP': {
      positionWCS: { x: 400, y: 0, z: 1000 },
      label: 'Top Grasp Position'
    }
  },
  geometryTriangles: [
    [{ x: 350, y: -50, z: 1000 }, { x: 450, y: -50, z: 1000 }, { x: 400, y: 50, z: 1000 }]
  ]
};

const dashboard = [
  [{ x: 200, y: -100, z: 800 }, { x: 200, y: 100, z: 800 }, { x: 200, y: 0, z: 1200 }]
];

const task: HumanTaskDefinition = {
  taskId: 'TASK_DRIVE_001',
  name: 'Grasp Steering Wheel',
  dhmProfileId: profileId,
  states: [
    {
      stateId: 'STATE_REACH_WHEEL',
      description: 'Reach and grasp the top of the steering wheel',
      targetObjectId: 'STEERING_WHEEL_001',
      targetPointKey: 'GRASP_TOP',
      effectorRegion: 'RIGHT_HAND',
      requiresReachability: true,
      requiresVisibility: true,
      externalLoadKg: 0.5,
      isLoadSymmetric: false
    }
  ]
};

const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
  task,
  { objects: [steeringWheel], globalObstacles: dashboard },
  { documentId: 'ENG_DOC_TASK_001', revision: 1 }
);

console.log('--- DEBUG TASK ANALYSIS ---');
console.log('Feasibility:', analysis.overallFeasibility);
console.log('Issues:', JSON.stringify(analysis.criticalIssues, null, 2));

const s0 = analysis.states[0];
console.log('--- STATE 0 ---');
console.log('Reachability Status:', s0.reachability?.status);
console.log('Visibility Status:', s0.visibility?.status);
console.log('Ergonomics Score:', JSON.stringify(s0.ergonomics?.scores, null, 2));
console.log('Ergonomics Evidence:', JSON.stringify(s0.ergonomics, null, 2));
