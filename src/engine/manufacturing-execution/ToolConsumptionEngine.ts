/**
 * PATCH-SECP-060 — Tool Consumption Engine
 * Traces measured offsets, spindle tool wear limits, and flags high wear thresholds.
 */

import { ToolConsumptionRecord } from './ManufacturingExecutionTypes';

export class ToolConsumptionEngine {
  /**
   * Initializes a default tracker for a physical cutter tool
   */
  public static createToolRecord(
    toolId: string,
    originalRevision: string,
    totalSpindleSecondsLimit: number = 3600
  ): ToolConsumptionRecord {
    return {
      toolId,
      originalRevision,
      measuredOffsetOffsetMm: 0.0,
      initialFeedUsageSec: 0,
      totalSpindleSecondsLimit,
      currentSpindleSecondsUsed: 0
    };
  }

  /**
   * 060-E: Log spindle hours / seconds used, check limits
   */
  public static incrementUsage(
    record: ToolConsumptionRecord,
    seconds: number
  ): ToolConsumptionRecord {
    const updatedSeconds = record.currentSpindleSecondsUsed + seconds;
    return {
      ...record,
      currentSpindleSecondsUsed: updatedSeconds
    };
  }

  /**
   * Updates wear offset values based on shop physical inspection
   */
  public static updateMeasuredOffset(
    record: ToolConsumptionRecord,
    offsetMm: number
  ): ToolConsumptionRecord {
    return {
      ...record,
      measuredOffsetOffsetMm: offsetMm
    };
  }

  /**
   * Checks if tool is worn beyond the allowed physical threshold (e.g. 90% or maximum life)
   */
  public static isToolWornOut(record: ToolConsumptionRecord): boolean {
    return record.currentSpindleSecondsUsed >= record.totalSpindleSecondsLimit;
  }
}
