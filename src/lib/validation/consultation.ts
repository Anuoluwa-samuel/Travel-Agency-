import { z } from "zod";
import { emailSchema } from "./auth";
import { isValidTimeZone } from "@/lib/zoned-time";

export const FORMAT_LABELS = { video: "Video call", phone: "Phone call", in_person: "In person" } as const;
export type ConsultationFormat = keyof typeof FORMAT_LABELS;

export const consultationBookingSchema = z
  .object({
    serviceSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    startsAt: z.iso.datetime({ offset: true, error: "Choose a time" }),
    format: z.enum(["video", "phone", "in_person"], { error: "Choose how you'd like to meet" }),
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .max(32)
      .transform((v) => (v === "" ? undefined : v))
      .optional()
      .refine((v) => !v || /^[+\d][\d\s()-]{6,30}$/.test(v), "Enter a valid phone number"),
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    timezone: z.string().max(64).refine(isValidTimeZone, "Unknown timezone").catch("Africa/Lagos"),
  })
  .refine((v) => v.format !== "phone" || Boolean(v.phone), {
    path: ["phone"],
    message: "Add a number for the phone call",
  });

export type ConsultationBookingInput = z.output<typeof consultationBookingSchema>;
