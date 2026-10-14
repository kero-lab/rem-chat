/**
 * Hosts a chat message may load images from without a click.
 * Markdown images auto-load, so an injected URL is an exfiltration channel.
 * Apps opt further hosts in; anything else is click-to-load.
 */
export const DEFAULT_IMAGE_HOSTS: readonly string[] = ['cdn.discordapp.com', 'media.discordapp.net', 'cdn.kero-ara.com'];

export interface ImageAllowlistOptions {
  extraHosts?: string[];
  /** Hostname suffixes, leading dot included (e.g. '.rem.home'). */
  extraSuffixes?: string[];
  /** The app's own origin; absolute https URLs on it are allowed too. */
  origin?: string;
}

// Resolve relative paths the way a browser would ('/\host' and '//host' are
// cross-origin), then require that they stayed on this placeholder origin.
const SAME_ORIGIN = 'https://same-origin.invalid';

export function isAllowedChatImage(src: string | undefined, opts: ImageAllowlistOptions = {}): boolean {
  if (!src) return false;
  let url: URL;
  try {
    url = new URL(src, SAME_ORIGIN);
  } catch {
    return false;
  }
  if (url.origin === SAME_ORIGIN) return src.startsWith('/');
  if (url.protocol !== 'https:') return false;
  if (opts.origin && url.origin === opts.origin) return true;
  const host = url.hostname;
  return DEFAULT_IMAGE_HOSTS.includes(host)
    || (opts.extraHosts ?? []).includes(host)
    || (opts.extraSuffixes ?? []).some((s) => host.endsWith(s));
}
