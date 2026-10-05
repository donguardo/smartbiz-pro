import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ to = "/" as "/" | "/dashboard", compact = false }: { to?: "/" | "/dashboard"; compact?: boolean }) {
  return (
    <Link to={to} className={`flex min-w-0 items-center ${compact ? "gap-1.5" : "gap-2 sm:gap-4"}`} aria-label="MVP BizManager">
      <img src={logoAsset.url} alt="" width={64} height={64} className={compact ? "h-9 w-9 shrink-0 object-contain" : "h-10 w-10 shrink-0 object-contain sm:h-16 sm:w-16"} />
      <span className={`min-w-0 whitespace-nowrap font-display font-bold leading-none ${compact ? "text-xs min-[390px]:text-sm" : "text-lg sm:text-3xl"}`}>
        MVP BizManager
      </span>
    </Link>
  );
}
