/**
 * Shapes of the JSON returned by the FastAPI backend (backend/app/routers/*).
 *
 * Content and progress endpoints use camelCase keys; sandbox results (RunResult / StatementResult) are
 * serialized straight from Python dataclasses and therefore keep snake_case keys (row_count, elapsed_ms...).
 */

export type Level = "beginner" | "intermediate" | "advanced" | "professional";

/** The seven learning stages each lesson section maps to (backend/app/content/parser.py LESSON_SECTIONS). */
export type Stage = "concept" | "internals" | "implementation" | "execution" | "optimization" | "industry" | "assessment";

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------- course

export interface LessonSummary {
  id: string;
  title: string;
  level: Level;
  minutes: number;
  prerequisites: string[];
  topics: string[];
  moduleId: string;
  chapterId: string;
  order: number;
  /** "authored" lessons have content; "planned" ones exist only as an outline in the curriculum. */
  status: "authored" | "planned";
}

export interface Chapter {
  id: string;
  title: string;
  lessons: LessonSummary[];
}

export interface Module {
  id: string;
  number: number;
  title: string;
  level: Level;
  description: string;
  outcomes: string[];
  chapters: Chapter[];
  hasAssessment: boolean;
}

export interface ProjectSummary {
  id: string;
  title: string;
  level: Level;
  prerequisites: string[];
  practices: string[];
  authored: boolean;
}

export interface Exam {
  id: string;
  title: string;
  modules: string[];
  /** Number of questions drawn for each sitting. */
  questions: number;
}

export interface Course {
  course: { id: string; title: string; mysqlVersion: string; description: string };
  modules: Module[];
  projects: ProjectSummary[];
  exams: Exam[];
  sections: { title: string; stage: Stage }[];
}

export interface Dataset {
  title: string;
  description: string;
  /** Table name -> description of its contents. */
  tables?: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------- sandbox results

export type Cell = string | number | null;

export type StatementStatus = "ok" | "error" | "rejected" | "blocked";

/** Statement classes assigned by backend/app/sandbox/guard.py. */
export type StatementKind = "read" | "write" | "ddl" | "tcl" | "session" | "routine" | "admin" | "other";

export interface StatementError {
  code: number | null;
  message: string;
  /** Learner-oriented explanation of the MySQL error, when one is known. */
  hint?: string | null;
}

export interface SqlWarning {
  level: string;
  code: number;
  message: string;
}

/** Further result sets of one statement (e.g. CALL of a procedure that SELECTs several times). */
export interface ExtraResultSet {
  columns: string[];
  rows: Cell[][];
  row_count?: number;
  truncated?: boolean;
}

export interface StatementResult {
  index: number;
  sql: string;
  status: StatementStatus;
  columns: string[];
  rows: Cell[][];
  kind?: StatementKind;
  verb?: string;
  /** Rows returned (result sets). */
  row_count?: number | null;
  /** Rows changed (DML). */
  affected_rows?: number | null;
  truncated?: boolean;
  info?: string | null;
  warnings?: SqlWarning[];
  error?: StatementError | null;
  elapsed_ms?: number;
  more_results?: ExtraResultSet[];
}

export interface RunResult {
  lab: string;
  schema: string;
  dataset: string;
  statements: StatementResult[];
  elapsed_ms: number;
  server_version: string;
  notice?: string | null;
}

export interface LockTransaction {
  session: string;
  trxId: string;
  state: string;
  isolation: string;
  rowsLocked: number;
  rowsModified: number;
  lockStructs: number;
}

export interface LockRow {
  session: string;
  table: string;
  index: string | null;
  lockType: string;
  lockMode: string;
  status: string;
  lockData: string | null;
  /** Set when performance_schema attributes the lock structure to another session's thread. */
  reportedByThreadOf?: string;
}

/** InnoDB transactions and locks of one lab's sessions (GET /api/labs/locks). */
export interface LockSnapshot {
  transactions: LockTransaction[];
  locks: LockRow[];
}

// ---------------------------------------------------------------------------------------------- captured outputs

/** A statement as stored in content/generated/captures: a StatementResult without the bookkeeping fields. */
export type CapturedStatement = Partial<Omit<StatementResult, "sql" | "status">> & { sql: string; status: StatementStatus };

export interface ConcStepCapture {
  step: number;
  session?: string;
  observe?: string;
  status: string;
  statements?: CapturedStatement[];
  snapshot?: LockSnapshot;
  /** For a step that blocked: the step after which it completed. */
  completedAfterStep?: number;
  finalStatus?: string;
}

/** Real output captured by backend/scripts/capture_content.py for one runnable block. */
export interface Capture {
  statements?: CapturedStatement[];
  steps?: ConcStepCapture[];
  measured?: boolean | null;
}

export interface CaptureMeta {
  mysqlVersion: string;
  capturedAt: string;
}

// ---------------------------------------------------------------------------------------------- lesson content

export interface Question {
  id: string;
  type: "single" | "multi";
  question: string;
  options: string[];
  concepts?: string[];
  doc?: string;
}

export type ExerciseKind = "query" | "dml" | "open";

/** An exercise as sent to the client: solution, explanation and check query are never included. */
export interface ExerciseDef {
  id: string;
  title: string;
  prompt: string;
  kind: ExerciseKind;
  dataset?: string;
  difficulty?: string;
  hints?: string[];
  starter?: string;
  concepts?: string[];
  orderMatters?: boolean;
  setup?: string;
  doc?: string;
}

export interface ConcStep {
  session?: "A" | "B" | "C";
  sql?: string;
  note?: string;
  /** "locks": inspect InnoDB locks instead of running SQL. */
  observe?: string;
  expect?: "ok" | "blocks" | "error" | "any";
}

export interface WalkthroughStep {
  title?: string;
  explain?: string;
  sql?: string;
  capture?: Capture | null;
}

export interface HeadingSegment { type: "heading"; title: string; anchor: string; stage: Stage }
export interface MarkdownSegment { type: "markdown"; content: string }
export interface SqlSegment {
  type: "sql";
  id: string;
  sql: string;
  /** Executed at capture time (and runnable by the learner). */
  run: boolean;
  expect: "ok" | "error";
  /** Output differs between runs, so none is shown. */
  volatile: boolean;
  /** Output includes timings measured on the build machine. */
  measured: boolean;
  capture?: Capture | null;
}
export type ExerciseSegment = { type: "exercise" } & ExerciseDef;
export interface QuizSegment { type: "quiz"; id: string; title?: string; questions: Question[] }
export interface VizSegment { type: "viz"; id: string; viz: string; props: Record<string, unknown> }
export interface ConcurrencySegment {
  type: "concurrency";
  id: string;
  title?: string;
  description?: string;
  dataset?: string | null;
  setup?: string;
  steps: ConcStep[];
  capture?: Capture | null;
}
export interface WalkthroughSegment { type: "walkthrough"; id: string; title?: string; steps: WalkthroughStep[] }

/** One renderable piece of a lesson or project document (backend/app/content/parser.py). */
export type Segment =
  | HeadingSegment
  | MarkdownSegment
  | SqlSegment
  | ExerciseSegment
  | QuizSegment
  | VizSegment
  | ConcurrencySegment
  | WalkthroughSegment;

export interface Section {
  title: string;
  anchor: string;
  stage: Stage;
}

export interface LessonMeta {
  dataset?: string | null;
  concepts?: string[] | null;
  references?: { title: string; url: string }[] | null;
  summary?: string | null;
  mysqlVersion?: string | null;
}

export interface LessonDetail extends LessonSummary {
  module: { id: string; number: number; title: string };
  prev: LessonSummary | null;
  next: LessonSummary | null;
  prerequisiteLessons: LessonSummary[];
  meta: LessonMeta;
  sections: Section[];
  segments: Segment[];
  captureMeta?: CaptureMeta | null;
}

// ---------------------------------------------------------------------------------------------- progress

export type LessonStatus = "in_progress" | "completed";

export interface LessonProgress {
  status: LessonStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface Progress {
  lessons: Record<string, LessonProgress>;
  solvedExercises: string[];
  /** Question id -> whether the latest answer was correct. */
  answeredQuestions: Record<string, boolean>;
  /** Best result per assessment or exam id. */
  assessments: Record<string, { score: number; passed: boolean; at: string | null }>;
  stats: {
    authoredLessons: number;
    completedLessons: number;
    solvedExercises: number;
    questionsAnswered: number;
    questionsCorrect: number;
  };
}
