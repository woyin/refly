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

// Default schedule quota per user
export const SCHEDULE_QUOTA = {
  MAX_ACTIVE_SCHEDULES: 10,
} as const;

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
