import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => ({ ...seo("/privacy"), meta: [
    { title: "Privacy Policy — MVP BizManager" },
    { name: "description", content: "Privacy Policy for MVP BizManager under the Philippine Data Privacy Act of 2012 (RA 10173)." },
    { property: "og:title", content: "Privacy Policy — MVP BizManager" },
    { property: "og:description", content: "How MVP BizManager collects, uses, shares, stores, and protects your personal information under the Philippine Data Privacy Act of 2012." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "1. Information We Collect",
    body: "We collect the following categories of information:\n\nA. Account and Profile Information",
    items: [
      "Name, email address, phone number (if provided)",
      "Business/store name and address",
      "Login credentials (or Google sign-in data)",
      "Plan type and billing-related information",
    ],
  },
  {
    title: "",
    body: "B. Business and Operational Data",
    items: [
      "Products, inventory levels, prices, and categories",
      "Sales transactions, receipts, payment methods (Cash, GCash, Card, etc.)",
      "Customer and supplier records you enter",
      "Expenses and other business records",
      "Staff/cashier accounts and activity logs",
      "Files and images you upload (e.g., product photos, logos)",
    ],
  },
  {
    title: "",
    body: "C. Device and Technical Information",
    items: [
      "Device type, operating system, browser type",
      "IP address, approximate location (city/region level)",
      "App usage data, crash logs, and performance diagnostics",
      "Cookies and similar technologies on our website",
    ],
  },
  {
    title: "",
    body: "D. Support and Communications",
    items: [
      "Messages you send to our support team",
      "Feedback, survey responses, or feature requests",
    ],
  },
  {
    title: "",
    body: "We do not collect or store full payment card numbers. Payments are processed by third-party payment providers.",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use the information we collect to:",
    items: [
      "Create and manage your account and shops",
      "Provide POS, inventory, sales tracking, and reporting features",
      "Power the AI Copilot (answering questions and giving recommendations based on your own sales and stock data)",
      "Process subscriptions and send invoices/receipts",
      "Enable offline functionality and data synchronization",
      "Improve the Service, fix bugs, and develop new features",
      "Detect, prevent, and investigate fraud, abuse, or security incidents",
      "Respond to support requests and communicate important service updates",
      "Comply with legal obligations",
    ],
  },
  {
    title: "",
    body: "We do not use your business sales or inventory data to train general-purpose AI models that are shared with other customers.",
  },
  {
    title: "3. Legal Bases for Processing (Philippine Data Privacy Act)",
    body: "We process your personal information based on:",
    items: [
      "Contract – to provide the Service you signed up for",
      "Consent – where you have given clear consent (e.g., marketing emails)",
      "Legitimate interests – to improve the Service, ensure security, and prevent fraud",
      "Legal obligation – when required by law or government authorities",
    ],
  },
  {
    title: "4. How We Share Your Information",
    body: "We do not sell, rent, or trade your personal information.\n\nWe may share information only in these limited cases:",
    items: [
      "Service providers who help us operate the Service (cloud hosting, email delivery, payment processors, analytics). These providers are bound by contracts that require them to protect your data and use it only for the services they provide to us.",
      "Legal requirements – when we are required by law, court order, or government request, or to protect our rights, safety, or property.",
      "Business transfers – in connection with a merger, acquisition, or sale of assets (your data would remain protected under a similar privacy policy).",
    ],
  },
  {
    title: "",
    body: "Your business data stays private to your account and the staff members you invite.",
  },
  {
    title: "5. Data Retention",
    items: [
      "We keep your account and business data for as long as your account remains active.",
      "When you delete your account, we delete or irreversibly anonymize your personal information and shop data within a reasonable period, except for limited records we are legally required to keep (e.g., transaction logs for tax or accounting purposes, or a scrambled deletion record).",
      "Support emails and technical logs are generally retained for up to 24 months.",
    ],
  },
  {
    title: "6. Your Rights Under the Data Privacy Act",
    body: "As a data subject, you have the right to:",
    items: [
      "Be informed about how your data is processed",
      "Access the personal information we hold about you",
      "Object to processing (in certain cases)",
      "Correct or update inaccurate data",
      "Erase or block your data",
      "Data portability (receive your data in a structured format)",
      "File a complaint with the National Privacy Commission",
      "Seek damages for violations of your rights",
    ],
  },
  {
    title: "",
    body: "You can exercise most of these rights directly in the app or by contacting us.",
  },
  {
    title: "7. How to Delete Your Account and Data",
    body: "You can delete your account at any time:",
    items: [
      "Open MVP BizManager and go to Settings → Account",
      "Tap “Delete my account”",
      "Follow the on-screen instructions (you will need to type DELETE and confirm your password or Google sign-in)",
    ],
  },
  {
    title: "",
    body: "Alternatively, email us from your registered email address with the subject “Account deletion request”.",
    email: "orangewareph@gmail.com",
    link: { to: "/delete-account", label: "Delete Account page" },
  },
  {
    title: "",
    body: "What happens when you delete:",
    items: [
      "Your shop membership is removed",
      "Products, sales, customers, suppliers, expenses, and uploaded files are deleted",
      "Sales made by former cashiers remain in the shop records labeled as “Former staff”",
      "We retain only the deletion date and a scrambled identifier (never your name or email)",
    ],
  },
  {
    title: "8. Security",
    body: "We use industry-standard technical and organizational measures to protect your data, including encryption in transit, access controls, and regular security reviews. No method of transmission or storage is 100% secure, but we continuously work to improve our safeguards.",
  },
  {
    title: "9. Children’s Privacy",
    body: "MVP BizManager is intended for business use by adults. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, please contact us so we can delete it.",
  },
  {
    title: "10. International Transfers",
    body: "Your data may be processed and stored on servers located outside the Philippines (for example, with cloud service providers). When we transfer data internationally, we ensure appropriate safeguards are in place as required by the Data Privacy Act.",
  },
  {
    title: "11. Cookies and Similar Technologies",
    body: "Our website uses cookies and similar technologies to keep you logged in, remember preferences, and understand how the site is used. You can control cookies through your browser settings.",
  },
  {
    title: "12. Changes to This Privacy Policy",
    body: "We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or through an in-app notice and update the “Last updated” date. Continued use of the Service after the changes take effect constitutes acceptance of the updated policy.",
  },
  {
    title: "13. Contact Us",
    body: "If you have any questions, requests, or complaints about this Privacy Policy or our data practices, please contact us:",
    email: "orangewareph@gmail.com",
    externalLink: { href: "https://privacy.gov.ph", label: "National Privacy Commission of the Philippines — privacy.gov.ph" },
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 9, 2026"
      intro={"MVP BizManager (“we,” “us,” “our,” or “the Service”) is operated by Orangeware PH. We respect your privacy and are committed to protecting the personal information you share with us when you use our website (mvp.com.ai) and our POS, inventory, and AI-powered business management application.\n\nThis Privacy Policy explains what information we collect, how we use it, how we share it, how long we keep it, and the rights you have under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and other applicable laws.\n\nBy creating an account or using MVP BizManager, you agree to the practices described in this policy."}
      sections={sections}
    />
  );
}
