import { z } from 'zod'

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
})

export const tripSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  coverPhoto: z.string().url().optional(),
}).refine((d) => d.endDate >= d.startDate, {
  message: 'End date must be on/after the start date',
  path: ['endDate'],
})

export const stopSchema = z.object({
  cityId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine((d) => d.endDate >= d.startDate, { message: 'Stop end date before start date', path: ['endDate'] })

export const tripActivitySchema = z.object({
  activityId: z.string().uuid(),
  date: z.coerce.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM 24h format'),
  cost: z.coerce.number().nonnegative().max(1_000_000),
  notes: z.string().max(500).optional(),
})
