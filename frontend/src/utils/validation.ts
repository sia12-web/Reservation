import { z } from "zod";

export const reservationRequestSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  clientPhone: z
    .string()
    .trim()
    .min(1, "Please enter your phone number")
    .regex(/^\+[1-9]\d{7,14}$/, "Please enter a valid phone number (e.g. +1 234 567 8900)"),
  clientEmail: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
  partySize: z
    .number()
    .int()
    .min(1, "Party size must be at least 1")
    .max(50, "For parties over 50, please call us directly"),
  startTime: z.string().datetime(),
  source: z.enum(["KIOSK", "WEB", "PHONE"]).optional(),
  tableIds: z.array(z.string()).optional(),
  customerNotes: z.string().max(500, "Special requests are limited to 500 characters").optional(),
});

export type ReservationRequest = z.infer<typeof reservationRequestSchema>;

export type FieldErrors = Partial<Record<keyof ReservationRequest, string>>;

