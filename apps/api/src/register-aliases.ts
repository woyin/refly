import path from 'node:path';
import moduleAlias from 'module-alias';

function getPreloadModules(): string[] {
  const preloadModules: string[] = [];
  for (let i = 0; i < process.execArgv.length; i++) {
    if (process.execArgv[i] === '-r' || process.execArgv[i] === '--require') {
      if (i + 1 < process.execArgv.length) {
        preloadModules.push(process.execArgv[i + 1]);
      }
    } else if (process.execArgv[i].startsWith('--require=')) {
      preloadModules.push(process.execArgv[i].split('=')[1]);
    }
  }
  return preloadModules;
}

if (!getPreloadModules().includes('tsconfig-paths/register')) {
  const packagesRoot = path.resolve(__dirname, 'packages');
  // if (process.env.MODE === 'desktop') {
  //   packagesRoot = path.resolve(__dirname, 'packages');
  // }

  moduleAlias.addAliases({
    '@refly/openapi-schema': path.resolve(packagesRoot, 'openapi-schema/dist'),
    '@refly/errors': path.resolve(packagesRoot, 'errors/dist'),
    '@refly/common-types': path.resolve(packagesRoot, 'common-types/dist'),
    '@refly/utils': path.resolve(packagesRoot, 'utils/dist'),
    '@refly/providers': path.resolve(packagesRoot, 'providers/dist'),
    '@refly/skill-template': path.resolve(packagesRoot, 'skill-template/dist'),
    '@': __dirname,
  });
}
