import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({ meta: [
    { title: "Refund Policy — MVP BizManager" },
    { name: "description", content: "30-day money-back guarantee for MVP BizManager subscriptions and how to request a refund." },
    { property: "og:title", content: "Refund Policy — MVP BizManager" },
    { property: "og:description", content: "30-day money-back guarantee for MVP BizManager subscriptions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RefundPage,
});

const sections = [
  { title: "30-day money-back guarantee", body: "If you are not satisfied with your MVP BizManager subscription, you can request a full refund within 30 days of your order date. This applies to your first payment and to each monthly renewal, counted from the date of that payment." },
  { title: "How to request a refund", body: "Our order process is handled by our online reseller Paddle.com, the Merchant of Record for all our orders. To request a refund, visit paddle.net and look up your order using the email on your receipt, or email us at orangewareph@gmail.com and we will help you." },
  { title: "Cancelling your subscription", body: "You can cancel at any time from Billing in the app (Manage billing & payment method). After cancelling, you keep access until the end of the month you have already paid for, and you will not be charged again." },
  { title: "How refunds are paid", body: "Approved refunds are returned to the original payment method. Depending on your bank or card provider, it may take 5–10 business days for the refund to appear." },
  { title: "Free trial", body: "New shops get a 14-day free trial. You are not charged during the trial, so no refund is needed if you decide not to subscribe." },
];

function RefundPage() {
  return <LegalPage title="Refund Policy" updated="October 6, 2026" intro="This policy explains refunds for MVP BizManager subscriptions." sections={sections} />;
}
