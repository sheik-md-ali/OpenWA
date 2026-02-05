import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Docker from 'dockerode';

// Configuration loading:
// 1. If data/.env.generated exists, load it (persisted config from dashboard)
// 2. If not, create it with minimal defaults (first run)
// 3. .env.generated is the single source of truth
const generatedEnvPath = path.resolve(process.cwd(), 'data', '.env.generated');

// Ensure data directory exists
const dataDir = path.dirname(generatedEnvPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (fs.existsSync(generatedEnvPath)) {
  console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
  dotenv.config({ path: generatedEnvPath, override: true });
} else {
  console.log('[Bootstrap] First run detected, creating default configuration...');
  // Create minimal .env.generated with sensible defaults
  const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
  fs.writeFileSync(generatedEnvPath, minimalConfig);
  console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
  dotenv.config({ path: generatedEnvPath, override: true });
}

// Pre-bootstrap PostgreSQL container if built-in is enabled
// This runs BEFORE NestJS starts so TypeORM can connect
async function preBootstrapPostgres(): Promise<void> {
  if (process.env.POSTGRES_BUILTIN !== 'true') {
    return; // Not using built-in PostgreSQL
  }

  console.log('[Pre-Bootstrap] PostgreSQL built-in enabled, ensuring container is ready...');

  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  const containerName = 'openwa-postgres';
  const networkName = 'openwa-network';

  try {
    // Check if container exists
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find(c => c.Names.includes(`/${containerName}`));

    if (existing) {
      if (existing.State === 'running') {
        console.log('[Pre-Bootstrap] PostgreSQL container already running');
      } else {
        // Start existing container
        const container = docker.getContainer(existing.Id);
        await container.start();
        console.log('[Pre-Bootstrap] Started existing PostgreSQL container');
      }
    } else {
      // Create and start new container
      console.log('[Pre-Bootstrap] Creating PostgreSQL container...');

      // Ensure network exists
      const networks = await docker.listNetworks();
      if (!networks.find(n => n.Name === networkName)) {
        await docker.createNetwork({ Name: networkName });
      }

      // Ensure volume exists
      const volumes = await docker.listVolumes();
      if (!volumes.Volumes?.find(v => v.Name === 'openwa_postgres-data')) {
        await docker.createVolume({ Name: 'openwa_postgres-data' });
      }

      // Create container
      const container = await docker.createContainer({
        name: containerName,
        Image: 'postgres:16-alpine',
        Env: ['POSTGRES_USER=openwa', 'POSTGRES_PASSWORD=openwa', 'POSTGRES_DB=openwa'],
        Labels: {
          'com.openwa.service': 'database',
          'com.openwa.builtin': 'true',
        },
        HostConfig: {
          NetworkMode: networkName,
          RestartPolicy: { Name: 'unless-stopped' },
          Binds: ['openwa_postgres-data:/var/lib/postgresql/data'],
        },
        Healthcheck: {
          Test: ['CMD-SHELL', 'pg_isready -U openwa'],
          Interval: 5000000000, // 5s
          Timeout: 3000000000, // 3s
          Retries: 5,
        },
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: {
              Aliases: ['postgres', 'openwa-postgres'],
            },
          },
        },
      });

      await container.start();
      console.log('[Pre-Bootstrap] PostgreSQL container created and started');
    }

    // Wait for PostgreSQL to be healthy (max 60 seconds)
    console.log('[Pre-Bootstrap] Waiting for PostgreSQL to be healthy...');
    const maxWaitMs = 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const containerInfo = await docker.getContainer(containerName).inspect();
      const health = containerInfo.State?.Health?.Status;

      if (health === 'healthy') {
        console.log('[Pre-Bootstrap] PostgreSQL is healthy and ready!');
        return;
      }

      if (health === 'unhealthy') {
        throw new Error('PostgreSQL container became unhealthy');
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('PostgreSQL health check timeout after 60s');
  } catch (error) {
    console.error('[Pre-Bootstrap] PostgreSQL orchestration failed:', error);
    throw error;
  }
}

async function bootstrap() {
  // Pre-bootstrap: ensure PostgreSQL is ready before NestJS starts
  await preBootstrapPostgres();

  const app = await NestFactory.create(AppModule);

  // Enhanced Security Headers (Phase 3 Security Audit)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Disable for API usage
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS Configuration (Phase 3 Security Audit)
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Check if wildcard or origin matches
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Enhanced Validation pipe with security options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide details in prod
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('OpenWA API')
    .setDescription('Open Source WhatsApp API Gateway - Free, Self-Hosted HTTP API')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .addTag('sessions', 'WhatsApp session management')
    .addTag('messages', 'Send and manage messages')
    .addTag('webhooks', 'Webhook configuration')
    .addTag('contacts', 'Contact management')
    .addTag('groups', 'Group management')
    .addTag('labels', 'Label management (WhatsApp Business)')
    .addTag('channels', 'Channel/Newsletter management')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 2785;
  await app.listen(port);

  console.log(`🚀 OpenWA is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
