
# Demo Wallet · Smart Signing Tags

A tiny React + Vite demo that classifies signing requests (PAYMENT / APPROVAL / LOGIN / SWAP / STAKE / DATA) and shows a bold tag in a confirmation modal. Works with MetaMask if installed; otherwise runs in mock mode.

## Local dev
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this folder to a GitHub repository
2. Import the repo on https://vercel.com/new
3. Build command: `npm run build`
4. Output directory: `dist`
5. Click Deploy

## Notes
- Use testnets when trying on-chain actions.
- For production, integrate an ABI decoder (viem/ethers) and risk checks.
