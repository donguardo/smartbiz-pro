import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { useT } from "@/lib/i18n";

export function StoreIdentity({ name, logoSrc }: { name: string; logoSrc: string | null | undefined }) {
  const { t } = useT();
  return (
    <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {logoSrc ? <img src={logoSrc} alt={t("profile.logo")} className="h-9 w-9 shrink-0 rounded-md object-contain" /> : <Store className="h-9 w-9 shrink-0 text-primary" aria-hidden />}
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold leading-tight">{name}</span>
        <span className="block text-[10px] text-muted-foreground">MVP BizManager</span>
      </span>
    </Link>
  );
}