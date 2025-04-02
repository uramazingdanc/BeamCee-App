
export interface Load {
  id: string;
  type: string;
  magnitude: number;
  position?: number;
  startPosition?: number;
  endPosition?: number;
}

export interface BeamParameters {
  length: number;
  elasticModulus: number;
  momentOfInertia: number;
  beamType: string;
  loads: Load[];
  leftSupportPosition?: number;
  rightSupportPosition?: number;
}

export interface SlopeValues {
  leftEnd: number;
  rightEnd: number;
  midspan: number;
  maxValue: number;
  maxPosition: number;
}

export interface DeflectionValues {
  leftEnd: number;
  rightEnd: number;
  midspan: number;
  maxValue: number;
  maxPosition: number;
}

export interface CalculationResults {
  deflection: DeflectionValues;
  slope: SlopeValues;
  steps: Array<{title: string, description: string, formula?: string, result?: string}>;
  deflectionPoints: Array<{x: number, y: number}>;
  slopePoints: Array<{x: number, y: number}>;
}
