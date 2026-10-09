import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Item { name: string; qty: number; unit: string }
interface Props { shop?: string; orderNo?: string; customer?: string; total?: string; items?: Item[]; note?: string }

function NewOrderOwner({ shop = "Your store", orderNo = "", customer = "A customer", total = "₱0", items = [], note }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New online order {orderNo} at {shop}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ color: "#FF00FF", fontSize: "22px" }}>New online order</Heading>
          <Text><b>Store:</b> {shop}</Text>
          <Text><b>Order:</b> #{orderNo}</Text>
          <Text><b>Customer:</b> {customer}</Text>
          {items.map((i, k) => <Text key={k} style={{ margin: "2px 0" }}>• {i.qty} {i.unit} {i.name}</Text>)}
          <Text><b>Total:</b> {total}</Text>
          {note ? <Text><b>Note:</b> {note}</Text> : null}
          <Button href="https://mvp.com.ai/stores" style={{ backgroundColor: "#FF00FF", color: "#ffffff", padding: "12px 20px", borderRadius: "8px" }}>Open my orders</Button>
          <Text style={{ color: "#888888", fontSize: "12px" }}>MVP BizManager.ai · MAS KITA, MAS TUBO!</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: NewOrderOwner,
  subject: (d: Record<string, unknown>) => `New online order #${String(d["orderNo"] ?? "")} – ${String(d["shop"] ?? "your store")}`,
  displayName: "New online order (store owner)",
  previewData: { shop: "Aling Nena Store", orderNo: "W-0001", customer: "Juan", total: "₱250", items: [{ name: "Coke 1.5L", qty: 2, unit: "pcs" }] },
} satisfies TemplateEntry;
