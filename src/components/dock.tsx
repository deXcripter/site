"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./logo";
import ThemeToggle from "./theme-toggle";

const links = [
  { href: "/blog", label: "Blog" },
  { href: "/experience", label: "Experience" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
];

const item =
  "rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors duration-300 sm:px-3.5 sm:text-sm";

export default function Dock() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const state = (href: string) => (isActive(href) ? "bg-fg text-bg" : "text-muted hover:text-fg");

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1.5">
        <Link
          href="/"
          aria-label="Home"
          aria-current={isActive("/") ? "page" : undefined}
          className={`grid size-9 place-items-center rounded-full transition-colors duration-300 ${isActive("/") ? "bg-fg text-bg" : "text-fg"}`}
        >
          <Logo className="size-5" />
        </Link>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`${item} ${state(href)}`}>
            {label}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <ThemeToggle />
      </div>
    </nav>
  );
}
