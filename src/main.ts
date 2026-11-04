import { app } from './app';
import { checkDatabaseConnection, closeDatabase } from './config/database';
import { env } from './config/env';

async function bootstrap() {
  try {
    await checkDatabaseConnection();
    console.log('Database connection established');
  } catch (err) {
    console.error('Could not connect to PostgreSQL. Check DATABASE_URL in .env');
    console.error((err as Error).message);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
