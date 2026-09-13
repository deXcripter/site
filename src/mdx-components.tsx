import type { MDXComponents } from "mdx/types";
import Link from "next/link";

const components: MDXComponents = {
  a: ({ href = "", children, ...props }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} {...props}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ),
  // Markdown images have no intrinsic dimensions, so next/image can't size them.
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ alt = "", ...props }) => <img alt={alt} loading="lazy" decoding="async" {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
