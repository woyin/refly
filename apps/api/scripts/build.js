#!/usr/bin/env node

const { spawn } = require('node:child_process');
const _path = require('node:path');

// Set memory limit for Node.js processes
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');
const isFast = args.includes('--fast');

console.log('Building API with increased memory limit...');

if (isFast) {
  // Use SWC for faster builds
  const swcProcess = spawn(
    'npx',
    ['swc', 'src', '-d', 'dist', '--config-file', '.swcrc', '--strip-leading-paths'],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  );

  swcProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Build completed successfully');
    } else {
      process.exit(code);
    }
  });
} else {
  // Use TypeScript compiler
  const tscArgs = ['tsc', '--build'];
  if (isVerbose) {
    tscArgs.push('--verbose');
  }

  const tscProcess = spawn('npx', tscArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  tscProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Build completed successfully');
    } else {
      process.exit(code);
    }
  });
}
