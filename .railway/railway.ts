import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from 'railway/iac';

const REPO = 'ranjancomputer1234/coaching-institute';

const SHARED_WATCH = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];

export default defineRailway(() => {
  const db = postgres('postgres');

  // checkSuites: Railway waits for the GitHub Actions CI run on the commit to
  // pass before it deploys. A red CI run never reaches Railway.
  const api = service('api', {
    source: github(REPO, { branch: 'main', checkSuites: true }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'apps/api/Dockerfile',
      watchPatterns: ['apps/api/**', ...SHARED_WATCH],
    },
    deploy: {
      preDeployCommand: ['npx prisma migrate deploy'],
      healthcheckPath: '/api/health',
      healthcheckTimeout: 120,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
    },
    env: {
      APP_ENV: 'production',
      // The API refuses to boot in production without sslmode=require.
      DATABASE_URL: '${{postgres.DATABASE_URL}}?sslmode=require',
      JWT_SECRET: preserve(),
      LEARNER_JWT_SECRET: preserve(),
      OFFLINE_GRANT_SECRET: preserve(),
      JWT_EXPIRES_IN: '1d',
      LEARNER_JWT_EXPIRES_IN: '30d',
      OFFLINE_GRANT_KID: 'redi-offline-v1',
      CORS_ORIGIN: 'https://${{admin.RAILWAY_PUBLIC_DOMAIN}}',
      PROTECTED_CONTENT_BASE_URL:
        'https://${{RAILWAY_PUBLIC_DOMAIN}}/api/protected/delivery',
      DOWNLOAD_SESSION_TTL_SECONDS: '900',
      OFFLINE_DOCUMENT_TTL_SECONDS: '604800',
      OFFLINE_VIDEO_TTL_SECONDS: '259200',
    },
  });

  const admin = service('admin', {
    source: github(REPO, { branch: 'main', checkSuites: true }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'apps/admin/Dockerfile',
      watchPatterns: ['apps/admin/**', ...SHARED_WATCH],
    },
    deploy: {
      healthcheckPath: '/healthz',
      healthcheckTimeout: 60,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
    },
    env: {
      // Passed to the Dockerfile as a build arg and baked into the bundle.
      VITE_API_BASE_URL: 'https://${{api.RAILWAY_PUBLIC_DOMAIN}}',
      VITE_APP_ENV: 'production',
    },
  });

  return project('coaching-institute', {
    resources: [db, api, admin],
  });
});
