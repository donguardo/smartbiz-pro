import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ to = "/" as "/" | "/dashboard" }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2 sm:gap-4" aria-label="MVP BizManager">
      <img src={logoAsset.url} alt="" width={64} height={64} className="h-10 w-10 shrink-0 object-contain sm:h-16 sm:w-16" />
      <span className="min-w-0 whitespace-nowrap font-display text-lg font-bold leading-none sm:text-3xl">
        MVP BizManager
      </span>
    </Link>
  );
}
