import { existsSync } from 'fs';
import { dirname, join } from 'path';

/** Directory that owns this API's .env and Prisma schema. Never the monorepo root. */
export function apiPackageRoot(start = __dirname): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'prisma', 'schema.prisma'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function apiEnvFilePath(start = __dirname): string {
  return join(apiPackageRoot(start), '.env');
}
