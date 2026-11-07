import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const deadlineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.enum(['1d', '3d', '7d']) }),
  z.object({ kind: z.literal('date'), date }),
]);

export const createEventSchema = z.object({
  token: z.string().min(8),
  name: z.string().trim().min(1).max(40),
  startDate: date,
  endDate: date,
  deadline: deadlineSchema,
});

export const answerSchema = z.object({
  weekdayNg: z.array(z.number().int().min(0).max(6)).max(7),
  marks: z.record(date, z.enum(['ng', 'ok', 'unknown'])),
  wish: z.string().max(200).nullable().optional(),
});

export const periodSchema = z.object({
  startDate: date.optional(),
  endDate: date.optional(),
  deadline: deadlineSchema.optional(),
});
