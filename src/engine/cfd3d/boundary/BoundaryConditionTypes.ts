export enum BoundaryType {
  VELOCITY_INLET = 'VELOCITY_INLET',
  PRESSURE_OUTLET = 'PRESSURE_OUTLET',
  NO_SLIP_WALL = 'NO_SLIP_WALL',
  SLIP_WALL = 'SLIP_WALL',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC',
  FARFIELD = 'FARFIELD'
}

export interface BoundaryCondition {
  id: string;
  name: string;
  type: BoundaryType;
  values: Record<string, number>;
  patchIds: string[];
}

export type BoundaryConditionTypes = BoundaryCondition;
