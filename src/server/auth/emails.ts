import "server-only";
import { brand } from "@/config/brand";

/**
 * Auth email copy. Plain text first (always delivered), simple HTML second. Full templating
 * moves to the notification service in Phase 5.
 */
function layout(title: string, body: string, cta: { label: string; url: string }) {
  const text = `${title}\n\n${body}\n\n${cta.label}: ${cta.url}\n\nIf you didn't request this, you can ignore this email.\n\n— ${brand.name}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:Inter,Arial,sans-serif;color:#0B2545">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #DFE4EB;border-radius:10px">
<tr><td style="padding:28px 32px;border-bottom:1px solid #EEF1F5;font-family:Georgia,serif;letter-spacing:4px;font-size:18px">${brand.name}</td></tr>
<tr><td style="padding:28px 32px">
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:0 0 12px">${title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
<a href="${cta.url}" style="display:inline-block;background:#0B2545;color:#F7F8FA;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">${cta.label}</a>
<p style="font-size:13px;color:#5B6675;margin:24px 0 0">If you didn't request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}

export function verificationEmail(url: string) {
  return {
    subject: `Confirm your email for ${brand.name}`,
    ...layout("Confirm your email", "Please confirm this email address to finish setting up your account.", {
      label: "Confirm email",
      url,
    }),
  };
}

export function resetPasswordEmail(url: string) {
  return {
    subject: `Reset your ${brand.name} password`,
    ...layout("Reset your password", "We received a request to reset your password. This link expires in 1 hour.", {
      label: "Choose a new password",
      url,
    }),
  };
}
