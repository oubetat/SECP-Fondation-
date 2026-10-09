import { EngineeringTask, PartitionType } from '../../engine/engineering_compute/types';

export class WorkPartitioner {
  public static partitionWorkload(
    parentTask: EngineeringTask,
    numPartitions: number,
    partitionType: PartitionType
  ): EngineeringTask[] {
    const partitions: EngineeringTask[] = [];

    for (let i = 0; i < numPartitions; i++) {
      partitions.push({
        taskId: `${parentTask.taskId}-part-${i}`,
        workloadType: parentTask.workloadType,
        inputs: {
          ...parentTask.inputs,
          partitionIndex: i,
          totalPartitions: numPartitions,
          partitionBoundaries: { start: (i * 100) / numPartitions, end: ((i + 1) * 100) / numPartitions }
        },
        dependencies: parentTask.dependencies,
        resourceRequirements: parentTask.resourceRequirements,
        determinismClass: parentTask.determinismClass,
        priority: parentTask.priority,
        state: 'QUEUED',
        partitionType
      });
    }

    return partitions;
  }
}
