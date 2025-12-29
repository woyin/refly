// Queue name for schedule execution
export const QUEUE_SCHEDULE_EXECUTION = 'scheduleExecution';

// Global concurrency limits for schedule execution
export const SCHEDULE_RATE_LIMITS = {
  // Maximum number of concurrent jobs processed globally across all workers
  GLOBAL_MAX_CONCURRENT: 10,

  // Rate limiter: max jobs per duration (e.g., 100 jobs per 60 seconds)
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_DURATION_MS: 60 * 1000, // 1 minute

  // Per-user max concurrent executions (to prevent one user from monopolizing)
  USER_MAX_CONCURRENT: 3,

  // Counter TTL in seconds (should be longer than max expected execution time)
  // 2 hours to handle long-running workflows
  COUNTER_TTL_SECONDS: 2 * 60 * 60,

  // Delay time in ms when user is rate limited
  USER_RATE_LIMIT_DELAY_MS: 10 * 1000, // 10 seconds

  // Redis key prefix for user concurrent tracking
  REDIS_PREFIX_USER_CONCURRENT: 'schedule:concurrent:user:',
} as const;

// Schedule quota per user based on subscription plan
export const SCHEDULE_QUOTA = {
  FREE_MAX_ACTIVE_SCHEDULES: 1, // Free tier: max 1 active schedule
  PAID_MAX_ACTIVE_SCHEDULES: 20, // Paid tiers: max 20 active schedules
} as const;

/**
 * Get maximum active schedules quota for a given plan
 * @param planType - The subscription plan lookup key (e.g., 'free', 'refly_plus_monthly_stable_v2')
 * @returns Maximum number of active schedules allowed
 */
export function getScheduleQuota(planType: string | null | undefined): number {
  // Free tier or no plan
  if (!planType || planType === 'free') {
    return SCHEDULE_QUOTA.FREE_MAX_ACTIVE_SCHEDULES;
  }
  // All paid plans get the same quota
  return SCHEDULE_QUOTA.PAID_MAX_ACTIVE_SCHEDULES;
}

// Default job options for BullMQ schedule execution queue
export const SCHEDULE_JOB_OPTIONS = {
  attempts: 1, // No automatic retry, user must manually retry
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
} as const;

/**
 * Priority range: 1-10 (lower number = higher priority, matching BullMQ convention)
 * Priority order: Max > Plus > Starter > Maker > Free
 */
export const PLAN_PRIORITY_MAP: Record<string, number> = {
  // Max tier - highest priority (1)
  refly_max_yearly_stable_v3: 1,
  refly_max_yearly_limited_offer: 1, // early bird max

  // Plus tier - high priority (3)
  refly_plus_yearly_stable_v2: 3,
  refly_plus_monthly_stable_v2: 3,
  refly_plus_monthly_stable: 3,
  refly_plus_yearly_limited_offer: 3, // early bird plus

  // Starter tier - medium priority (5)
  refly_starter_monthly: 5,

  // Maker tier - low-medium priority (7)
  refly_maker_monthly: 7,

  // Test/Trial plans - lower priority (8)
  refly_plus_yearly_test_v3: 8,
  refly_plus_monthly_test_v3: 8,
  refly_plus_yearly_test_v4: 8,

  // Free tier - lowest priority (10)
  free: 10,
} as const;

// Default priority for free tier users (lowest priority)
export const DEFAULT_PRIORITY = 10;

// Priority adjustment factors (penalties increase priority number = lower priority)
export const PRIORITY_ADJUSTMENTS = {
  FAILURE_PENALTY: 1, // Per consecutive failure (added to priority)
  HIGH_LOAD_PENALTY: 1, // When user has > 5 active schedules (added to priority)
  MAX_FAILURE_LEVELS: 3, // Max penalty levels for failures
  HIGH_LOAD_THRESHOLD: 5, // Threshold for high load penalty
  MAX_PRIORITY: 10, // Maximum priority value (lowest priority)
} as const;

/**
 * Schedule execution failure reasons
 * Used for frontend display and error tracking
 *
 * Frontend action buttons mapping:
 * - INSUFFICIENT_CREDITS -> "Upgrade" button
 * - SCHEDULE_LIMIT_EXCEEDED -> "View Schedule" button
 * - Others -> "Debug" button
 *
 * Note: User rate limiting (concurrent limit) causes job delays, not failures.
 * Delayed jobs are retried automatically by BullMQ, so no failure reason is needed.
 */
export enum ScheduleFailureReason {
  /** Insufficient credits - user needs to recharge */
  INSUFFICIENT_CREDITS = 'insufficient_credits',

  /** Exceeded subscription plan's schedule limit */
  SCHEDULE_LIMIT_EXCEEDED = 'schedule_limit_exceeded',

  /** Schedule was deleted */
  SCHEDULE_DELETED = 'schedule_deleted',

  /** Schedule was disabled */
  SCHEDULE_DISABLED = 'schedule_disabled',

  /** Invalid cron expression */
  INVALID_CRON_EXPRESSION = 'invalid_cron_expression',

  /** Canvas data error (missing nodes/edges) */
  CANVAS_DATA_ERROR = 'canvas_data_error',

  /** Snapshot creation or loading failed */
  SNAPSHOT_ERROR = 'snapshot_error',

  /** Workflow execution failed */
  WORKFLOW_EXECUTION_FAILED = 'workflow_execution_failed',

  /** Workflow execution timeout */
  WORKFLOW_EXECUTION_TIMEOUT = 'workflow_execution_timeout',

  /** Other unknown error */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Classify error into standardized failure reason
 * This helps frontend display appropriate error messages and action buttons
 *
 * @param error - Error object or error message string
 * @returns ScheduleFailureReason - Standardized failure reason
 */
export function classifyScheduleError(error: unknown): ScheduleFailureReason {
  if (!error) {
    return ScheduleFailureReason.UNKNOWN_ERROR;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : '';

  // Check for credit-related errors
  if (
    errorName === 'ModelUsageQuotaExceeded' ||
    /credit not available/i.test(errorMessage) ||
    /insufficient credits?/i.test(errorMessage) ||
    /ModelUsageQuotaExceeded/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.INSUFFICIENT_CREDITS;
  }

  // Check for quota/limit exceeded errors
  if (
    /quota.*exceeded/i.test(errorMessage) ||
    /schedule.*limit/i.test(errorMessage) ||
    errorMessage === ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED
  ) {
    return ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED;
  }

  // Check for timeout errors
  if (/timeout/i.test(errorMessage)) {
    return ScheduleFailureReason.WORKFLOW_EXECUTION_TIMEOUT;
  }

  // Check for cron expression errors
  if (/cron|schedule.*expression|invalid.*expression/i.test(errorMessage)) {
    return ScheduleFailureReason.INVALID_CRON_EXPRESSION;
  }

  // Check for canvas data errors
  if (
    /canvas.*not found/i.test(errorMessage) ||
    /invalid.*canvas/i.test(errorMessage) ||
    /nodes.*edges/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.CANVAS_DATA_ERROR;
  }

  // Check for snapshot errors
  if (
    /snapshot/i.test(errorMessage) ||
    /failed to parse/i.test(errorMessage) ||
    /storage.*key/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.SNAPSHOT_ERROR;
  }

  // Check for workflow execution errors
  if (
    /workflow.*execution/i.test(errorMessage) ||
    /execution.*failed/i.test(errorMessage) ||
    /agent.*error/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
  }

  // Default to unknown error
  return ScheduleFailureReason.UNKNOWN_ERROR;
}

/**
 * Workflow execution constants
 */
export const WORKFLOW_EXECUTION_CONSTANTS = {
  POLL_INTERVAL_MS: 1500,
  EXECUTION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  NODE_EXECUTION_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes
  POLL_LOCK_TTL_MS: 5000, // 5 seconds
} as const;
