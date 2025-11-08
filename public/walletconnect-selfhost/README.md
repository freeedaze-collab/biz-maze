# WalletConnect Self-Hosted Thin Loaders

Place the contents of this zip under your app's `public/` directory.

```
public/
  walletconnect/
    provider/
      index.umd.min.js
    modal/
      index.umd.min.js
      style.css
```

Then reference them in `index.html` (or your HTML template):

```html
<link rel="stylesheet" href="/walletconnect/modal/style.css" />
<script src="/walletconnect/modal/index.umd.min.js" defer></script>
<script src="/walletconnect/provider/index.umd.min.js" defer></script>
```

These loaders fetch the official UMD bundles from CDNs (jsDelivr → UNPKG fallback) and
expose the expected globals:
- `window.EthereumProvider` from `@walletconnect/ethereum-provider`
- `window.WalletConnectModal` from `@walletconnect/modal`
