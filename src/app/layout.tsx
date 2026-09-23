import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import Script from "next/script";
import Dock from "@/components/dock";
import Footer from "@/components/footer";
import JsonLd from "@/components/json-ld";
import { personId, site } from "@/lib/site";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: `${site.url}/about` }],
  creator: site.name,
  robots: { index: true, follow: true, googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edece8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Runs before first paint so the stored or system theme never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only rounded-full bg-fg px-4 py-2 text-sm text-bg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]"
        >
          Skip to content
        </a>
        <main id="main" className="w-full flex-1 px-5 pb-28 sm:px-8">
          {children}
        </main>
        <Footer />
        <Dock />

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Person",
                "@id": personId,
                name: site.name,
                givenName: site.givenName,
                familyName: site.familyName,
                alternateName: site.handle,
                url: site.url,
                ...(site.avatar ? { image: `${site.url}${site.avatar}` } : {}),
                jobTitle: "SEO Software Engineer",
                description: site.description,
                worksFor: { "@type": "Organization", name: "SEORCE" },
                alumniOf: { "@type": "CollegeOrUniversity", name: "Nnamdi Azikiwe University" },
                knowsAbout: site.knowsAbout,
                sameAs: site.socials.map((s) => s.href),
              },
              {
                "@type": "WebSite",
                "@id": `${site.url}/#website`,
                url: site.url,
                name: site.name,
                inLanguage: "en",
                publisher: { "@id": personId },
              },
            ],
          }}
        />
        <Script src="https://cdn.exeolabs.com/script.js" strategy="afterInteractive" data-site="334616476419637248" />
      </body>
    </html>
  );
}
