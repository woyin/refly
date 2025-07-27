import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Whether the current process is running in desktop mode
 */
export const isDesktop = (): boolean => process.env.MODE === 'desktop';

/**
 * Finds the path to the target file by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param filename Name of the target file to find
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the target file or null if not found
 */
export const findTargetFile = (
  startDir: string,
  filename: string,
  maxDepth = 10,
): string | null => {
  let currentDir = startDir;
  let depth = 0;

  while (depth < maxDepth) {
    const targetFile = path.join(currentDir, filename);

    if (existsSync(targetFile)) {
      return targetFile;
    }

    const parentDir = path.dirname(currentDir);

    // If we've reached the root directory
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth += 1;
  }

  return null;
};
