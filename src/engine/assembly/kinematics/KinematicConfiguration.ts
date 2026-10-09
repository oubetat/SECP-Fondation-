import crypto from 'crypto';
import { JointCoordinateValue } from './KinematicJointModel';

export interface KinematicConfiguration {
  configurationId?: string;
  configurationHash?: string;
  assemblyId?: string;
  jointCoordinates: Record<string, JointCoordinateValue>;
  jointVelocities?: Record<string, number | number[] | { [key: string]: number }>;
  jointAccelerations?: Record<string, number | number[] | { [key: string]: number }>;
  bodyTransforms: Record<string, number[][]>;
  timestamp?: string;
  revisionId?: string;
}

/**
 * Normalizes coordinate values into deterministic string representations
 */
export function canonicalizeCoordinate(val: JointCoordinateValue): string {
  if (typeof val === 'number') {
    return val.toFixed(6);
  }
  if (Array.isArray(val)) {
    return `[${val.map(v => (typeof v === 'number' ? v.toFixed(6) : String(v))).join(',')}]`;
  }
  if (typeof val === 'object' && val !== null) {
    const keys = Object.keys(val).sort();
    return `{${keys.map(k => `${k}:${typeof (val as any)[k] === 'number' ? (val as any)[k].toFixed(6) : (val as any)[k]}`).join(',')}}`;
  }
  return String(val);
}

/**
 * Canonicalizes a 4x4 matrix into a deterministic string representation
 */
export function canonicalizeTransform(T: number[][]): string {
  return T.map(row => row.map(v => (typeof v === 'number' ? v.toFixed(6) : '0.000000')).join(',')).join(';');
}

/**
 * Computes deterministic SHA-256 hash of joint states
 */
export function computeJointStateHash(jointCoordinates: Record<string, JointCoordinateValue>): string {
  const sortedJointIds = Object.keys(jointCoordinates).sort();
  const canonicalStr = sortedJointIds
    .map(jId => `${jId}=${canonicalizeCoordinate(jointCoordinates[jId])}`)
    .join('|');

  return crypto.createHash('sha256').update(canonicalStr).digest('hex');
}

/**
 * Computes deterministic SHA-256 hash of all body transforms
 */
export function computeBodyTransformHash(bodyTransforms: Record<string, number[][]>): string {
  const sortedBodyIds = Object.keys(bodyTransforms).sort();
  const canonicalStr = sortedBodyIds
    .map(bId => `${bId}=${canonicalizeTransform(bodyTransforms[bId])}`)
    .join('|');

  return crypto.createHash('sha256').update(canonicalStr).digest('hex');
}

/**
 * Computes the full deterministic SHA-256 configuration hash
 */
export function computeConfigurationHash(config: KinematicConfiguration): string {
  const jointHash = computeJointStateHash(config.jointCoordinates);
  const bodyHash = computeBodyTransformHash(config.bodyTransforms);
  const rawStr = `${config.assemblyId}:${config.revisionId}:${jointHash}:${bodyHash}`;

  return crypto.createHash('sha256').update(rawStr).digest('hex');
}
