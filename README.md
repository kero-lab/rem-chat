# @kero-lab/rem-chat

Rem chat engine + display pieces shared by RemHub and KeroHub.

Published to GitHub Packages on a `v*` tag. Consumers need `@kero-lab:registry=https://npm.pkg.github.com` in `.npmrc`.

```css
@import "tailwindcss";
@import "@kero-lab/rem-chat/styles.css";
```

The `--rem`, `--rem-soft` and `--rem-faint` tokens are defined by the consuming app.

## Development

```bash
bun install   # needs NPM_TOKEN for @kero-lab/* packages
bun run typecheck
bun run test
```
