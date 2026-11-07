import { z } from 'zod';

/** Endpoint the client hits on landing to wake the server (SPEC §0.4). */
export const HEALTH_PATH = '/health';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  uptimeSec: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
