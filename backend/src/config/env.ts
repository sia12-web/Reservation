import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
      .string()
      .default('5000')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive()),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z.string().url('CORS_ORIGIN must be a valid URL').default('http://localhost:3000'),
    UNIVERSITY_DOMAINS: z
      .string()
      .min(1, 'UNIVERSITY_DOMAINS must be provided')
      .default(
        '.edu,.ualberta.ca,.ubc.ca,.utoronto.ca,.mcgill.ca,.uwaterloo.ca,.queensu.ca,.mc-master.ca'
      )
      .transform((val) => val.split(',').map((d) => d.trim())),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // Try to parse what we have
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const isTest = process.env.NODE_ENV === 'test';
    const isProduction = process.env.NODE_ENV === 'production';

    // In test mode, we provide fake defaults to keep the app from crashing on import
    if (isTest) {
      return {
        NODE_ENV: 'test',
        PORT: 5000,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
        JWT_SECRET: 'test_jwt_secret_abcdefghijklmnopqrstuvwxyz012345',
        JWT_EXPIRES_IN: '7d',
        CORS_ORIGIN: 'http://localhost:3000',
        UNIVERSITY_DOMAINS: ['.edu'],
      } as Env;
    }

    // In non-test mode, we log and exit if things are missing
    const missingVars = result.error.issues
      .map((err: any) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    console.error('❌ Invalid environment variables:\n' + missingVars);

    if (isProduction) {
      process.exit(1);
    }
  }

  return result.data as Env;
}

export const env = validateEnv();
