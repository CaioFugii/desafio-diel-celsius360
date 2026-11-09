import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const openApi = new DocumentBuilder()
    .setTitle('Celsius 360 (desafio Diel)')
    .setDescription('API de lojas, ambientes e telemetria de temperatura')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, openApi),
  );

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on :${port} (docs at /api/docs)`, 'Bootstrap');
}

bootstrap();
