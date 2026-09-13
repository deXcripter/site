import { useId } from "react";
import { LOGO_LEFT_CLIP, LOGO_RIGHT_CLIP } from "@/lib/logo";

export default function Logo({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/[^\w-]/g, "");

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={`${id}l`}>
          <path d={LOGO_LEFT_CLIP} />
        </clipPath>
        <clipPath id={`${id}r`}>
          <path d={LOGO_RIGHT_CLIP} />
        </clipPath>
      </defs>
      <rect x="1.5" y="3.5" width="27" height="27" rx="7" fill="currentColor" clipPath={`url(#${id}l)`} />
      <g transform="translate(1.8 -1.8)">
        <rect x="1.5" y="3.5" width="27" height="27" rx="7" fill="var(--accent)" clipPath={`url(#${id}r)`} />
      </g>
    </svg>
  );
}
