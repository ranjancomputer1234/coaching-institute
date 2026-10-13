import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Public API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('GET /api/crypto/offline-verification', () => {
    return request(app.getHttpServer())
      .get('/api/crypto/offline-verification')
      .expect(200)
      .expect((res) => {
        const body = res.body as { kid?: string; algorithm?: string };
        if (!body.kid || !body.algorithm) {
          throw new Error('missing offline verification fields');
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
