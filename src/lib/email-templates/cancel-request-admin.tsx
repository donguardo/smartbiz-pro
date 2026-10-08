import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { shop?: string; ownerEmail?: string; plan?: string; reason?: string }

function CancelRequestAdmin({ shop = "A shop", ownerEmail = "—", plan = "—", reason }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New cancel request from {shop}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ color: "#FF00FF", fontSize: "22px" }}>New cancel request</Heading>
          <Text><b>Shop:</b> {shop}</Text>
          <Text><b>Owner:</b> {ownerEmail}</Text>
          <Text><b>Plan:</b> {plan}</Text>
          <Text><b>Reason:</b> {reason || "(none given)"}</Text>
          <Text>Their plan stays active until you decide. Open Platform Admin to approve or reach out.</Text>
          <Button href="https://admin.mvp.com.ai/admin" style={{ backgroundColor: "#FF00FF", color: "#ffffff", padding: "12px 20px", borderRadius: "8px" }}>Open Platform Admin</Button>
          <Text style={{ color: "#888888", fontSize: "12px" }}>MVP BizManager.ai</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: CancelRequestAdmin,
  subject: (d: Record<string, unknown>) => `Cancel request: ${String(d["shop"] ?? "a shop")}`,
  displayName: "Cancel request alert (admin)",
  to: "admin@mvp.com.ai",
  previewData: { shop: "Aling Nena Store", ownerEmail: "owner@example.com", plan: "Booming Business", reason: "Closing for the season" },
} satisfies TemplateEntry;
