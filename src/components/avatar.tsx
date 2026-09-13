import Image from "next/image";
import Logo from "./logo";
import { site } from "@/lib/site";

export default function Avatar() {
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_24px_-10px_rgb(0_0_0/0.35)] ring-1 ring-line sm:size-16">
      {site.avatar ? (
        <Image src={site.avatar} alt={site.name} fill sizes="64px" loading="eager" fetchPriority="high" className="object-cover" />
      ) : (
        <div className="grid size-full place-items-center">
          <Logo className="size-[50%] text-fg" />
        </div>
      )}
    </div>
  );
}
