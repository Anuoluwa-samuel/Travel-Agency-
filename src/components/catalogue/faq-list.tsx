import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { JsonLd } from "@/components/seo/json-ld";

export function FaqList({ faqs, id = "faqs" }: { faqs: { question: string; answer: string }[]; id?: string }) {
  if (faqs.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-2xl">
        Questions travellers ask
      </h2>
      <Accordion type="multiple" className="border-t">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="min-h-11 text-base">{f.question}</AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">{f.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }}
      />
    </section>
  );
}
