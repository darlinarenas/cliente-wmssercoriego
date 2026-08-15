import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:8080',
  databaseUrl: process.env.DATABASE_URL || '',
};
