import "server-only";
import { brand } from "@/config/brand";
import { ENQUIRY_CATEGORIES, type EnquiryCategory } from "@/lib/validation/enquiry";

export function enquiryAcknowledgement(input: {
  name: string;
  reference: string;
  category: EnquiryCategory;
  subject?: string | null;
}) {
  const first = input.name.split(" ")[0];
  const topic = input.subject ?? ENQUIRY_CATEGORIES[input.category].toLowerCase();
  const text = `Hi ${first},

Thanks for getting in touch with ${brand.name}. We've received your enquiry about ${topic}.

Your reference is ${input.reference}. Please quote it if you contact us.

What happens next: a travel consultant will review your details and reply, usually within one working day. This is an enquiry, not a booking. Nothing is reserved or charged until we've confirmed availability and prices with you.

— The ${brand.name} team`;
  return { subject: `We've received your enquiry (${input.reference})`, text };
}
