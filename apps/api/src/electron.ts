import path from 'node:path';
import getPort from 'get-port';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './modules/app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@/utils/filters/global-exception.filter';
import { setTraceID } from '@/utils/middleware/set-trace-id';
import { CustomWsAdapter } from '@/utils/adapters/ws-adapter';
import { execSync } from 'node:child_process';
import { findNodeModules } from '@/utils/runtime';

let nestApp: NestExpressApplication | null = null;

export const startApiServerForElectron = async (userDataPath: string, logger: any) => {
  process.env.MODE = 'desktop';
  process.env.DATABASE_URL = `file:${userDataPath}/refly.db`;
  process.env.VECTOR_STORE_BACKEND = 'lancedb';
  process.env.LANCEDB_URI = path.join(userDataPath, 'lancedb');

  const nodeModulesPath = findNodeModules(__dirname);

  if (!nodeModulesPath) {
    throw new Error('Could not find node_modules directory');
  }

  const prismaPath = path.join(nodeModulesPath, '.bin', 'prisma');
  const prismaSchemaPath = path.join(__dirname, 'prisma', 'sqlite-schema.prisma');
  logger.debug('Prisma configuration', {
    prismaPath,
    prismaSchemaPath,
    databaseUrl: process.env.DATABASE_URL,
  });

  // TODO: Cache the migration result to optimize launch time
  try {
    logger.info('Running Prisma database migration');
    execSync(`${prismaPath} db push --schema=${prismaSchemaPath}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });
    logger.info('Prisma database migration completed successfully');
  } catch (error) {
    logger.error('Failed to run Prisma database migration:', error);
    throw error;
  }

  process.env.FULLTEXT_SEARCH_BACKEND = 'prisma';
  process.env.OBJECT_STORAGE_BACKEND = 'fs';
  process.env.OBJECT_STORAGE_FS_ROOT = path.join(userDataPath, 'objectStorage');

  logger.info('Creating NestJS application');
  nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  nestApp.useLogger(nestApp.get(Logger));
  const configService = nestApp.get(ConfigService);
  configService.set('mode', 'desktop');

  nestApp.useBodyParser('json', { limit: '10mb' });
  nestApp.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  nestApp.useStaticAssets(path.join(__dirname, '..', 'public'));
  nestApp.setBaseViewsDir(path.join(__dirname, '..', 'views'));
  nestApp.setViewEngine('hbs');
  nestApp.set('trust proxy', true);

  nestApp.use(setTraceID);
  nestApp.use(helmet());
  nestApp.enableCors();
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new GlobalExceptionFilter(configService));

  const wsPort = await getPort();
  nestApp.useWebSocketAdapter(new CustomWsAdapter(nestApp, wsPort));
  process.env.RF_COLLAB_URL = `ws://localhost:${wsPort}`;
  logger.info(`Collab server running at ${process.env.RF_COLLAB_URL}`);

  // Use a free port for internal API server
  const port = await getPort();
  nestApp.listen(port);
  process.env.RF_API_BASE_URL = `http://localhost:${port}`;

  logger.info(`API server running at ${process.env.RF_API_BASE_URL}`);

  // Set the static endpoints for the desktop app
  const publicStaticEndpoint = `http://localhost:${port}/v1/misc/public`;
  const privateStaticEndpoint = `http://localhost:${port}/v1/misc`;
  process.env.RF_PUBLIC_STATIC_ENDPOINT = publicStaticEndpoint;
  process.env.RF_PRIVATE_STATIC_ENDPOINT = privateStaticEndpoint;

  configService.set('static.public.endpoint', publicStaticEndpoint);
  configService.set('static.private.endpoint', privateStaticEndpoint);

  logger.info('API server configuration completed', {
    publicStaticEndpoint,
    privateStaticEndpoint,
    collabUrl: process.env.RF_COLLAB_URL,
    apiBaseUrl: process.env.RF_API_BASE_URL,
  });

  return nestApp;
};

export const shutdownApiServer = async (logger: any) => {
  if (nestApp) {
    logger.info('Shutting down API server');
    await nestApp.close();
    logger.info('API server shut down successfully');
  }
};
