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

  // Redis key prefixes for tracking
  REDIS_PREFIX_GLOBAL_CONCURRENT: 'schedule:concurrent:global',
  REDIS_PREFIX_USER_CONCURRENT: 'schedule:concurrent:user:',
} as const;
