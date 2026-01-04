import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.useGlobalFilters(new HttpExceptionFilter());
  console.log(process.env.FRONTEND_URL);
  // Enable CORS for Angular frontend
const allowedOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);


  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server is running on port ${port}`);
}
bootstrap();




