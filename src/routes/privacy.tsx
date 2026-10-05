import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Notice — MVP BizManager" },
    { name: "description", content: "Privacy Notice for MVP BizManager under the Philippine Data Privacy Act." },
    { property: "og:title", content: "Privacy Notice — MVP BizManager" },
    { property: "og:description", content: "How MVP BizManager handles personal information under Philippine privacy law." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PrivacyPage,
});

const sections = [
  { title: "Information we collect", body: "Placeholder: Describe account, business, sales, inventory, device, and support information collected when people use MVP BizManager." },
  { title: "How information is used", body: "Placeholder: Explain how information supports account access, POS and inventory features, AI assistance, service security, support, and improvement." },
  { title: "Sharing and retention", body: "Placeholder: Identify service providers, legal disclosures, retention periods, and safeguards applied to personal information." },
  { title: "Your rights", body: "Under Republic Act No. 10173, the Data Privacy Act of 2012, data subjects may have rights to be informed, access, object, correct, erase or block, obtain data portability, and seek damages, subject to applicable law." },
  { title: "Deleting your account", body: "You can delete your account and data at any time from Settings → Account → \"Delete my account\", or by following the steps on our Delete your account page (/delete-account)." },
  { title: "Contact and complaints", body: "Placeholder: Add the organization’s privacy contact details and instructions for raising a concern or contacting the National Privacy Commission." },
];

function PrivacyPage() {
  return <LegalPage title="Privacy Notice" updated="October 5, 2026" intro="This placeholder notice outlines how MVP BizManager intends to handle personal information in accordance with the Philippine Data Privacy Act. Replace it with legal counsel-approved text before launch." sections={sections} />;
}