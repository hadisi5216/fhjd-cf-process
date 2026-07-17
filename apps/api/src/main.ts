import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { text } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.use(
    text({
      type: (request) => {
        const contentType = request.headers['content-type'];
        return (
          !contentType ||
          contentType.startsWith('text/plain') ||
          contentType.startsWith('application/octet-stream')
        );
      },
    }),
  );
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
