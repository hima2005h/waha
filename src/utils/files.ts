import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs-extra');

export async function fileExists(filepath: string) {
  try {
    await fs.access(filepath, fs.constants.F_OK);
  } catch (error) {
    return false;
  }
  return true;
}

export function safeJoin(base: string, input: string): string {
  base = path.resolve(base);

  if (!input || typeof input !== 'string') {
    throw new Error('Invalid path');
  }

  if (input.startsWith('~') || path.isAbsolute(input)) {
    throw new Error('Home or absolute paths not allowed');
  }

  // handles slashes safely
  const joined = path.join(base, input);
  // normalize to an absolute path
  const resolved = path.resolve(joined);

  // Prevent escape outside base dir
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error('Access outside base dir not allowed');
  }

  return resolved;
}
