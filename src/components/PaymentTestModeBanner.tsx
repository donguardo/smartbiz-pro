import { usePaymentsEnv } from "@/lib/billing";

export function PaymentTestModeBanner() {
  const { data: env } = usePaymentsEnv();
  if (env !== "sandbox") return null;
  return (
    <div className="w-full border-b border-border bg-accent px-4 py-2 text-center text-sm text-accent-foreground">
      All payments made in the preview are in test mode.{" "}
      <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="font-medium underline">Read more</a>
    </div>
  );
}
