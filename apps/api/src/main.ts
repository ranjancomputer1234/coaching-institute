import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import {
  assertProductionConfig,
  corsOrigins,
} from './config/production-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  assertProductionConfig(config);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: corsOrigins(config),
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 3333);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
