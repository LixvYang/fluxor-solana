import { PRECISION } from "../domain/constants";
import type { ArticleDetail, PurchaseReceipt, ReaderRewardView } from "../domain/types";

export function getReaderRewardView(
  article: ArticleDetail,
  receipt: PurchaseReceipt | null,
): ReaderRewardView {
  if (!receipt) {
    return {
      readerRank: null,
      claimedRewardsLamports: 0n,
      claimableLamports: 0n,
      totalReceivedLamports: 0n,
    };
  }

  const pendingScaled = article.accRewardPerReader - receipt.rewardDebt;
  const claimableLamports = pendingScaled > 0n ? pendingScaled / PRECISION : 0n;

  return {
    readerRank: receipt.readerRank,
    claimedRewardsLamports: receipt.claimedRewardsLamports,
    claimableLamports,
    totalReceivedLamports: receipt.claimedRewardsLamports + claimableLamports,
  };
}
