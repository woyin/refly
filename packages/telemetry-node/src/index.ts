import { Statsig, StatsigUser } from '@statsig/statsig-node-core';

let statsig: Statsig | null = null;

export const setupStatsig = async () => {
  if (!process.env.STATSIG_SECRET_KEY) {
    console.warn('STATSIG_SECRET_KEY is not set, skipping statsig setup');
    return;
  }

  statsig = new Statsig(process.env.STATSIG_SECRET_KEY);
  await statsig.initialize();
};

export const logEvent = (
  user: { uid: string; email?: string },
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>,
) => {
  if (!statsig) {
    return;
  }

  statsig.logEvent(
    new StatsigUser({ userID: user.uid, email: user.email }),
    eventName,
    value,
    metadata,
  );
};
