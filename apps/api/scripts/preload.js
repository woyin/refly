#!/usr/bin/env node

/**
 * Node.js preload script to resolve workspace dependencies to compiled distribution files
 * This script intercepts module resolution and redirects @refly/foo from
 * packages/foo/src/index.ts to packages/foo/dist/index.js
 */

const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

// Store the original require function
const originalRequire = Module.prototype.require;

// Get the workspace root directory (assuming this script is in apps/api/scripts/)
const workspaceRoot = path.resolve(__dirname, '../../..');

// Dynamically generate PACKAGE_MAPPING from package.json @refly/* workspace dependencies
const apiPackageJsonPath = path.resolve(__dirname, '../package.json');
const apiPackageJson = JSON.parse(fs.readFileSync(apiPackageJsonPath, 'utf-8'));

/**
 * Find all @refly/* workspace dependencies in package.json
 * @param {object} pkg - package.json object
 * @returns {object} mapping of package name to {source, target, resolvedPath}
 */
function getWorkspaceMappings(pkg) {
  const mapping = {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const dep of Object.keys(deps)) {
    if (dep.startsWith('@refly/')) {
      // e.g. @refly/utils -> utils
      const short = dep.replace('@refly/', '');
      const source = `packages/${short}/src/index.ts`;
      const target = `packages/${short}/dist/index.js`;

      const targetPath = path.resolve(workspaceRoot, target);
      const sourcePath = path.resolve(workspaceRoot, source);

      // Pre-validate file existence during mapping generation
      let resolvedPath = null;
      if (fileExists(targetPath)) {
        resolvedPath = targetPath;
      } else if (fileExists(sourcePath)) {
        console.warn(
          `[preload] Warning: Target file ${targetPath} not found, falling back to source ${sourcePath}`,
        );
        resolvedPath = sourcePath;
      }

      mapping[dep] = {
        source,
        target,
        resolvedPath,
      };
    }
  }
  return mapping;
}

const PACKAGE_MAPPING = getWorkspaceMappings(apiPackageJson);

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Resolve the actual file path for a module
 * @param {string} modulePath - Module path to resolve
 * @returns {string|null} - Resolved path or null if not found
 */
function resolveModulePath(modulePath) {
  // Check if this is a package we want to redirect
  const packageMapping = PACKAGE_MAPPING[modulePath];
  if (!packageMapping) {
    return null;
  }

  // Return pre-validated path (no file existence check needed)
  return packageMapping.resolvedPath;
}

/**
 * Override the require function to intercept module resolution
 */
Module.prototype.require = function (id) {
  // Try to resolve the module path
  const resolvedPath = resolveModulePath(id);

  if (resolvedPath) {
    return originalRequire.call(this, resolvedPath);
  }

  // For other modules, use the original require
  return originalRequire.call(this, id);
};

// Log that the preload script is active
console.log(
  `[preload] override module resolution path for packages: ${Object.keys(PACKAGE_MAPPING).join(', ')}`,
);
