import { z } from "zod";

/** Shared by forms and server so both sides enforce the same rules (RULES.md §2). */

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase().max(254);

export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
  trustDevice: z.boolean(),
});

export const backupCodeSchema = z.object({
  code: z.string().trim().min(6, "Enter one of your backup codes").max(64),
});
