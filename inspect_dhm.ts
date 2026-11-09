
import { AnthropometricDatasetRegistry } from './src/engine/dhm/anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from './src/engine/dhm/topology/SkeletalTopologyEngine';
import { HumanForwardKinematicsEngine } from './src/engine/dhm/kinematics/HumanForwardKinematicsEngine';
import { AnatomicalRegion } from './src/engine/dhm/types/SkeletalTopologyTypes';
import { TransformMatrix } from './src/engine/assembly/graph/TransformMatrix';

const registry = AnthropometricDatasetRegistry.getInstance();
const profile = registry.getProfile('ANSUR2_MALE_P50')!;
const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
const fk = HumanForwardKinematicsEngine.computeFK(skeleton, pose);

console.log('--- DHM DIMENSIONS (P50 MALE) ---');
for (const [region, state] of Object.entries(fk.segmentStates)) {
  const pos = TransformMatrix.extractTranslation((state as any).globalTransform);
  console.log(`${region}: { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} }`);
}

const head = TransformMatrix.extractTranslation(fk.segmentStates[AnatomicalRegion.HEAD].globalTransform);
console.log('Head Pos:', head.x, head.y, head.z);

const rightHand = fk.endEffectors['RIGHT_HAND'].positionMm;
console.log('Right Hand Tip Pos:', rightHand.x, rightHand.y, rightHand.z);
