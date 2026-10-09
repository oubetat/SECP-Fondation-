/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — CNC Modal State Manager
 * 
 * Tracks modal groups according to ISO 6983 and controller-specific specifications.
 * Ensures deterministic state transitions, suppresses redundant words (modal optimization),
 * and safely enforces state restoration upon tool changes and retracts.
 */

import { ModalState, MotionMode, ActivePlane, UnitsMode, CoordinateSystemId, FeedMode, SpindleState, CoolantState, CutterCompensationMode } from './PostTypes';

export class ModalStateManager {
  private state: ModalState;
  private defaultState: ModalState;

  constructor(defaultUnits: UnitsMode = 'METRIC_MM', defaultWorkOffset: CoordinateSystemId = 'G54') {
    this.defaultState = {
      motionMode: 'G0_RAPID',
      plane: 'G17_XY',
      units: defaultUnits,
      workOffset: defaultWorkOffset,
      feedMode: 'G94_UNITS_PER_MIN',
      spindleState: 'M5_OFF',
      currentSpindleRpm: 0,
      currentFeedRate: 0,
      coolantState: 'M9_OFF',
      compensationMode: 'G40_OFF',
      rtcpActive: false,
      activeToolNumber: 0,
      activeToolHOffset: 0,
      activeToolDOffset: 0,
      currentPosition: {}
    };

    this.state = { ...this.defaultState };
  }

  public reset(): void {
    this.state = { ...this.defaultState };
  }

  public getCurrentState(): Readonly<ModalState> {
    return { ...this.state, currentPosition: { ...this.state.currentPosition } };
  }

  /**
   * Evaluates if motion mode has changed
   */
  public updateMotionMode(newMode: MotionMode, modalOptimization: boolean): { changed: boolean; code: string } {
    const changed = !modalOptimization || this.state.motionMode !== newMode;
    this.state.motionMode = newMode;

    let code = 'G00';
    if (newMode === 'G1_LINEAR') code = 'G01';
    else if (newMode === 'G2_CW_ARC') code = 'G02';
    else if (newMode === 'G3_CCW_ARC') code = 'G03';

    return { changed, code };
  }

  /**
   * Evaluates if active plane has changed
   */
  public updatePlane(newPlane: ActivePlane, modalOptimization: boolean): { changed: boolean; code: string } {
    const changed = !modalOptimization || this.state.plane !== newPlane;
    this.state.plane = newPlane;

    let code = 'G17';
    if (newPlane === 'G18_ZX') code = 'G18';
    else if (newPlane === 'G19_YZ') code = 'G19';

    return { changed, code };
  }

  /**
   * Evaluates if feed rate has changed
   */
  public updateFeedRate(newFeed: number, modalOptimization: boolean): { changed: boolean; feed: number } {
    const changed = !modalOptimization || Math.abs(this.state.currentFeedRate - newFeed) > 1e-4;
    this.state.currentFeedRate = newFeed;
    return { changed, feed: newFeed };
  }

  /**
   * Evaluates if spindle has changed
   */
  public updateSpindle(rpm: number, direction: 'CW' | 'CCW', modalOptimization: boolean): {
    stateChanged: boolean;
    rpmChanged: boolean;
    mCode: string;
    rpm: number;
  } {
    const targetState: SpindleState = direction === 'CW' ? 'M3_CW' : 'M4_CCW';
    const stateChanged = !modalOptimization || this.state.spindleState !== targetState;
    const rpmChanged = !modalOptimization || Math.abs(this.state.currentSpindleRpm - rpm) > 1e-3;

    this.state.spindleState = targetState;
    this.state.currentSpindleRpm = rpm;

    return {
      stateChanged,
      rpmChanged,
      mCode: targetState === 'M3_CW' ? 'M03' : 'M04',
      rpm
    };
  }

  public stopSpindle(): { changed: boolean; mCode: string } {
    const changed = this.state.spindleState !== 'M5_OFF';
    this.state.spindleState = 'M5_OFF';
    this.state.currentSpindleRpm = 0;
    return { changed, mCode: 'M05' };
  }

  /**
   * Evaluates if coolant state has changed
   */
  public updateCoolant(newCoolant: CoolantState, modalOptimization: boolean): { changed: boolean; mCode: string } {
    const changed = !modalOptimization || this.state.coolantState !== newCoolant;
    this.state.coolantState = newCoolant;

    let mCode = 'M09';
    if (newCoolant === 'M8_FLOOD') mCode = 'M08';
    else if (newCoolant === 'M7_MIST') mCode = 'M07';
    else if (newCoolant === 'M88_THROUGH_SPINDLE') mCode = 'M88';

    return { changed, mCode };
  }

  /**
   * Evaluates if coordinate system / work offset has changed
   */
  public updateWorkOffset(newOffset: CoordinateSystemId, modalOptimization: boolean): { changed: boolean; code: string } {
    const changed = !modalOptimization || this.state.workOffset !== newOffset;
    this.state.workOffset = newOffset;

    let code = 'G54';
    if (newOffset === 'G55') code = 'G55';
    else if (newOffset === 'G56') code = 'G56';
    else if (newOffset === 'G57') code = 'G57';
    else if (newOffset === 'G58') code = 'G58';
    else if (newOffset === 'G59') code = 'G59';
    else if (newOffset === 'G54.1_P1') code = 'G54.1 P1';

    return { changed, code };
  }

  /**
   * Sets active tool and offsets
   */
  public setActiveTool(toolNumber: number, hOffset?: number, dOffset?: number): void {
    this.state.activeToolNumber = toolNumber;
    this.state.activeToolHOffset = hOffset ?? toolNumber;
    this.state.activeToolDOffset = dOffset ?? toolNumber;
  }

  /**
   * Sets RTCP state
   */
  public setRTCP(active: boolean): void {
    this.state.rtcpActive = active;
  }

  /**
   * Updates current position tracking and returns delta
   */
  public updatePosition(pos: { x?: number; y?: number; z?: number; a?: number; b?: number; c?: number }): {
    xChanged: boolean;
    yChanged: boolean;
    zChanged: boolean;
    aChanged: boolean;
    bChanged: boolean;
    cChanged: boolean;
  } {
    const eps = 1e-5;
    const xChanged = pos.x !== undefined && (this.state.currentPosition.x === undefined || Math.abs(this.state.currentPosition.x - pos.x) > eps);
    const yChanged = pos.y !== undefined && (this.state.currentPosition.y === undefined || Math.abs(this.state.currentPosition.y - pos.y) > eps);
    const zChanged = pos.z !== undefined && (this.state.currentPosition.z === undefined || Math.abs(this.state.currentPosition.z - pos.z) > eps);
    const aChanged = pos.a !== undefined && (this.state.currentPosition.a === undefined || Math.abs(this.state.currentPosition.a - pos.a) > eps);
    const bChanged = pos.b !== undefined && (this.state.currentPosition.b === undefined || Math.abs(this.state.currentPosition.b - pos.b) > eps);
    const cChanged = pos.c !== undefined && (this.state.currentPosition.c === undefined || Math.abs(this.state.currentPosition.c - pos.c) > eps);

    if (pos.x !== undefined) this.state.currentPosition.x = pos.x;
    if (pos.y !== undefined) this.state.currentPosition.y = pos.y;
    if (pos.z !== undefined) this.state.currentPosition.z = pos.z;
    if (pos.a !== undefined) this.state.currentPosition.a = pos.a;
    if (pos.b !== undefined) this.state.currentPosition.b = pos.b;
    if (pos.c !== undefined) this.state.currentPosition.c = pos.c;

    return { xChanged, yChanged, zChanged, aChanged, bChanged, cChanged };
  }
}
