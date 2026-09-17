"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/posts";

// A heading counts as current once it passes this far up the viewport.
const ACTIVE_LINE = 140;

function useActiveHeading(headings: Heading[]) {
  const [active, setActive] = useState("");

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const tops = headings.map((h) => document.getElementById(h.id)?.getBoundingClientRect().top ?? Infinity);
      // The last heading above the line wins; before the first one, nothing is active.
      let current = "";
      for (let i = 0; i < headings.length; i++) {
        if (tops[i] <= ACTIVE_LINE) current = headings[i].id;
      }
      // At the very bottom the last section may be too short to cross the line.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = headings.at(-1)?.id ?? current;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings]);

  return active;
}

export default function PostOutline({ headings }: { headings: Heading[] }) {
  const active = useActiveHeading(headings);

  return (
    <nav
      aria-label="On this page"
      className="fixed top-32 right-[calc(50%+22rem)] hidden w-56 xl:block"
    >
      <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">On this page</p>
      <ul className="mt-4 space-y-1 border-l border-line">
        {headings.map((heading) => {
          const isActive = heading.id === active;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`-ml-px block border-l py-1 text-[13px] leading-snug transition-colors duration-300 ${
                  heading.level === 3 ? "pl-6" : "pl-3"
                } ${isActive ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
