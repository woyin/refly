import plugin from 'tailwindcss/plugin';
import { reflyColors } from './tailwind-colors';

import type { Config } from 'tailwindcss';

const content = [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}',
  '../../packages/ai-workspace-common/src/**/*.{js,jsx,ts,tsx}',
  '../../packages/web-core/src/**/*.{js,jsx,ts,tsx}',
  '../../packages/ui-kit/src/**/*.{js,jsx,ts,tsx}',
];

const AntdOverwritePlugin = plugin(({ matchVariant }) => {
  const processSpaces = (value: string) =>
    value.replace(/([^\\_])_([^_])/g, '$1 $2').replace(/\\_/g, '_');
  matchVariant('ant', (value) => {
    if (value.startsWith('&')) {
      return processSpaces(value);
    }
    return `& ${processSpaces(value)}`;
  });
});

export function defineConfig(): Config {
  return {
    darkMode: 'class',
    plugins: [AntdOverwritePlugin],
    corePlugins: {
      preflight: false,
    },
    content,
    theme: {
      extend: {
        fontFamily: {
          inter: ['Inter', 'sans-serif'],
          'architects-daughter': ['"Architects Daughter"', 'sans-serif'],
          alibaba: ['Alibaba PuHuiTi', 'sans-serif'],
        },
        fontSize: {
          xs: ['12px', '20px'],
          sm: ['14px', '22px'],
          base: ['16px', '24px'],
          lg: ['18px', '28px'],
          xl: ['20px', '30px'],
          '2xl': ['24px', '36px'],
        },
        colors: reflyColors,
      },
    },
  };
}

export default defineConfig();
