import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DecimalInterceptor } from './common/interceptors/decimal.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Habilitar CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 2. Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 3. Interceptor y filtro global
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Interceptor para convertir Decimal de Prisma a número
  app.useGlobalInterceptors(new DecimalInterceptor());
  // 4. Configuración de Swagger (OpenAPI)
  const config = new DocumentBuilder()
    .setTitle('Agroriego API')
    .setDescription('Gestión de parcelas, cultivos, sensores y riego inteligente')
    .setVersion('1.0')
    .addBearerAuth() // si usas autenticación JWT
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // ✅ Forzar carga de recursos desde CDN (evita errores 404 en Vercel)
  SwaggerModule.setup('api/docs', app, document, {
    customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css',
    customJs: [
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js',
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js',
    ],
  });


  // 5. Iniciar servidor
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();