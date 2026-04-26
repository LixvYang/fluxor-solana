import { LAMPORTS_PER_SOL, PRECISION } from "../domain/constants";
import type { ArticleDetail, PurchaseReceipt } from "../domain/types";

export const MOCK_WALLET = "8uQillDemoReader11111111111111111111111111";

export const mockArticles: ArticleDetail[] = [
  {
    id: "1",
    title: "Private Rollups for Public Writing",
    preview:
      "A technical essay about keeping paid Markdown private while settlement remains transparent.",
    author: "4uthorJv4VxQ6xDm2bP7L3E3f9jG1h2sK9uP9eQ1L",
    priceLamports: LAMPORTS_PER_SOL / 5n,
    maxPurchases: 100,
    purchaseCount: 17,
    contentHash:
      "7bf9c7f7b5d54d96f1e4323e0c2fd876a29f1e36ff34c6d1fb67913a0d2c89aa",
    publishedAt: "2026-04-20",
    status: "published",
    platformAdmin: MOCK_WALLET,
    platformFeeReceiver: MOCK_WALLET,
    markdownPreview:
      "# Private Rollups for Public Writing\n\nFluxor stores the full article body as Markdown bytes inside a MagicBlock PER permissioned account.\n\nThe public program keeps purchase, vault, and reward state verifiable without publishing the full text.",
    privateContentAccount: "ContentPda11111111111111111111111111111111",
    permissionAccount: "PermAcct111111111111111111111111111111111",
    accRewardPerReader: 2_400_000n * PRECISION,
    authorPendingLamports: LAMPORTS_PER_SOL * 2n,
    authorClaimedLamports: LAMPORTS_PER_SOL,
    platformPendingLamports: LAMPORTS_PER_SOL / 2n,
  },
  {
    id: "2",
    title: "The Reader Dividend",
    preview:
      "How early readers become distribution partners through deterministic reward accounting.",
    author: "E4rlyAuthoR11111111111111111111111111111",
    priceLamports: LAMPORTS_PER_SOL / 10n,
    maxPurchases: 80,
    purchaseCount: 5,
    contentHash:
      "b25f04cf6d8b8ae22ab35fe8ff8d729f77c443026810937e77fd723c832fd3ee",
    publishedAt: "2026-04-22",
    status: "published",
    platformAdmin: MOCK_WALLET,
    platformFeeReceiver: MOCK_WALLET,
    markdownPreview:
      "# The Reader Dividend\n\nEvery purchase after the first shares a reward pool with earlier readers.\n\nThe UI can compute claimable rewards directly from `acc_reward_per_reader` and the reader's receipt debt.",
    privateContentAccount: "ContentPda22222222222222222222222222222222",
    permissionAccount: "PermAcct222222222222222222222222222222222",
    accRewardPerReader: 800_000n * PRECISION,
    authorPendingLamports: LAMPORTS_PER_SOL / 2n,
    authorClaimedLamports: 0n,
    platformPendingLamports: LAMPORTS_PER_SOL / 20n,
  },
  {
    id: "3",
    title: "Publishing Without a Backend",
    preview:
      "A draft-oriented checklist for writing, chunking, hashing, and publishing Markdown from the browser.",
    author: "NoServerAuth111111111111111111111111111",
    priceLamports: LAMPORTS_PER_SOL / 4n,
    maxPurchases: 60,
    purchaseCount: 60,
    contentHash:
      "e58aa3fd01fa6d6995c95bc782e5cf766e27440f3fe7d701a65f7ff6429ba171",
    publishedAt: "2026-04-23",
    status: "sold_out",
    platformAdmin: MOCK_WALLET,
    platformFeeReceiver: MOCK_WALLET,
    markdownPreview:
      "# Publishing Without a Backend\n\nThe browser owns the whole authoring flow: hash Markdown, create accounts, write chunks, publish content, then let readers unlock through PER.",
    privateContentAccount: "ContentPda33333333333333333333333333333333",
    permissionAccount: "PermAcct333333333333333333333333333333333",
    accRewardPerReader: 5_100_000n * PRECISION,
    authorPendingLamports: LAMPORTS_PER_SOL * 4n,
    authorClaimedLamports: LAMPORTS_PER_SOL * 3n,
    platformPendingLamports: LAMPORTS_PER_SOL,
  },
];

export const mockReceipts: Record<string, PurchaseReceipt> = {
  "1": {
    articleId: "1",
    buyer: MOCK_WALLET,
    readerRank: 4,
    rewardDebt: 1_500_000n * PRECISION,
    claimedRewardsLamports: 200_000n,
    accessGranted: true,
  },
};
