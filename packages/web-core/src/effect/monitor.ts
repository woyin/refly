import { getEnv } from '@refly/utils/env';
import React from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';

export const setupSentry = async () => {
  if (process.env.NODE_ENV !== 'development') {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: 'https://a687291d5ba3a77b0fa559e6d197eac8@o4507205453414400.ingest.us.sentry.io/4507208398602240',
      environment: getEnv(),
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ['localhost', 'https://refly.ai'],
      // Session Replay
      replaysSessionSampleRate: 0, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      beforeSend(event) {
        // Filter out script loading errors that we've already handled
        if (
          event.exception?.values?.some(
            (exception) =>
              exception.value &&
              (exception.value.includes('script') || exception.value.includes('font-inter')),
          )
        ) {
          return null;
        }
        return event;
      },
    });
  }
};
