import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-5 pb-32 sm:px-8">
      <div className="flex flex-col gap-4 border-t border-line pt-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {site.socials.map(({ label, href }) => (
            <li key={label}>
              <a href={href} target="_blank" rel="me noopener noreferrer" className="transition-colors hover:text-fg">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
