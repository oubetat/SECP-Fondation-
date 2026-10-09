import { ToolConsumptionRecord } from './ManufacturingExecutionTypes';

export class ToolConsumptionEngine {
  public static createToolRecord(
    toolId: string,
    originalRevision: string,
    initialFeedUsageSec: number = 0
  ): ToolConsumptionRecord {
    return {
      toolId,
      originalRevision,
      measuredOffsetOffsetMm: 0.002,
      initialFeedUsageSec,
      totalSpindleSecondsLimit: 3600,
      currentSpindleSecondsUsed: initialFeedUsageSec
    };
  }

  public static incrementUsage(record: ToolConsumptionRecord, seconds: number): ToolConsumptionRecord {
    return {
      ...record,
      currentSpindleSecondsUsed: record.currentSpindleSecondsUsed + seconds
    };
  }

  public static isToolWornOut(record: ToolConsumptionRecord): boolean {
    return record.currentSpindleSecondsUsed >= record.totalSpindleSecondsLimit;
  }
}
