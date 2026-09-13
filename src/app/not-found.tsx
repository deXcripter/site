import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center">
      <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">This page isn&apos;t indexed.</h1>
      <p className="mt-4 text-lg text-muted">Not by Google, not by ChatGPT, not by anyone.</p>
      <Link href="/" className="mt-8 w-fit rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-85">
        Back home
      </Link>
    </div>
  );
}
