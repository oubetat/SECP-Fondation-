/**
 * PATCH-SECP-228 — Motion Link Factory
 * 
 * Factory methods for instantiating validated physical Motion Links:
 *  - Gear Ratio Pair Link
 *  - Belt & Pulley Link (Open & Crossed)
 *  - Rack & Pinion Link
 *  - Screw & Nut Link
 *  - Linear & Angular Couplings
 *  - Cam & Follower Link
 *  - Crank & Slider Link
 *  - Differential Motion Link
 *  - Custom Parametric Transfer Function
 */

import {
  MotionLink,
  GearLinkParameters,
  BeltPulleyParameters,
  RackPinionParameters,
  ScrewNutParameters,
  CamFollowerParameters,
  CrankSliderParameters,
  DifferentialParameters,
  CustomParametricParameters
} from './MotionLinkTypes';
import { MotionLinkPLMBridge } from './MotionLinkPLMBridge';

export class MotionLinkFactory {
  /**
   * 1. Creates a Gear Ratio Motion Link
   */
  public static createGearRatioLink(config: {
    id: string;
    name: string;
    driverComponentId: string;
    followerComponentId: string;
    driverJointId: string;
    followerJointId: string;
    teethDriver: number;
    teethFollower: number;
    moduleMm?: number;
    pressureAngleDeg?: number;
    centerDistanceMm?: number;
    isInternalMesh?: boolean;
  }): MotionLink {
    const m = config.moduleMm || 2.0;
    const d1 = m * config.teethDriver;
    const d2 = m * config.teethFollower;
    const isInternal = config.isInternalMesh || false;
    const nominalC = isInternal ? Math.abs(d2 - d1) / 2 : (d1 + d2) / 2;

    const gearParams: GearLinkParameters = {
      teethDriver: config.teethDriver,
      teethFollower: config.teethFollower,
      pitchDiameterDriverMm: d1,
      pitchDiameterFollowerMm: d2,
      moduleMm: m,
      pressureAngleDeg: config.pressureAngleDeg || 20.0,
      centerDistanceMm: config.centerDistanceMm !== undefined ? config.centerDistanceMm : nominalC,
      allowedCenterDistanceToleranceMm: 1.0,
      isInternalMesh: isInternal
    };

    const ratio = (isInternal ? 1 : -1) * (config.teethDriver / config.teethFollower);

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'GEAR_RATIO',
      driverComponentId: config.driverComponentId,
      followerComponentId: config.followerComponentId,
      driverJointId: config.driverJointId,
      followerJointId: config.followerJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'ROTATION_Z',
      ratio,
      direction: isInternal ? 'SAME' : 'OPPOSITE',
      offset: 0,
      gearParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: 0,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }

  /**
   * 2. Creates a Belt & Pulley Motion Link
   */
  public static createBeltPulleyLink(config: {
    id: string;
    name: string;
    driverComponentId: string;
    followerComponentId: string;
    driverJointId: string;
    followerJointId: string;
    pulleyDiameterDriverMm: number;
    pulleyDiameterFollowerMm: number;
    beltType: 'OPEN' | 'CROSSED';
    centerDistanceMm: number;
  }): MotionLink {
    const d1 = config.pulleyDiameterDriverMm;
    const d2 = config.pulleyDiameterFollowerMm;
    const C = config.centerDistanceMm;
    const isCrossed = config.beltType === 'CROSSED';

    const rDiff = Math.abs(d1 - d2) / 2.0;
    const rSum = (d1 + d2) / 2.0;
    const calculatedLength = isCrossed
      ? 2 * Math.sqrt(Math.max(0, C * C - rSum * rSum)) + Math.PI * rSum + 2 * rSum * Math.asin(Math.min(1, rSum / C))
      : 2 * Math.sqrt(Math.max(0, C * C - rDiff * rDiff)) + (Math.PI / 2) * (d1 + d2) + (Math.pow(d1 - d2, 2) / (4 * C));

    const beltParams: BeltPulleyParameters = {
      pulleyDiameterDriverMm: d1,
      pulleyDiameterFollowerMm: d2,
      beltType: config.beltType,
      centerDistanceMm: C,
      calculatedBeltLengthMm: calculatedLength,
      minCenterDistanceMm: (d1 + d2) / 2 + 10,
      maxCenterDistanceMm: C * 3
    };

    const ratio = (isCrossed ? -1.0 : 1.0) * (d1 / d2);

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'BELT_PULLEY',
      driverComponentId: config.driverComponentId,
      followerComponentId: config.followerComponentId,
      driverJointId: config.driverJointId,
      followerJointId: config.followerJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'ROTATION_Z',
      ratio,
      direction: isCrossed ? 'OPPOSITE' : 'SAME',
      offset: 0,
      beltParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: 0,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }

  /**
   * 3. Creates a Rack & Pinion Motion Link (Rotation -> Linear)
   */
  public static createRackPinionLink(config: {
    id: string;
    name: string;
    pinionComponentId: string;
    rackComponentId: string;
    pinionJointId: string;
    rackJointId: string;
    pinionPitchRadiusMm: number;
    moduleMm?: number;
  }): MotionLink {
    const r = config.pinionPitchRadiusMm;
    const rackPinionParams: RackPinionParameters = {
      pinionPitchRadiusMm: r,
      moduleMm: config.moduleMm || 2.0,
      pressureAngleDeg: 20.0,
      rackAxis: { x: 1, y: 0, z: 0 },
      linearDisplacementPerRevMm: 2 * Math.PI * r
    };

    const ratioMmPerDeg = r * (Math.PI / 180.0);

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'RACK_PINION',
      driverComponentId: config.pinionComponentId,
      followerComponentId: config.rackComponentId,
      driverJointId: config.pinionJointId,
      followerJointId: config.rackJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'TRANSLATION_X',
      ratio: ratioMmPerDeg,
      direction: 'SAME',
      offset: 0,
      rackPinionParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: 0,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }

  /**
   * 4. Creates a Screw & Nut Motion Link
   */
  public static createScrewNutLink(config: {
    id: string;
    name: string;
    screwComponentId: string;
    nutComponentId: string;
    screwJointId: string;
    nutJointId: string;
    pitchMm: number;
    numStarts?: number;
    hand?: 'RIGHT_HAND' | 'LEFT_HAND';
  }): MotionLink {
    const pitch = config.pitchMm;
    const numStarts = config.numStarts || 1;
    const lead = pitch * numStarts;
    const hand = config.hand || 'RIGHT_HAND';

    const screwNutParams: ScrewNutParameters = {
      pitchMm: pitch,
      leadMm: lead,
      numStarts,
      hand,
      meanDiameterMm: 16.0
    };

    const mmPerDeg = (lead / 360.0) * (hand === 'RIGHT_HAND' ? 1 : -1);

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'SCREW_NUT',
      driverComponentId: config.screwComponentId,
      followerComponentId: config.nutComponentId,
      driverJointId: config.screwJointId,
      followerJointId: config.nutJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'TRANSLATION_Z',
      ratio: mmPerDeg,
      direction: hand === 'RIGHT_HAND' ? 'SAME' : 'OPPOSITE',
      offset: 0,
      screwNutParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: 0,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }

  /**
   * 5. Creates a Cam & Follower Motion Link
   */
  public static createCamFollowerLink(config: {
    id: string;
    name: string;
    camComponentId: string;
    followerComponentId: string;
    camJointId: string;
    followerJointId: string;
    baseRadiusMm?: number;
    totalLiftMm: number;
    motionLaw?: 'CYCLOIDAL' | 'SIMPLE_HARMONIC';
    riseAngleDeg?: number;
    returnAngleDeg?: number;
  }): MotionLink {
    const camParams: CamFollowerParameters = {
      baseRadiusMm: config.baseRadiusMm || 35.0,
      rollerRadiusMm: 10.0,
      totalLiftMm: config.totalLiftMm,
      motionLaw: config.motionLaw || 'CYCLOIDAL',
      followerType: 'TRANSLATING_ROLLER',
      dwellAngle1Deg: 60.0,
      riseAngleDeg: config.riseAngleDeg || 120.0,
      dwellAngle2Deg: 60.0,
      returnAngleDeg: config.returnAngleDeg || 120.0
    };

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'CAM_FOLLOWER',
      driverComponentId: config.camComponentId,
      followerComponentId: config.followerComponentId,
      driverJointId: config.camJointId,
      followerJointId: config.followerJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'TRANSLATION_Y',
      ratio: 1.0,
      direction: 'SAME',
      offset: 0,
      camParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: 0,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }

  /**
   * 6. Creates a Crank & Slider Motion Link
   */
  public static createCrankSliderLink(config: {
    id: string;
    name: string;
    crankComponentId: string;
    sliderComponentId: string;
    crankJointId: string;
    sliderJointId: string;
    crankRadiusMm: number;
    connectingRodLengthMm: number;
    eccentricityOffsetMm?: number;
  }): MotionLink {
    const crankSliderParams: CrankSliderParameters = {
      crankRadiusMm: config.crankRadiusMm,
      connectingRodLengthMm: config.connectingRodLengthMm,
      eccentricityOffsetMm: config.eccentricityOffsetMm || 0,
      sliderAxis: { x: 1, y: 0, z: 0 },
      fullStrokeMm: 2 * config.crankRadiusMm
    };

    const link: MotionLink = {
      id: config.id,
      name: config.name,
      type: 'CRANK_SLIDER',
      driverComponentId: config.crankComponentId,
      followerComponentId: config.sliderComponentId,
      driverJointId: config.crankJointId,
      followerJointId: config.sliderJointId,
      driverDofName: 'ROTATION_Z',
      followerDofName: 'TRANSLATION_X',
      ratio: 1.0,
      direction: 'SAME',
      offset: 0,
      crankSliderParams,
      state: 'VALID',
      isSuppressed: false,
      evaluatedPosition: config.crankRadiusMm + config.connectingRodLengthMm,
      evaluatedVelocity: 0,
      evaluatedAcceleration: 0,
      revision: 1,
      driverRevision: 1,
      followerRevision: 1,
      driverJointRevision: 1,
      followerJointRevision: 1,
      solverVersion: '228.1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      evidenceHash: ''
    };

    link.evidenceHash = MotionLinkPLMBridge.computeEvidenceHash(link);
    return link;
  }
}
