import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ to = "/" as "/" | "/dashboard" }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2" aria-label="BizManager.ai — MAS KITA, MAS TUBO!">
      <img src={logoAsset.url} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-base font-bold leading-none">
          BizManager<span className="text-primary">.ai</span>
        </span>
        <span className="mt-1 whitespace-nowrap font-mono text-[8px] font-semibold uppercase leading-none text-primary sm:text-[9px]">
          MAS KITA, MAS TUBO!
        </span>
      </span>
    </Link>
  );
}
