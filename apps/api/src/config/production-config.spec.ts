import type { ConfigService } from '@nestjs/config';
import { assertProductionConfig, corsOrigins } from './production-config';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get(key: string, fallback?: string) {
      const value = values[key];
      return value === undefined ? fallback : value;
    },
  } as ConfigService;
}

const production = {
  APP_ENV: 'production',
  DATABASE_URL:
    'postgresql://redi:secret@db.example.com:5432/redi?sslmode=require',
  JWT_SECRET: 'a'.repeat(32),
  LEARNER_JWT_SECRET: 'b'.repeat(32),
  OFFLINE_GRANT_SECRET: 'c'.repeat(32),
  CORS_ORIGIN: 'https://admin.example.com',
  PROTECTED_CONTENT_BASE_URL: 'https://api.example.com/api/protected/delivery',
};

describe('production config', () => {
  it('ignores local environments', () => {
    expect(() =>
      assertProductionConfig(config({ APP_ENV: 'local' })),
    ).not.toThrow();
  });

  it('accepts a complete production config', () => {
    expect(() => assertProductionConfig(config(production))).not.toThrow();
  });

  it('rejects a database without sslmode=require', () => {
    expect(() =>
      assertProductionConfig(
        config({
          ...production,
          DATABASE_URL: 'postgresql://redi:secret@db.example.com:5432/redi',
        }),
      ),
    ).toThrow('sslmode=require');
  });

  it('rejects placeholder and duplicate signing secrets', () => {
    expect(() =>
      assertProductionConfig(
        config({ ...production, JWT_SECRET: 'dev-change-me-but-long-enough' }),
      ),
    ).toThrow('JWT_SECRET');

    expect(() =>
      assertProductionConfig(
        config({
          ...production,
          LEARNER_JWT_SECRET: production.JWT_SECRET,
        }),
      ),
    ).toThrow('must all be different');
  });

  it('rejects non-https origins and delivery URLs', () => {
    expect(() =>
      assertProductionConfig(
        config({ ...production, CORS_ORIGIN: 'http://localhost:5173' }),
      ),
    ).toThrow('https origins');

    expect(() =>
      assertProductionConfig(
        config({
          ...production,
          PROTECTED_CONTENT_BASE_URL: 'http://localhost:3333/api/protected',
        }),
      ),
    ).toThrow('must use https');
  });

  it('splits multiple CORS origins', () => {
    expect(
      corsOrigins(
        config({
          CORS_ORIGIN: 'http://localhost:5173, http://127.0.0.1:5173',
        }),
      ),
    ).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });
});
