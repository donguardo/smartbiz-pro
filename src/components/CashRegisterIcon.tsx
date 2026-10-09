import type { SVGProps } from "react";

/** Cash register glyph — a screen on a stand above a drawer with keys. */
export function CashRegisterIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect x="7" y="2" width="10" height="5" rx="1" />
      <path d="M9 7v2" />
      <path d="M15 7v2" />
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M7 13h3" />
      <path d="M14 13h3" />
      <path d="M3 17h18" />
    </svg>
  );
}
