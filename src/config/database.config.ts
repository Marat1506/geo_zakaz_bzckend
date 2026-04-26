import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const requireDbEnv = (
  value: string | undefined,
  key: string,
  fallback: string,
): string => {
  if (value && value.trim().length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return fallback;
};

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: requireDbEnv(process.env.DB_HOST, 'DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: requireDbEnv(process.env.DB_USERNAME, 'DB_USERNAME', 'postgres'),
    password: requireDbEnv(process.env.DB_PASSWORD, 'DB_PASSWORD', 'postgres'),
    database: requireDbEnv(process.env.DB_NAME, 'DB_NAME', 'food_ordering'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    extra: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  }),
);
