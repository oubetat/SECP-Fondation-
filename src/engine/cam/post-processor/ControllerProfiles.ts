/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — Controller Profiles & Post Processor Definitions
 * 
 * Provides verified controller profiles for:
 * 1. Generic ISO (ISO 6983 Standard G-code)
 * 2. Fanuc 31i-B5 (High-Speed & 5-Axis G43.4 TCPC)
 * 3. Siemens Sinumerik 840D sl / ONE (TRAORI, CYCLE800, High-End Kinematics)
 * 4. Heidenhain TNC 640 / TNC 7 (M128 / TCPM, Plane Spatial, Klartext/ISO)
 * 5. Haas Next Generation Control (NGC, G254 DWO, G234 TCPC)
 */

import { PostProcessorDefinition, ControllerDialect, UnitsMode } from './PostTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export class ControllerProfiles {
  private static profiles: Map<string, PostProcessorDefinition> = new Map();

  /**
   * Initializes all standard controller post definitions
   */
  public static async initialize(): Promise<void> {
    if (this.profiles.size > 0) return;

    // 1. GENERIC ISO POST
    const genericISO = await this.buildProfile({
      postId: 'POST_GENERIC_ISO',
      name: 'Generic ISO 6983 (3-Axis & 4-Axis Standard)',
      version: '1.0.0',
      controllerDialect: 'GENERIC_ISO',
      supportedMachineTypes: ['MILL_3AXIS', 'MILL_4AXIS', 'MILL_5AXIS'],
      units: 'METRIC_MM',
      formatting: {
        linearFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        rotaryFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        feedFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        spindleFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        lineNumbers: { enabled: true, startNumber: 10, increment: 10, prefix: 'N', maxNumber: 99990 },
        commentDelimiters: { start: '(', end: ')' },
        programHeaderPrefix: '%',
        programFooterSuffix: '%'
      },
      safety: {
        initialStateWords: ['G90', 'G17', 'G21', 'G40', 'G80', 'G49'],
        homeReturnWords: ['G91', 'G28', 'Z0.'],
        toolChangeRetract: ['G91', 'G28', 'Z0.'],
        programEndWords: ['M5', 'M9', 'G91', 'G28', 'Z0.', 'M30']
      },
      supportedCycles: ['DRILL_G81', 'PECK_G83', 'TAP_G84', 'BORE_G85'],
      rtcpCapabilities: {
        supported: false,
        mode: 'OFF',
        entryCommand: '',
        exitCommand: ''
      },
      modalOptimization: true
    });
    this.profiles.set(genericISO.postId, genericISO);

    // 2. FANUC 31i-B5 POST
    const fanuc31i = await this.buildProfile({
      postId: 'POST_FANUC_31I',
      name: 'FANUC 31i-B5 (High-Precision 5-Axis G43.4 / AICC)',
      version: '2.4.0',
      controllerDialect: 'FANUC_31I',
      supportedMachineTypes: ['MILL_3AXIS', 'MILL_4AXIS', 'MILL_5AXIS'],
      units: 'METRIC_MM',
      formatting: {
        linearFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        rotaryFormat: { precision: 4, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        feedFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        spindleFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        lineNumbers: { enabled: true, startNumber: 10, increment: 10, prefix: 'N' },
        commentDelimiters: { start: '(', end: ')' },
        programHeaderPrefix: '%',
        programFooterSuffix: '%'
      },
      safety: {
        initialStateWords: ['G90', 'G17', 'G21', 'G40', 'G80', 'G49', 'G94'],
        homeReturnWords: ['G91', 'G28', 'Z0.'],
        toolChangeRetract: ['G91', 'G28', 'Z0.', 'G49'],
        programEndWords: ['M5', 'M9', 'G91', 'G28', 'Z0.', 'G28', 'X0.', 'Y0.', 'M30']
      },
      supportedCycles: ['DRILL_G81', 'PECK_G83', 'TAP_G84', 'BORE_G85', 'FINE_BORE_G76'],
      rtcpCapabilities: {
        supported: true,
        mode: 'G43.4_FANUC_TCPC',
        entryCommand: 'G43.4 H{T} ; TCPC ON',
        exitCommand: 'G49 ; TCPC OFF'
      },
      modalOptimization: true
    });
    this.profiles.set(fanuc31i.postId, fanuc31i);

    // 3. SIEMENS SINUMERIK 840D / ONE
    const siemens840D = await this.buildProfile({
      postId: 'POST_SIEMENS_840D',
      name: 'Siemens Sinumerik 840D sl / ONE (TRAORI / CYCLE800)',
      version: '3.1.0',
      controllerDialect: 'SIEMENS_840D',
      supportedMachineTypes: ['MILL_3AXIS', 'MILL_4AXIS', 'MILL_5AXIS'],
      units: 'METRIC_MM',
      formatting: {
        linearFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        rotaryFormat: { precision: 4, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        feedFormat: { precision: 1, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        spindleFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        lineNumbers: { enabled: true, startNumber: 10, increment: 10, prefix: 'N' },
        commentDelimiters: { start: ';', end: '' },
        programHeaderPrefix: '; %_N_SECP_CAM_MPF',
        programFooterSuffix: 'M30'
      },
      safety: {
        initialStateWords: ['G90', 'G17', 'G71', 'G64', 'CFIN', 'FFWOF'],
        homeReturnWords: ['SUPA', 'G0', 'Z0', 'D0'],
        toolChangeRetract: ['SUPA', 'G0', 'Z0', 'D0', 'TRAFOOF'],
        programEndWords: ['M5', 'M9', 'TRAFOOF', 'SUPA', 'G0', 'Z0', 'D0', 'M30']
      },
      supportedCycles: ['CYCLE81', 'CYCLE83', 'CYCLE84', 'CYCLE85', 'CYCLE800'],
      rtcpCapabilities: {
        supported: true,
        mode: 'TRAORI_SIEMENS',
        entryCommand: 'TRAORI(1) ; 5-AXIS TRANSFORMATION ON',
        exitCommand: 'TRAFOOF ; TRANSFORMATION OFF'
      },
      modalOptimization: true
    });
    this.profiles.set(siemens840D.postId, siemens840D);

    // 4. HEIDENHAIN TNC 640 (ISO & Klartext)
    const heidenhainTNC = await this.buildProfile({
      postId: 'POST_HEIDENHAIN_TNC640',
      name: 'Heidenhain TNC 640 (M128 / TCPM & Plane Spatial)',
      version: '2.8.0',
      controllerDialect: 'HEIDENHAIN_TNC640',
      supportedMachineTypes: ['MILL_3AXIS', 'MILL_4AXIS', 'MILL_5AXIS'],
      units: 'METRIC_MM',
      formatting: {
        linearFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        rotaryFormat: { precision: 4, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        feedFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        spindleFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        lineNumbers: { enabled: true, startNumber: 1, increment: 1, prefix: '' },
        commentDelimiters: { start: ';', end: '' },
        programHeaderPrefix: 'BEGIN PGM SECP_NC MM',
        programFooterSuffix: 'END PGM SECP_NC MM'
      },
      safety: {
        initialStateWords: ['G90', 'G17', 'G21', 'M129'],
        homeReturnWords: ['M91', 'G0', 'Z0'],
        toolChangeRetract: ['M129', 'M91', 'G0', 'Z0'],
        programEndWords: ['M5', 'M9', 'M129', 'M91', 'G0', 'Z0', 'M30']
      },
      supportedCycles: ['CYCL_200_DRILL', 'CYCL_203_PECK', 'CYCL_206_TAP', 'CYCL_208_BORE'],
      rtcpCapabilities: {
        supported: true,
        mode: 'M128_TCPM_HEIDENHAIN',
        entryCommand: 'FUNCTION TCPM F TCP AXIS SPAT ; TCPM ON',
        exitCommand: 'FUNCTION RESET TCPM ; TCPM OFF'
      },
      modalOptimization: true
    });
    this.profiles.set(heidenhainTNC.postId, heidenhainTNC);

    // 5. HAAS NGC (Next Gen Control with DWO / TCPC)
    const haasNGC = await this.buildProfile({
      postId: 'POST_HAAS_NGC',
      name: 'Haas NGC (Next Gen Control — G254 DWO & G234 TCPC)',
      version: '1.9.0',
      controllerDialect: 'HAAS_NGC',
      supportedMachineTypes: ['MILL_3AXIS', 'MILL_4AXIS', 'MILL_5AXIS'],
      units: 'METRIC_MM',
      formatting: {
        linearFormat: { precision: 3, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        rotaryFormat: { precision: 4, decimalPoint: true, forceSign: false, leadingZero: true, trailingZero: true },
        feedFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        spindleFormat: { precision: 0, decimalPoint: false, forceSign: false, leadingZero: true, trailingZero: false },
        lineNumbers: { enabled: true, startNumber: 10, increment: 10, prefix: 'N' },
        commentDelimiters: { start: '(', end: ')' },
        programHeaderPrefix: '%',
        programFooterSuffix: '%'
      },
      safety: {
        initialStateWords: ['G90', 'G17', 'G21', 'G40', 'G80', 'G49', 'G00'],
        homeReturnWords: ['G91', 'G28', 'Z0.'],
        toolChangeRetract: ['G91', 'G28', 'Z0.', 'G49', 'G255'],
        programEndWords: ['M5', 'M9', 'G255', 'G49', 'G91', 'G28', 'Z0.', 'G28', 'Y0.', 'M30']
      },
      supportedCycles: ['DRILL_G81', 'PECK_G83', 'TAP_G84', 'BORE_G85'],
      rtcpCapabilities: {
        supported: true,
        mode: 'G234_HAAS_TCPC',
        entryCommand: 'G234 H{T} ; HAAS TCPC ON',
        exitCommand: 'G49 ; HAAS TCPC OFF'
      },
      modalOptimization: true
    });
    this.profiles.set(haasNGC.postId, haasNGC);
  }

  private static async buildProfile(props: Omit<PostProcessorDefinition, 'postHash'>): Promise<PostProcessorDefinition> {
    const hash = await generateDeterministicHash({
      postId: props.postId,
      version: props.version,
      controllerDialect: props.controllerDialect,
      formatting: props.formatting,
      safety: props.safety,
      rtcp: props.rtcpCapabilities
    });

    return {
      ...props,
      postHash: hash
    };
  }

  public static getAllProfiles(): PostProcessorDefinition[] {
    return Array.from(this.profiles.values());
  }

  public static getProfileById(postId: string): PostProcessorDefinition | undefined {
    return this.profiles.get(postId);
  }

  public static getProfilesForDialect(dialect: ControllerDialect): PostProcessorDefinition[] {
    return Array.from(this.profiles.values()).filter(p => p.controllerDialect === dialect);
  }
}
