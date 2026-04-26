# Fluxor Frontend Notes

## Scope

This frontend is an MVP scaffold for the pure frontend dApp described in the root `docs.md`.

The contract and MagicBlock PER integration are not treated as complete yet, so the app currently uses a mock `FluxorClient` with the same UI-facing shapes the real client should expose.

## Stack

- Vite
- React
- TypeScript
- CSS modules are not required yet; global CSS is kept in `src/styles.css`
- `lucide-react` for icons
- `marked` for Markdown rendering

The app lives in `apps/web`.

## Commands

From the repository root:

```bash
npm run web:dev
npm run web:build
npm run web:preview
```

Or directly:

```bash
npm --prefix apps/web run dev
```

## Current Architecture

```text
App
  -> useWallet
  -> FluxorClient interface
      -> mock implementation today
      -> Solana/MagicBlock implementation later
```

Important files:

```text
src/domain/types.ts       UI-facing account and reward types
src/lib/fluxorClient.ts    frontend client interface and mock implementation
src/lib/rewards.ts        claimable reward calculation
src/lib/wallet.ts         temporary browser wallet boundary
src/App.tsx               article list, purchase, reader, reward UI
```

## Real Client Integration Plan

Replace `createMockFluxorClient()` with a real client that:

1. Fetches article index pages from Solana/PER RPC.
2. Fetches `Article` accounts by PDA.
3. Derives `PurchaseReceipt` PDA from `["receipt", article, wallet]`.
4. Checks whether the current wallet has purchased the article.
5. Builds and sends `buy_article`.
6. Refetches `PurchaseReceipt`.
7. Gets a MagicBlock auth token using wallet signature.
8. Fetches `ArticlePrivateContent` through PER.
9. Decodes Markdown bytes with `TextDecoder`.
10. Renders Markdown in the reader.

The frontend should not introduce a business backend, database, indexer, Arweave, IPFS, S3, R2, or custom content server for MVP content storage.

## Reward Display

The UI follows the latest root `docs.md` direction using per-reader `PurchaseReceipt` accounts rather than a frontend `ReaderList` dependency.

Claimable rewards are computed as:

```text
claimable = (article.acc_reward_per_reader - receipt.reward_debt) / PRECISION
```

Total received is:

```text
total_received = receipt.claimed_rewards + claimable
```

`PRECISION` is `1_000_000_000_000`.

## Wallet Boundary

`src/lib/wallet.ts` currently uses a minimal injected `window.solana` adapter so the UI can be developed before the final wallet package is chosen.

Before production, replace this with a Wallet Standard based connector and keep Solana-specific transaction signing behind a small adapter module.

## PER Boundary

Private Markdown must only be fetched after purchase and permission grant.

The production reader flow should be:

```text
purchase or existing receipt
  -> request wallet signature for MagicBlock auth
  -> fetch ArticlePrivateContent through PER
  -> verify content_hash and content_len
  -> TextDecoder.decode(markdown bytes)
  -> render Markdown
```

Do not commit private Markdown content to public Solana state unless the product architecture explicitly changes.
