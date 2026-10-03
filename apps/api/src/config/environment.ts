import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, unknown>): ApiEnvironment {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}

export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  return { ...input, ...parseEnvironment(input) };
}
