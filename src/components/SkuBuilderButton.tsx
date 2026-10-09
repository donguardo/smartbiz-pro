import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { useT } from "@/lib/i18n";

export function SkuBuilderButton({ className = "" }: { className?: string }) {
  const { t } = useT();
  return (
    <Link to="/sku-builder" className={`inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 ${className}`}>
      <Boxes className="h-4 w-4" />{t("sku.button")}
    </Link>
  );
}
