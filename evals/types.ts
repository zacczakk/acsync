export interface EvalQuery {
  query: string;
  should_trigger: boolean;
}

export interface EvalResult {
  query: string;
  should_trigger: boolean;
  triggered: boolean;
  pass: boolean;
}

export interface EvalSummary {
  skill: string;
  description: string;
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

export interface Adapter {
  name: string;
  runQuery(query: string, skillName: string): Promise<boolean>;
}
