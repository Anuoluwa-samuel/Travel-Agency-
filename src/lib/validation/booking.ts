import { z } from "zod";
import { emailSchema } from "./auth";

/** Shared by the booking form (instant feedback) and the server (the authority). */

const uuid = z.uuid();

export const selectionSchema = z.object({
  departureId: uuid,
  rooms: z
    .array(
      z.object({
        optionId: uuid,
        adults: z.coerce.number().int().min(1).max(6),
        children: z.coerce.number().int().min(0).max(2),
      }),
    )
    .min(1, "Choose at least one room")
    .max(10),
  addons: z.array(z.object({ optionId: uuid, travellers: z.coerce.number().int().min(0).max(60) })).max(20),
});
export type Selection = z.infer<typeof selectionSchema>;

const name = (label: string) => z.string().trim().min(1, `Enter ${label}`).max(80);

export const travellerSchema = z.object({
  type: z.enum(["adult", "child"]),
  title: z
    .string()
    .trim()
    .max(10)
    .transform((v) => v || undefined)
    .optional(),
  firstName: name("a first name"),
  lastName: name("a last name"),
  dateOfBirth: z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .pipe(z.iso.date("Use a valid date").optional())
    .optional(),
  nationality: z
    .string()
    .trim()
    .max(56)
    .transform((v) => v || undefined)
    .optional(),
  /** Optional at booking; collected securely before travel if not given now. */
  passportNumber: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || undefined)
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9]{5,20}$/, "Passport numbers are 5–20 letters or digits")
        .optional(),
    )
    .optional(),
  passportExpiry: z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .pipe(z.iso.date("Use a valid date").optional())
    .optional(),
});
export type TravellerInput = z.infer<typeof travellerSchema>;

export const bookingRequestSchema = z.object({
  quoteReference: z.string().regex(/^QT-[0-9A-Z]{4}-[0-9A-Z]{4}$/),
  contact: z.object({
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .regex(/^[+\d][\d\s()-]{6,30}$/, "Enter a valid phone number"),
  }),
  travellers: z.array(travellerSchema).min(1).max(60),
  notes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || undefined)
    .optional(),
  acceptTerms: z.literal(true, { error: "Please accept the booking terms to continue" }),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const guestLookupSchema = z.object({
  reference: z.string().trim().min(8).max(20),
  email: emailSchema,
});

export const guestCodeSchema = z.object({
  reference: z.string().trim().min(8).max(20),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const cancellationRequestSchema = z.object({
  reason: z.string().trim().min(5, "Tell us briefly why you're cancelling").max(1000),
  confirm: z.literal(true, { error: "Please confirm you understand the cancellation charges" }),
});
