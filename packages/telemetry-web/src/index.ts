import { StatsigClient } from '@statsig/js-client';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import Cookie from 'js-cookie';
import { UID_COOKIE } from '@refly/utils';

let statsigClient: StatsigClient | null = null;

export const setupStatsig = async () => {
  if (!process.env.STATSIG_CLIENT_KEY) {
    console.warn('STATSIG_CLIENT_KEY is not set, skipping statsig setup');
    return;
  }

  statsigClient = new StatsigClient(
    process.env.STATSIG_CLIENT_KEY,
    { userID: Cookie.get(UID_COOKIE) },
    {
      plugins: [new StatsigSessionReplayPlugin(), new StatsigAutoCapturePlugin()],
    },
  );

  await statsigClient.initializeAsync();
};

export const logEvent = (
  eventName: string,
  value?: string | number,
  metadata?: Record<string, any>,
) => {
  if (!statsigClient) {
    return;
  }

  statsigClient.logEvent(eventName, value, metadata);
};
