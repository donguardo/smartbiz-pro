import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms of Service — MVP BizManager" },
    { name: "description", content: "Terms governing use of MVP BizManager." },
    { property: "og:title", content: "Terms of Service — MVP BizManager" },
    { property: "og:description", content: "The terms governing access to and use of MVP BizManager." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TermsPage,
});

const sections = [
  { title: "Using the service", body: "Placeholder: Describe account eligibility, acceptable use, account security, and the user’s responsibility for business and transaction records." },
  { title: "Subscription and billing", body: "Placeholder: State the ₱499 per-user monthly price, billing timing, taxes, cancellation, renewal, and refund rules before accepting paid subscriptions." },
  { title: "Payments and records", body: "MVP BizManager records payment methods selected by a user. Placeholder: Clarify that the service does not itself process Cash, GCash, or Card payments unless a separate payment service is introduced." },
  { title: "AI features", body: "Placeholder: Explain that AI-generated suggestions may be incomplete and should be reviewed before making inventory, financial, or business decisions." },
  { title: "Availability and liability", body: "Placeholder: Add service availability, warranty disclaimers, limits of liability, indemnity, suspension, termination, and governing-law provisions approved by legal counsel." },
];

function TermsPage() {
  return <LegalPage title="Terms of Service" updated="October 5, 2026" intro="These placeholder terms describe the expected conditions for using MVP BizManager. Replace them with legal counsel-approved terms before accepting customers." sections={sections} />;
}