export interface ThresholdDefinition {
  id: string;
  value: number;
  unit: string;
  rationale: string;
  source: string;
  category:
    | "MATHEMATICAL"
    | "PHYSICAL"
    | "NUMERICAL"
    | "ENGINEERING"
    | "CONTRACTUAL";
}
