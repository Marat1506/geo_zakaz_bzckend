import { registerAs } from '@nestjs/config';

const requireInProduction = (value: string | undefined, key: string, fallback: string): string => {
  if (value && value.trim().length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return fallback;
};

export default registerAs('jwt', () => ({
  secret: requireInProduction(
    process.env.JWT_SECRET,
    'JWT_SECRET',
    'your-secret-key-change-in-production',
  ),
  expiresIn: process.env.JWT_EXPIRATION || '1h',
  refreshSecret: requireInProduction(
    process.env.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
    'your-refresh-secret-change-in-production',
  ),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
