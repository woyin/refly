import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';
import { pluginSass } from '@rsbuild/plugin-sass';
import { sentryWebpackPlugin } from '@sentry/webpack-plugin';
import NodePolyfill from 'node-polyfill-webpack-plugin';

const { publicVars } = loadEnv({ prefixes: ['VITE_'] });

import path from 'node:path';

const GTAG_ID = 'G-ER782LXJ5F';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [pluginReact(), pluginSvgr(), pluginSass()],
  tools: {
    rspack: (config, { prependPlugins, appendPlugins }) => {
      process.env.SENTRY_AUTH_TOKEN &&
        appendPlugins(
          sentryWebpackPlugin({
            debug: true,
            org: 'refly-ai',
            project: 'web',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            errorHandler: (err) => console.warn(err),
            sourcemaps: {
              filesToDeleteAfterUpload: ['**/*.js.map'],
            },
          }),
        );
      prependPlugins(new NodePolyfill({ additionalAliases: ['process'] }));
      return config;
    },
  },
  server: {
    port: 5173,
    base: process.env.MODE === 'desktop' ? './' : '/',
    proxy: {
      '/v1': {
        target: 'https://refly.ai/',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  source: {
    define: publicVars,
  },
  performance: {
    removeConsole: isProduction,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@refly-packages/ai-workspace-common': path.resolve(
        __dirname,
        '../../packages/ai-workspace-common/src',
      ),
      '@refly/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
  },
  html: {
    template: './public/index.html',
    tags: isProduction
      ? [
          {
            tag: 'script',
            attrs: {
              async: true,
              src: `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`,
            },
          },
          {
            tag: 'script',
            children: `
          window.dataLayer = window.dataLayer || [];
          function gtag() {
            dataLayer.push(arguments);
          }
          gtag('js', new Date());
          gtag('config', '${GTAG_ID}');
      `,
          },
        ]
      : [],
  },
});
