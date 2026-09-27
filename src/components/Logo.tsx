import { Link } from "@tanstack/react-router";

export function Logo({ to = "/" as "/" | "/dashboard" }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
      <span className="font-display text-base font-bold leading-none">
        BizManager<span className="text-primary">.ai</span>
      </span>
    </Link>
  );
}
