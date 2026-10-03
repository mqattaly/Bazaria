import type { HealthData } from '@bazariya/shared';
import { z } from 'zod';

const healthResponseSchema = z.object({
  data: z.object({
    status: z.literal('ok'),
    service: z.literal('bazariya-api'),
    database: z.literal('connected'),
  }),
});

export async function fetchHealth(): Promise<HealthData> {
  const response = await fetch('/api/v1/health', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('API health check failed');
  }

  const result: unknown = await response.json();
  return healthResponseSchema.parse(result).data;
}
