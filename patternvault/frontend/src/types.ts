export type ProblemSource = "CODEFORCES" | "CODECHEF" | "LEETCODE" | "OA" | "OTHER";
export type ProblemStatus = "SOLVED" | "PARTIAL" | "FAILED" | "UNTRIED";
export type Language = "cpp" | "python" | "java" | "javascript" | "go" | "other";

export interface Topic {
  id: number;
  name: string;
  parent_category: "DP" | "GRAPH" | "LINEAR_DS" | "OTHER";
}

export interface PatternCard {
  id: number;
  problem: number;
  problem_title?: string;
  pattern_name: string;
  recognition_trigger: string;
  core_insight: string;
  common_edge_cases: string;
  llm_generated: boolean;
  created_at: string;
  next_review_date: string;
  overdue_days?: number;
}

export interface Problem {
  id: number;
  title: string;
  source: ProblemSource;
  url: string;
  statement: string;
  difficulty_rating: number | null;
  status: ProblemStatus;
  topics: Topic[];
  language: Language;
  code_submitted: string;
  time_taken_minutes: number | null;
  is_core_algorithm: boolean;
  created_at: string;
  pattern_cards?: PatternCard[];
  test_run_count?: number;
}

export interface TestRun {
  id: number;
  problem: number;
  code_snapshot: string;
  language: string;
  stdin: string;
  expected_output: string;
  actual_output: string;
  status: "Accepted" | "WrongAnswer" | "RuntimeError" | "TLE" | "CompileError";
  execution_time_ms: number | null;
  timer_duration_seconds: number | null;
  created_at: string;
}

export interface PostMortem {
  id: number;
  problem: number;
  bug_found: string;
  root_cause: string;
  lesson_learned: string;
  created_at: string;
}

export interface ReviewLog {
  id: number;
  pattern_card: number;
  review_date: string;
  self_rating: number;
  next_review_date: string;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  status: string;
  raw_status: string;
  execution_time_ms: number | null;
  memory_used: number | null;
  test_run_id?: number;
}
