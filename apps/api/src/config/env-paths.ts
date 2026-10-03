import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentModuleDirectory = fileURLToPath(new URL('.', import.meta.url));

export function getEnvironmentFilePaths(
  currentDirectory = process.cwd(),
  moduleDirectory = currentModuleDirectory,
): string[] {
  return [
    resolve(currentDirectory, '.env'),
    resolve(currentDirectory, '../../.env'),
    resolve(moduleDirectory, '../../../.env'),
    resolve(moduleDirectory, '../../../../.env'),
  ];
}
