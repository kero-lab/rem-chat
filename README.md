# @kero-lab/rem-chat

Rem chat engine + display pieces shared by RemHub and KeroHub: the stream protocol, turn helpers, markdown and tool-part rendering (`MessageParts`), `createRemChatStore`, `useChatSession` and `ContinuePill`.

## Install

The package is public, but GitHub Packages requires a token even to install public packages. In the consumer's `.npmrc`:

```ini
@kero-lab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

`NPM_TOKEN` is a GitHub token with `read:packages`. Then `bun add @kero-lab/rem-chat` and install the peer dependencies: `react`, `react-dom`, `zustand`, `streamdown`, `@streamdown/code`, `remark-breaks`, `motion`, `lucide-react`, `@radix-ui/react-dialog`, `use-stick-to-bottom`.

The package does not depend on `@kero-lab/ui`.

## Next.js

The package ships TypeScript source, so transpile it:

```ts
// next.config.ts
const nextConfig = { transpilePackages: ['@kero-lab/rem-chat'] };
```

## CSS

```css
@import "tailwindcss";
@import "@kero-lab/rem-chat/styles.css";
@source "../../node_modules/@kero-lab/rem-chat/src/**/*.{ts,tsx}";
```

Adjust the `@source` path to the CSS file's location. The components also use the shadcn theme tokens `border`, `muted`, `muted-foreground`, `foreground`, `popover`, `popover-foreground`, `ring` and `destructive` (as Tailwind colours, e.g. `bg-muted`, `border-border`), so the app must define those too. The app must also define the tokens `--rem`, `--rem-soft` and `--rem-faint`, and map them in Tailwind's theme as `--color-rem`, `--color-rem-soft` and `--color-rem-faint`:

```css
:root { --rem: #3f7ab1; --rem-soft: /* app value */; --rem-faint: /* app value */; }
.dark { --rem: #83d2f2; /* ... */ }
@theme inline {
  --color-rem: var(--rem);
  --color-rem-soft: var(--rem-soft);
  --color-rem-faint: var(--rem-faint);
}
```

## Usage

```tsx
// rem-chat-store.ts  (a client module: starts with 'use client' or is only imported by client components)
import { createRemChatStore } from '@kero-lab/rem-chat';

export const remChat = createRemChatStore({
  sessionStorageKey: 'my-app:rem-chat',
  transport: (body, signal) =>
    fetch('/api/rem/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }),
});
```

```tsx
'use client';
import { useStore } from 'zustand';
import { MessageParts, ContinuePill, useChatSession } from '@kero-lab/rem-chat';
import { remChat } from './rem-chat-store';

export function RemChat() {
  const messages = useStore(remChat, (s) => s.messages);
  const isLoading = useStore(remChat, (s) => s.isLoading);
  const lastActivityAt = useStore(remChat, (s) => s.lastActivityAt);
  const { resumable, continueChat } = useChatSession(remChat);
  return (
    <>
      {resumable && <ContinuePill onContinue={continueChat} lastActivityAt={lastActivityAt} />}
      {messages.map((m, i) => (
        <MessageParts key={m.id} message={m} streaming={isLoading && i === messages.length - 1} />
      ))}
      <button onClick={() => remChat.getState().send('hi')}>Send</button>
    </>
  );
}
```

`RemMark` takes the app's own `RemIcon` through its `icon` prop: `<RemMark state="idle" icon={<RemIcon />} />`.

Create `createRemChatStore` in a client module and read it only on the client. It mints a random `sessionId` (and restores from storage), so reading it during SSR gives a server/client mismatch.

## Injection points

Everything app-specific is injected; the defaults render plain, safe output.

| Point | Where | Purpose |
|-------|-------|---------|
| `renderLink` | `MessageParts` `markdown` prop (`ChatMarkdown`) | Custom link renderer. Only called with an href that passed `isSafeHref` (`http:`, `https:`, `mailto:`, relative). It is a **render function, called inline** (`renderLink({ href, children })`), not mounted as a component, so it must not call hooks; return an element (your own component can use hooks). |
| `renderCitation` | `markdown` prop | Custom `[n]` citation renderer. Only called when the source url is safe. |
| `TipProvider` | context provider | Supplies the app's tooltip component (`TipComponent`); the default is a minimal CSS tip. `label` is a `ReactNode` (the tool chip passes styled prose), and the provided component must keep a stable identity (module scope), or every tooltip remounts on each render. |
| `renderNavLink` | `toolMedia` prop | Renders in-app navigation links in tool media (e.g. the app's router `Link`). |
| `renderGenerating` | `toolMedia` prop | Placeholder shown while an image tool is generating: `(state: { startedAt?: number; still: boolean; label?: ReactNode }) => ReactNode`. `startedAt` is the epoch ms the call began, `still` is true once there is nothing left to wait for (the call failed, or ended without media), so draw a static frame. The default is `ImageGenPlaceholder`. |
| `imageOpts` | `markdown` and `toolMedia` props | Image auto-load policy: `extraHosts`, `extraSuffixes` (leading dot, e.g. `.rem.home`), `origin`. Defaults auto-load `cdn.discordapp.com`, `media.discordapp.net`, `cdn.kero-ara.com` and same-origin; every other host is click-to-load. `toolMedia` inherits the markdown policy unless set. |
| `cards` | `MessageParts` prop | `CardRegistry`: card kind to the app's component. A kind with no entry renders nothing (its chip still shows). |
| `renderers` | `MessageParts` prop | Replaces the default renderer for an exact part type (`text`, `file`, or a `data-*` type). |

**Injected components must have a stable identity.** Define `renderLink`, `renderCitation`, the `TipProvider` component, `renderNavLink`, `renderGenerating`, the `cards` and `renderers` entries, and `imageOpts` at module scope (or memoize them). A new function on each render makes streamdown re-render every finished block while a reply streams.

## Development

```bash
bun install   # needs NPM_TOKEN for GitHub Packages
bun run typecheck
bun run test
```

Published to GitHub Packages by `.github/workflows/publish.yml` on a `v*` tag.
