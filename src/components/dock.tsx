"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./logo";
import ThemeToggle from "./theme-toggle";

const links = [
  { href: "/blog", label: "Blog" },
  { href: "/lab", label: "Lab" },
  { href: "/experience", label: "Experience" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
];

const item =
  "shrink-0 rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-300 sm:px-3.5 sm:text-sm";

// How tall the hover strip along the bottom edge is, in pixels.
const REVEAL_ZONE = 120;

function useDockHidden() {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [pointerNearBottom, setPointerNearBottom] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = Math.max(window.scrollY, 0);
      const delta = y - lastY.current;
      // Ignore jitter and the rubber-band zone at the very top.
      if (Math.abs(delta) < 6) return;
      lastY.current = y;
      setHiddenByScroll(delta > 0 && y > 96);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    // Touch has no resting cursor, and a tap near the bottom edge would pin
    // the dock open with no way to dismiss it.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let y = 0;

    const update = () => {
      frame = 0;
      setPointerNearBottom(y > window.innerHeight - REVEAL_ZONE);
    };

    const onPointerMove = (event: PointerEvent) => {
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onPointerLeave = () => setPointerNearBottom(false);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Reaching for the dock wins: it stays out while the cursor rests there,
  // even if the page keeps scrolling underneath.
  return hiddenByScroll && !pointerNearBottom;
}

export default function Dock() {
  const pathname = usePathname();
  const hidden = useDockHidden();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const state = (href: string) => (isActive(href) ? "bg-fg text-bg" : "text-muted hover:text-fg");

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-2 sm:px-4"
    >
      <div
        data-hidden={hidden ? "" : undefined}
        className="glass pointer-events-auto flex max-w-full items-center gap-0 p-1 sm:gap-0.5 rounded-full sm:p-1.5 transition-[translate,scale,opacity,filter] duration-[550ms] ease-[cubic-bezier(0.22,1.4,0.36,1)] will-change-transform data-hidden:pointer-events-none data-hidden:translate-y-[160%] data-hidden:scale-90 data-hidden:opacity-0 data-hidden:blur-[6px] data-hidden:duration-300 data-hidden:ease-[cubic-bezier(0.4,0,0.9,0.3)] motion-reduce:transition-none"
      >
        <Link
          href="/"
          aria-label="Home"
          aria-current={isActive("/") ? "page" : undefined}
          className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 sm:size-9 ${isActive("/") ? "bg-fg text-bg" : "text-fg"}`}
        >
          <Logo className="size-5" />
        </Link>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`${item} ${state(href)}`}>
            {label}
          </Link>
        ))}
        <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line sm:mx-1" />
        <ThemeToggle />
      </div>
    </nav>
  );
}
