import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ to = "/" as "/" | "/dashboard" }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-4" aria-label="MVP BizManager.ai">
      <img src={logoAsset.url} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
      <span className="font-display text-3xl font-bold leading-none">
        MVP BizManager<span className="text-primary">.ai</span>
      </span>
    </Link>
  );
}
