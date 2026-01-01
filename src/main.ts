import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

// @Catch()
// export class HttpExceptionFilter implements ExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse();

//     if (exception instanceof HttpException) {
//       const status = exception.getStatus();
//       const res = exception.getResponse();

//       return response.status(status).json({
//         error: res,
//       });
//     }

//     return response.status(500).json({
//       error: exception instanceof Error ? exception.message : 'Unknown error',
//     });
//   }
// }

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.useGlobalFilters(new HttpExceptionFilter());

    // Enable CORS for Angular frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}
bootstrap();




