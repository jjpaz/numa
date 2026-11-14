export interface User {
  id: string;
  name: string;
  email: string;
  role: "patient" | "psychologist";
  source: string;
  preferences?: string[];
}
export interface Voice {
  quality: string;
  source: string;
  model: string | null;
  model_revision?: string;
  probabilities: Record<string, number>;
  features: { energy?: number; pause_ratio?: number; duration_sec: number };
  observation: string;
  reason?: string;
  ml_status?: string;
}
export interface Context {
  source: string;
  sleep_hours: number;
  steps: number;
  outdoor_minutes: number;
  weather: string;
  temperature_c: number;
  music_minutes: number;
}
export interface Entry {
  id: string;
  patient_id: string;
  created_at: string;
  saved: boolean;
  source: string;
  status: string;
  title: string;
  transcript: string;
  summary: string;
  tags: string[];
  explicit: { feeling: string; evidence: string }[];
  semantic_source?: string;
  context: Context;
  voice: Voice | null;
  analysis?: { status: string; errors: string[] };
  action?: { kind: string; completed_at?: string; feedback?: string };
  follow_up?: { status: string; voice?: Voice; interpretation?: string };
}
export interface Trend {
  ready: boolean;
  days: number;
  required_days: number;
  persistent_change: boolean;
  centre?: Record<string, number>;
  spread?: Record<string, number>;
  points: {
    date: string;
    deviation: number;
    outside: boolean;
    baseline: boolean;
    energy: number;
    pause_ratio: number;
  }[];
}
export interface Pattern {
  kind: string;
  label: string;
  observations: number;
  helpful: number;
  text: string;
}
export interface Insights {
  trend: Trend;
  patterns: Pattern[];
  context: Context;
  preferences: string[];
}
export interface Recommendation {
  kind: string;
  title: string;
  description: string;
  label: string;
  minutes: number;
  reason: string;
  explanation?: string;
  evidence_count: number;
}
export interface Clinical {
  id: string;
  name: string;
  initials: string;
  source: string;
  entry_count: number;
  last_entry_at: string | null;
  trend: Trend;
  context: Context;
  contexts: ({ date: string } & Context)[];
  patterns: Pattern[];
  actions_completed: number;
  follow_up_count: number;
  notes: { text: string };
  status: string;
}
export interface Health {
  ok: boolean;
  mode: string;
  storage: string;
  gemini_configured: boolean;
  voice_model_enabled: boolean;
  demo_name_login: boolean;
}
export type GrowthModule =
  | "sleep"
  | "activity"
  | "music"
  | "habits"
  | "patterns"
  | "voice"
  | "experiments";
export interface Growth {
  modules: GrowthModule[];
  /** Still sent by the backend; the interface ignores it (no simple view). */
  simple_mode: boolean;
  dismissed_invitations: string[];
  remembered_pages: number;
  art_stage: "sprout" | "leaves" | "bloom";
  habit_label: string;
  habit_done_today: boolean;
  invitations: {
    id: string;
    module: GrowthModule;
    title: string;
    text: string;
    evidence_count: number;
  }[];
}
export interface Experiment {
  id: string;
  question: string;
  kind: string;
  status: "active" | "paused" | "completed";
  reflection: string;
  created_at: string;
  responses: number;
  helpful: number;
}
