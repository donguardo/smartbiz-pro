import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => ({ ...seo("/terms"), meta: [
    { title: "Terms of Service — MVP BizManager" },
    { name: "description", content: "Terms governing access to and use of MVP BizManager, operated by Orangeware PH." },
    { property: "og:title", content: "Terms of Service — MVP BizManager" },
    { property: "og:description", content: "The terms governing access to and use of MVP BizManager." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TermsPage,
});

const sections = [
  {
    title: "1. The Service",
    body: "MVP BizManager is a point-of-sale (POS), inventory, and AI-powered business management tool designed for small and multi-branch businesses. Features include sales recording, inventory tracking, reporting, AI Copilot insights, offline mode, and multi-shop management under paid plans.",
  },
  {
    title: "2. Eligibility and Account",
    items: [
      "You must be at least 18 years old and capable of entering into a binding contract.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.",
      "You must provide accurate and complete information when registering.",
      "You may invite staff (cashiers) to your shops. You remain responsible for their actions within the Service.",
    ],
  },
  {
    title: "3. Plans, Billing, and Payments",
    items: [
      "The Service is offered on a subscription basis (Solopreneur, Booming Business, MultiVerse, and any other plans we publish).",
      "Prices are shown in Philippine Pesos (₱) and are subject to change with notice.",
      "Subscriptions renew automatically unless cancelled.",
      "Payments are processed by third-party providers. We do not store full card details.",
      "You may cancel anytime. Access continues until the end of the current billing period. No refunds for partial periods unless required by law.",
    ],
  },
  {
    title: "4. Your Content and Data",
    items: [
      "You retain ownership of all business data you enter (products, sales, customers, inventory, etc.).",
      "You grant us a limited license to host, process, and display that data solely to provide and improve the Service.",
      "You are solely responsible for the accuracy and legality of the data you input.",
      "We do not claim ownership of your business data.",
    ],
  },
  {
    title: "5. Acceptable Use",
    body: "You agree not to:",
    items: [
      "Use the Service for any illegal purpose",
      "Attempt to reverse-engineer, copy, or resell the Service",
      "Upload malicious code or interfere with the Service’s operation",
      "Share your account credentials",
      "Use the Service to process data you do not have the right to process",
      "Abuse the AI Copilot or attempt to extract training data",
    ],
  },
  {
    title: "6. AI Copilot",
    body: "The AI Copilot provides suggestions and insights based on your own sales and inventory data.\n\nRecommendations are for informational purposes only. You remain solely responsible for all business decisions. We do not guarantee the accuracy or completeness of AI-generated outputs.",
  },
  {
    title: "7. Intellectual Property",
    body: "The Service, including its software, design, branding, and AI features, is owned by us or our licensors. You may not copy, modify, or create derivative works of the Service.",
  },
  {
    title: "8. Availability and Changes",
    items: [
      "We aim for high availability but do not guarantee uninterrupted service.",
      "Offline mode allows continued use when connectivity is limited; data syncs when online.",
      "We may update, modify, or discontinue features with reasonable notice where practicable.",
    ],
  },
  {
    title: "9. Termination",
    items: [
      "You may delete your account at any time (Settings → Account → Delete my account, or by emailing orangewareph@gmail.com).",
      "We may suspend or terminate your account for violation of these Terms, non-payment, or prolonged inactivity.",
      "Upon deletion, your data is handled as described in our Privacy Policy.",
    ],
  },
  {
    title: "10. Disclaimers",
    body: "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.”\n\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.\n\nWE ARE NOT LIABLE FOR BUSINESS LOSSES, LOST PROFITS, OR DECISIONS MADE BASED ON THE SERVICE OR AI RECOMMENDATIONS.",
  },
  {
    title: "11. Limitation of Liability",
    body: "TO THE MAXIMUM EXTENT PERMITTED BY PHILIPPINE LAW, OUR TOTAL LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
  },
  {
    title: "12. Indemnification",
    body: "You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your use of the Service, your data, or your violation of these Terms.",
  },
  {
    title: "13. Governing Law and Disputes",
    body: "These Terms are governed by the laws of the Republic of the Philippines.\n\nAny dispute shall first be attempted to be resolved amicably. If unresolved, it shall be submitted to the competent courts of the Philippines.",
  },
  {
    title: "14. Changes to These Terms",
    body: "We may update these Terms from time to time. Material changes will be notified by email or in-app notice. Continued use after the effective date constitutes acceptance.",
  },
  {
    title: "15. Contact",
    body: "For questions about these Terms:",
    email: "orangewareph@gmail.com",
  },
];

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 9, 2026"
      intro={"These Terms of Service (“Terms”) govern your access to and use of MVP BizManager (the “Service”), operated by Orangeware PH (“we,” “us,” or “our”), available at mvp.com.ai and through our mobile/web application.\n\nBy creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service."}
      sections={sections}
    />
  );
}
