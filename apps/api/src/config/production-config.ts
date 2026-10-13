import type { ConfigService } from '@nestjs/config';

const PLACEHOLDER =
  /change-me|changeme|dev-change|dev-learner|dev-offline|replace-me|example/i;

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim() ?? '';
  if (!value) {
    throw new Error(`Production config missing ${key}`);
  }
  return value;
}

/** Refuse to boot a production process with local or placeholder credentials. */
export function assertProductionConfig(config: ConfigService): void {
  if (config.get<string>('APP_ENV') !== 'production') return;

  const databaseUrl = required(config, 'DATABASE_URL');
  if (
    !databaseUrl.startsWith('postgresql://') &&
    !databaseUrl.startsWith('postgres://')
  ) {
    throw new Error(
      'Production DATABASE_URL must be a PostgreSQL connection string',
    );
  }
  if (!/[?&]sslmode=require(?:&|$)/.test(databaseUrl)) {
    throw new Error('Production DATABASE_URL must include sslmode=require');
  }

  for (const key of [
    'JWT_SECRET',
    'LEARNER_JWT_SECRET',
    'OFFLINE_GRANT_SECRET',
  ]) {
    const value = required(config, key);
    if (value.length < 32 || PLACEHOLDER.test(value)) {
      throw new Error(
        `${key} must be a unique secret of at least 32 characters`,
      );
    }
  }

  const secrets = [
    required(config, 'JWT_SECRET'),
    required(config, 'LEARNER_JWT_SECRET'),
    required(config, 'OFFLINE_GRANT_SECRET'),
  ];
  if (new Set(secrets).size !== secrets.length) {
    throw new Error('Production signing secrets must all be different');
  }

  const cors = required(config, 'CORS_ORIGIN');
  for (const origin of cors.split(',')) {
    const trimmed = origin.trim();
    if (!trimmed.startsWith('https://')) {
      throw new Error('Production CORS_ORIGIN must list https origins only');
    }
  }

  const delivery = required(config, 'PROTECTED_CONTENT_BASE_URL');
  if (!delivery.startsWith('https://')) {
    throw new Error('Production PROTECTED_CONTENT_BASE_URL must use https');
  }
}

export function corsOrigins(config: ConfigService): string | string[] {
  const raw = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}
