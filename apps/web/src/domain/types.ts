export type Lamports = bigint;

export type ArticleStatus = "draft" | "published" | "sold_out";

export type ArticleSummary = {
  id: string;
  account?: string;
  title: string;
  preview: string;
  author: string;
  priceLamports: Lamports;
  maxPurchases: number;
  purchaseCount: number;
  contentHash: string;
  publishedAt: string;
  status: ArticleStatus;
};

export type ArticleDetail = ArticleSummary & {
  platformAdmin: string;
  platformFeeReceiver: string;
  markdownPreview: string;
  privateContentAccount: string;
  permissionAccount: string;
  accRewardPerReader: bigint;
  authorPendingLamports: Lamports;
  authorClaimedLamports: Lamports;
  platformPendingLamports: Lamports;
};

export type PurchaseReceipt = {
  articleId: string;
  buyer: string;
  readerRank: number;
  rewardDebt: bigint;
  claimedRewardsLamports: Lamports;
  accessGranted: boolean;
};

export type ReaderRewardView = {
  readerRank: number | null;
  claimedRewardsLamports: Lamports;
  claimableLamports: Lamports;
  totalReceivedLamports: Lamports;
};
