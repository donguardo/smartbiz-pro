import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => ({ ...seo("/privacy"), meta: [
    { title: "Privacy Notice — MVP BizManager" },
    { name: "description", content: "Privacy Notice for MVP BizManager under the Philippine Data Privacy Act of 2012." },
    { property: "og:title", content: "Privacy Notice — MVP BizManager" },
    { property: "og:description", content: "How MVP BizManager collects, uses, stores, and protects your personal information under the Philippine Data Privacy Act of 2012." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "1. Information We Collect",
    body: "We may collect the following information when you use MVP BizManager:",
    items: [
      "Account information (name, email address, phone number)",
      "Business information (store name, address, business type)",
      "Sales, inventory, and transaction data",
      "Payment-related information (we do not store full card details)",
      "Device information and usage data",
      "Support and communication records",
    ],
  },
  {
    title: "2. How We Use Your Information",
    body: "We use the information to:",
    items: [
      "Provide and operate the POS, inventory, and AI features",
      "Create and manage your account",
      "Process sales and generate reports",
      "Improve the service and AI assistance",
      "Provide customer support",
      "Ensure security and prevent fraud",
      "Comply with legal obligations",
    ],
  },
  {
    title: "3. Sharing of Information",
    body: "We do not sell your personal information.\n\nWe may share information only with:",
    items: [
      "Trusted service providers who help us operate the platform",
      "Legal authorities when required by law",
    ],
  },
  {
    title: "4. Data Storage and Security",
    body: "Your data is stored securely using industry-standard measures. We take reasonable steps to protect your information from unauthorized access, loss, or misuse.",
  },
  {
    title: "5. Your Rights",
    body: "Under the Data Privacy Act of 2012, you have the right to:",
    items: [
      "Be informed",
      "Access your data",
      "Correct inaccurate data",
      "Object to processing",
      "Request erasure or blocking of your data",
      "Data portability",
      "File a complaint with the National Privacy Commission",
    ],
  },
  {
    title: "6. Deleting Your Account",
    body: "You may delete your account and associated data at any time by going to:\n\nSettings → Account → Delete my account\n\nor by visiting our Delete Account page.",
    link: { to: "/delete-account", label: "Delete Account page" },
  },
  {
    title: "7. Contact Us",
    body: "If you have any questions, requests, or complaints regarding your personal data, please contact us at:",
    email: "orangewareph@gmail.com",
  },
  {
    title: "8. Changes to This Notice",
    body: "We may update this Privacy Notice from time to time. The updated version will be posted on this page with a new “Last updated” date.\n\nYou may also contact the National Privacy Commission of the Philippines.",
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      updated="October 9, 2026"
      intro="MVP BizManager (“we”, “us”, or “our”) operates the website mvp.com.ai and the related mobile application. This Privacy Notice explains how we collect, use, store, and protect your personal information in accordance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173)."
      sections={sections}
    />
  );
}
