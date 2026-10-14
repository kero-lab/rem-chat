import type { ReactNode } from 'react';

// Whitelist: javascript:, data:, vbscript: and friends never match. '#' and '?' are same-page.
const ALLOWED = /^(https?:|mailto:|#|\?)/i;

export function isSafeHref(href: string): boolean {
  const h = href.trim();
  // '//host' and '/\host' are protocol-relative to a browser, i.e. cross-origin.
  if (h.startsWith('/')) return !h.startsWith('//') && !h.startsWith('/\\');
  return ALLOWED.test(h);
}

export function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  if (!isSafeHref(href)) return <span>{children}</span>;
  const external = !/^[/#?]/.test(href.trim());
  return (
    <a
      href={href}
      className="text-rem underline underline-offset-2 hover:no-underline"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    >
      {children}
    </a>
  );
}
