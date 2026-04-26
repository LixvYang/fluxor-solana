import {
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  FilePenLine,
  LockKeyhole,
  PlugZap,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CLUSTER_LABEL,
  DEFAULT_PER_RPC_URL,
  DEFAULT_SOLANA_RPC_URL,
} from "./domain/constants";
import type { ArticleDetail, PurchaseReceipt } from "./domain/types";
import { useWallet } from "./hooks/useWallet";
import { formatAddress, formatPercent, formatSol } from "./lib/format";
import { renderMarkdown } from "./lib/markdown";
import { createFluxorClient } from "./lib/fluxorClient";
import { getReaderRewardView } from "./lib/rewards";

type Locale = "en" | "zh";

const MAX_TITLE_BYTES = 96;
const MAX_SUMMARY_BYTES = 280;
const MAX_CONTENT_BYTES = 32 * 1024;
const MAX_PURCHASES_LIMIT = 100;

const copy = {
  en: {
    tagline: "paid Markdown on Solana + MagicBlock PER",
    connect: "Connect",
    connecting: "Connecting",
    articles: "Articles",
    write: "Write",
    title: "Title",
    summary: "Summary",
    priceSol: "Price SOL",
    max: "Max buyers",
    markdown: "Markdown",
    publish: "Publish",
    publishing: "Publishing",
    connectToWrite: "Connect to write",
    backToArticles: "Back to articles",
    connectToBuy: "Connect to buy",
    readPrivateMarkdown: "Read private Markdown",
    publishingIncomplete: "Publishing incomplete",
    buying: "Buying",
    soldOut: "Sold out",
    buyArticle: "Buy article",
    granting: "Granting",
    continuePerGrant: "Continue PER grant",
    markdownLoaded: "Markdown loaded",
    finalizing: "Finalizing",
    repairing: "Repairing",
    finalizePublishing: "Finalize publishing",
    resumePublish: "Resume publish",
    claimReaderReward: "Claim reader reward",
    claimingReader: "Claiming reader",
    claimAuthorRevenue: "Claim author revenue",
    claimingAuthor: "Claiming author",
    claimPlatformFee: "Claim platform fee",
    claimingFees: "Claiming fees",
    readerRank: "Reader rank",
    notPurchased: "Not purchased",
    claimable: "Your claimable",
    totalReceived: "Your received",
    notReader: "Not a reader",
    authorPending: "Author pending",
    price: "Price",
    sold: "sold",
    privateGateTitle: "Private content is gated by PER permission.",
    privateGateBody:
      "After purchase, the app will refetch the receipt, request a MagicBlock auth token, fetch `ArticlePrivateContent`, decode UTF-8 bytes, and render Markdown here.",
    articlePublished: (id: string) => `Article #${id} published.`,
    articleNowPublished: (id: string) => `Article #${id} is now published.`,
    purchasePendingGrant:
      "Purchase confirmed. PER grant is pending and can be retried.",
    perAccessGranted: "PER access granted.",
    readerRewardClaimed: "Reader reward claimed.",
    authorRevenueClaimed: "Author revenue claimed.",
    platformFeeClaimed: "Platform fee claimed.",
    publishingArticle: "Publishing article...",
    finalizingArticle: "Finalizing article...",
    bytesUsed: (used: string, max: string) => `${used}/${max} bytes`,
    maxBuyersHint: (max: string) => `1-${max} buyers`,
    contentLimitHint: "32KB total, reserved on-chain in several transactions",
    settings: "Settings",
    solanaRpc: "Solana RPC",
    perRpc: "MagicBlock PER RPC",
    resetRpc: "Reset RPC",
  },
  zh: {
    tagline: "Solana + MagicBlock PER 付费 Markdown",
    connect: "连接钱包",
    connecting: "连接中",
    articles: "文章",
    write: "写文章",
    title: "标题",
    summary: "摘要",
    priceSol: "价格 SOL",
    max: "最大购买人数",
    markdown: "正文 Markdown",
    publish: "发布",
    publishing: "发布中",
    connectToWrite: "连接后写文章",
    backToArticles: "返回文章",
    connectToBuy: "连接后购买",
    readPrivateMarkdown: "阅读私有正文",
    publishingIncomplete: "发布未完成",
    buying: "购买中",
    soldOut: "已售罄",
    buyArticle: "购买文章",
    granting: "授权中",
    continuePerGrant: "继续 PER 授权",
    markdownLoaded: "正文已加载",
    finalizing: "完成发布中",
    repairing: "恢复中",
    finalizePublishing: "完成发布",
    resumePublish: "继续发布",
    claimReaderReward: "提取读者奖励",
    claimingReader: "提取读者奖励中",
    claimAuthorRevenue: "提取作者收益",
    claimingAuthor: "提取作者收益中",
    claimPlatformFee: "提取平台费用",
    claimingFees: "提取平台费用中",
    readerRank: "读者排名",
    notPurchased: "未购买",
    claimable: "你的可提取",
    totalReceived: "你的累计获得",
    notReader: "非读者",
    authorPending: "作者待提取",
    price: "价格",
    sold: "已售",
    privateGateTitle: "私有正文受 PER 权限保护。",
    privateGateBody:
      "购买后，前端会刷新购买凭证，获取 MagicBlock auth token，读取 `ArticlePrivateContent`，解码 UTF-8 字节并在这里渲染 Markdown。",
    articlePublished: (id: string) => `文章 #${id} 已发布。`,
    articleNowPublished: (id: string) => `文章 #${id} 已完成发布。`,
    purchasePendingGrant: "购买已确认，PER 授权未完成，可以重试。",
    perAccessGranted: "PER 访问权限已授予。",
    readerRewardClaimed: "读者奖励已提取。",
    authorRevenueClaimed: "作者收益已提取。",
    platformFeeClaimed: "平台费用已提取。",
    publishingArticle: "正在发布文章...",
    finalizingArticle: "正在完成发布...",
    bytesUsed: (used: string, max: string) => `${used}/${max} 字节`,
    maxBuyersHint: (max: string) => `1-${max} 人`,
    contentLimitHint: "总上限 32KB，链上会分多笔交易预留空间",
    settings: "设置",
    solanaRpc: "Solana RPC",
    perRpc: "MagicBlock PER RPC",
    resetRpc: "重置 RPC",
  },
};

export function App() {
  const wallet = useWallet();
  const [locale, setLocale] = useState<Locale>("en");
  const t = copy[locale];
  const [rpcConfig, setRpcConfig] = useState(() => loadRpcConfig());
  const client = useMemo(
    () => createFluxorClient(wallet.browserWallet, rpcConfig),
    [wallet.address, wallet.browserWallet, rpcConfig]
  );
  const [articles, setArticles] = useState<ArticleDetail[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"articles" | "write">("articles");
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    summary: "",
    priceSol: "0.001",
    maxPurchases: "10",
    markdown: "# Untitled\n\nStart writing here.",
  });

  useEffect(() => {
    client
      .listArticles()
      .then((nextArticles) => {
        setArticles(nextArticles);
        if (nextArticles[0])
          setSelectedArticleId((current) => current || nextArticles[0].id);
      })
      .catch((error) =>
        setReaderError(
          error instanceof Error ? error.message : "Unable to load articles."
        )
      );
  }, [client]);

  const selectedArticle = useMemo(
    () =>
      articles.find((article) => article.id === selectedArticleId) ??
      articles[0],
    [articles, selectedArticleId]
  );

  useEffect(() => {
    setMarkdown(null);
    setReaderError(null);
    setNotice(null);
    if (!selectedArticle) return;
    client
      .getPurchaseReceipt(selectedArticle.id, wallet.address)
      .then(setReceipt);
  }, [selectedArticle, wallet.address]);

  const rewardView = selectedArticle
    ? getReaderRewardView(selectedArticle, receipt)
    : null;
  const articleHtml = markdown ? renderMarkdown(markdown) : null;
  const titleBytes = byteLength(draft.title);
  const summaryBytes = byteLength(draft.summary);
  const markdownBytes = byteLength(draft.markdown);
  const maxPurchasesValue = Number(draft.maxPurchases);
  const isMaxPurchasesValid =
    Number.isInteger(maxPurchasesValue) &&
    maxPurchasesValue > 0 &&
    maxPurchasesValue <= MAX_PURCHASES_LIMIT;

  async function handleBuy() {
    if (!selectedArticle || !wallet.address) return;
    setIsPurchasing(true);
    setReaderError(null);
    setNotice(null);
    try {
      const nextReceipt = await client.buyArticle(
        selectedArticle.id,
        wallet.address
      );
      setReceipt(nextReceipt);
      setArticles(await client.listArticles());
      if (!nextReceipt.accessGranted) {
        setNotice(t.purchasePendingGrant);
      }
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Purchase failed."
      );
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleGrantAccess() {
    if (!selectedArticle || !wallet.address) return;
    setIsGranting(true);
    setReaderError(null);
    setNotice(null);
    try {
      setReceipt(await client.grantAccess(selectedArticle.id, wallet.address));
      setNotice(t.perAccessGranted);
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Unable to grant PER access."
      );
    } finally {
      setIsGranting(false);
    }
  }

  async function handleRead() {
    if (!selectedArticle || !wallet.address) return;
    setReaderError(null);
    setNotice(null);
    try {
      setMarkdown(
        await client.readPrivateMarkdown(selectedArticle.id, wallet.address)
      );
    } catch (error) {
      setReaderError(
        error instanceof Error
          ? error.message
          : "Unable to read private content."
      );
    }
  }

  async function refreshSelectedReceipt() {
    if (!selectedArticle || !wallet.address) return;
    setReceipt(
      await client.getPurchaseReceipt(selectedArticle.id, wallet.address)
    );
  }

  async function handleClaimReader() {
    if (!selectedArticle || !wallet.address) return;
    setIsClaiming("reader");
    setReaderError(null);
    setNotice(null);
    try {
      setReceipt(
        await client.claimReaderReward(selectedArticle.id, wallet.address)
      );
      setArticles(await client.listArticles());
      setNotice(t.readerRewardClaimed);
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Reader reward claim failed."
      );
    } finally {
      setIsClaiming(null);
    }
  }

  async function handleClaimAuthor() {
    if (!selectedArticle) return;
    setIsClaiming("author");
    setReaderError(null);
    setNotice(null);
    try {
      await client.claimAuthorRevenue(selectedArticle.id);
      setArticles(await client.listArticles());
      await refreshSelectedReceipt();
      setNotice(t.authorRevenueClaimed);
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Author revenue claim failed."
      );
    } finally {
      setIsClaiming(null);
    }
  }

  async function handleClaimPlatform() {
    if (!selectedArticle) return;
    setIsClaiming("platform");
    setReaderError(null);
    setNotice(null);
    try {
      await client.claimPlatformFee(selectedArticle.id);
      setArticles(await client.listArticles());
      await refreshSelectedReceipt();
      setNotice(t.platformFeeClaimed);
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Platform fee claim failed."
      );
    } finally {
      setIsClaiming(null);
    }
  }

  async function handlePublishArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPublishing(true);
    setReaderError(null);
    setNotice(t.publishingArticle);
    try {
      const created = await client.createAndPublishArticle({
        title: draft.title,
        summary: draft.summary,
        priceLamports: parseSolToLamports(draft.priceSol),
        maxPurchases: Number(draft.maxPurchases),
        markdown: draft.markdown,
      });
      const nextArticles = await client.listArticles();
      setArticles(nextArticles);
      setSelectedArticleId(created.id);
      setView("articles");
      setDraft({
        title: "",
        summary: "",
        priceSol: "0.001",
        maxPurchases: "10",
        markdown: "# Untitled\n\nStart writing here.",
      });
      setNotice(t.articlePublished(created.id));
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Article publishing failed."
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleFinalizeDraft() {
    if (!selectedArticle) return;
    setIsFinalizing(true);
    setReaderError(null);
    setNotice(t.finalizingArticle);
    try {
      const finalized = await client.finalizeDraftArticle(
        selectedArticle.id,
        draft.markdown
      );
      const nextArticles = await client.listArticles();
      setArticles(nextArticles);
      setSelectedArticleId(finalized.id);
      setNotice(t.articleNowPublished(finalized.id));
    } catch (error) {
      setReaderError(
        error instanceof Error ? error.message : "Article finalize failed."
      );
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <main className="shell">
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <strong>Fluxor</strong>
            <span>{t.tagline}</span>
          </div>
        </div>

        <div className="network-strip" aria-label="RPC configuration">
          <span>{DEFAULT_CLUSTER_LABEL}</span>
          <span>{rpcConfig.solanaRpcUrl}</span>
          <span>PER {rpcConfig.perRpcUrl}</span>
        </div>

        <button
          className="wallet-button"
          onClick={wallet.address ? wallet.disconnect : wallet.connect}
          disabled={wallet.isConnecting}
        >
          <Wallet size={18} />
          {wallet.address
            ? formatAddress(wallet.address)
            : wallet.isConnecting
            ? t.connecting
            : t.connect}
        </button>

        <button
          className="wallet-button"
          onClick={() =>
            setLocale((current) => (current === "en" ? "zh" : "en"))
          }
        >
          {locale === "en" ? "中文" : "EN"}
        </button>

        <button
          className="wallet-button"
          onClick={() => setShowSettings((current) => !current)}
        >
          {t.settings}
        </button>
      </nav>

      {showSettings ? (
        <section className="settings-panel">
          <label>
            <span>{t.solanaRpc}</span>
            <input
              value={rpcConfig.solanaRpcUrl}
              onChange={(event) =>
                setRpcConfig((current: ReturnType<typeof defaultRpcConfig>) =>
                  saveRpcConfig({
                    ...current,
                    solanaRpcUrl: event.target.value.trim(),
                  })
                )
              }
            />
          </label>
          <label>
            <span>{t.perRpc}</span>
            <input
              value={rpcConfig.perRpcUrl}
              onChange={(event) =>
                setRpcConfig((current: ReturnType<typeof defaultRpcConfig>) =>
                  saveRpcConfig({
                    ...current,
                    perRpcUrl: event.target.value.trim(),
                  })
                )
              }
            />
          </label>
          <button
            className="secondary-action"
            onClick={() => setRpcConfig(saveRpcConfig(defaultRpcConfig()))}
          >
            {t.resetRpc}
          </button>
        </section>
      ) : null}

      <div className="view-switch">
        <button
          className={view === "articles" ? "active" : ""}
          onClick={() => setView("articles")}
        >
          <BookOpen size={18} />
          {t.articles}
        </button>
        <button
          className={view === "write" ? "active" : ""}
          onClick={() => setView("write")}
        >
          <FilePlus2 size={18} />
          {t.write}
        </button>
      </div>

      {view === "write" ? (
        <section className="write-screen">
          <form className="writer-panel" onSubmit={handlePublishArticle}>
            <div className="section-title">
              <FilePlus2 size={18} />
              <span>{t.write}</span>
            </div>
            <label>
              <span>
                {t.title} ·{" "}
                {t.bytesUsed(String(titleBytes), String(MAX_TITLE_BYTES))}
              </span>
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>
                {t.summary} ·{" "}
                {t.bytesUsed(String(summaryBytes), String(MAX_SUMMARY_BYTES))}
              </span>
              <textarea
                value={draft.summary}
                rows={3}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
              />
            </label>
            <div className="writer-row">
              <label>
                <span>{t.priceSol}</span>
                <input
                  inputMode="decimal"
                  value={draft.priceSol}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      priceSol: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>
                  {t.max} · {t.maxBuyersHint(String(MAX_PURCHASES_LIMIT))}
                </span>
                <input
                  inputMode="numeric"
                  value={draft.maxPurchases}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxPurchases: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              <span>
                {t.markdown} ·{" "}
                {t.bytesUsed(String(markdownBytes), String(MAX_CONTENT_BYTES))}
              </span>
              <small className="field-hint">{t.contentLimitHint}</small>
              <textarea
                className="markdown-editor"
                value={draft.markdown}
                rows={18}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    markdown: event.target.value,
                  }))
                }
              />
            </label>
            <div className="action-bar">
              {wallet.address ? (
                <button
                  className="primary-action"
                  disabled={
                    isPublishing ||
                    titleBytes > MAX_TITLE_BYTES ||
                    summaryBytes > MAX_SUMMARY_BYTES ||
                    markdownBytes > MAX_CONTENT_BYTES ||
                    !isMaxPurchasesValid
                  }
                >
                  <FilePenLine size={18} />
                  {isPublishing ? t.publishing : t.publish}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-action"
                  onClick={wallet.connect}
                >
                  <Wallet size={18} />
                  {t.connectToWrite}
                </button>
              )}
              <button
                type="button"
                className="secondary-action"
                onClick={() => setView("articles")}
              >
                {t.backToArticles}
              </button>
            </div>
            {wallet.error || readerError ? (
              <p className="error-text">{wallet.error ?? readerError}</p>
            ) : null}
            {notice ? <p className="notice-text">{notice}</p> : null}
          </form>
        </section>
      ) : (
        <section className="workspace">
          <aside className="article-list" aria-label="Articles">
            <div className="section-title">
              <BookOpen size={18} />
              <span>{t.articles}</span>
            </div>
            {articles.map((article) => (
              <button
                className={`article-row ${
                  article.id === selectedArticle?.id ? "active" : ""
                }`}
                key={article.id}
                onClick={() => setSelectedArticleId(article.id)}
              >
                <span className={`status-dot ${article.status}`} />
                <strong>{article.title}</strong>
                <small>
                  {formatSol(article.priceLamports)} · {article.purchaseCount}/
                  {article.maxPurchases}
                </small>
              </button>
            ))}
          </aside>

          {selectedArticle && rewardView ? (
            <section className="detail">
              <header className="article-header">
                <div>
                  <p className="eyebrow">
                    Article #{selectedArticle.id} ·{" "}
                    {selectedArticle.status.replace("_", " ")}
                  </p>
                  <h1>{selectedArticle.title}</h1>
                  <p>{selectedArticle.preview}</p>
                </div>
                <div className="price-panel">
                  <span>{t.price}</span>
                  <strong>{formatSol(selectedArticle.priceLamports)}</strong>
                  <small>
                    {formatPercent(
                      selectedArticle.purchaseCount,
                      selectedArticle.maxPurchases
                    )}{" "}
                    {t.sold}
                  </small>
                </div>
              </header>

              <div className="stats-grid">
                {wallet.address !== selectedArticle.author ? (
                  <>
                    <Metric
                      icon={<ReceiptText size={18} />}
                      label={t.readerRank as string}
                      value={
                        rewardView.readerRank
                          ? `#${rewardView.readerRank}`
                          : (t.notPurchased as string)
                      }
                    />
                    <Metric
                      icon={<CircleDollarSign size={18} />}
                      label={t.claimable as string}
                      value={
                        receipt
                          ? formatSol(rewardView.claimableLamports)
                          : (t.notReader as string)
                      }
                    />
                    <Metric
                      icon={<CheckCircle2 size={18} />}
                      label={t.totalReceived as string}
                      value={
                        receipt
                          ? formatSol(rewardView.totalReceivedLamports)
                          : (t.notReader as string)
                      }
                    />
                  </>
                ) : null}
                <Metric
                  icon={<FilePenLine size={18} />}
                  label={t.authorPending as string}
                  value={formatSol(selectedArticle.authorPendingLamports)}
                />
              </div>

              <div className="action-bar">
                {!wallet.address ? (
                  <button className="primary-action" onClick={wallet.connect}>
                    <Wallet size={18} />
                    {t.connectToBuy}
                  </button>
                ) : articleHtml ? (
                  <span className="loaded-pill">
                    <CheckCircle2 size={18} />
                    {t.markdownLoaded}
                  </span>
                ) : wallet.address === selectedArticle.author ? (
                  <button
                    className="primary-action"
                    onClick={handleRead}
                    disabled={selectedArticle.status !== "published"}
                  >
                    <LockKeyhole size={18} />
                    {selectedArticle.status === "published"
                      ? t.readPrivateMarkdown
                      : t.publishingIncomplete}
                  </button>
                ) : receipt ? (
                  receipt.accessGranted ? (
                    <button className="primary-action" onClick={handleRead}>
                      <LockKeyhole size={18} />
                      {t.readPrivateMarkdown}
                    </button>
                  ) : (
                    <button
                      className="primary-action"
                      onClick={handleGrantAccess}
                      disabled={isGranting}
                    >
                      <PlugZap size={18} />
                      {isGranting ? t.granting : t.continuePerGrant}
                    </button>
                  )
                ) : (
                  <button
                    className="primary-action"
                    onClick={handleBuy}
                    disabled={
                      isPurchasing || selectedArticle.status !== "published"
                    }
                  >
                    <PlugZap size={18} />
                    {isPurchasing
                      ? t.buying
                      : selectedArticle.status === "sold_out"
                      ? t.soldOut
                      : selectedArticle.status === "draft"
                      ? t.publishingIncomplete
                      : t.buyArticle}
                  </button>
                )}
                {wallet.address === selectedArticle.author &&
                selectedArticle.status === "draft" ? (
                  <button
                    className="secondary-action"
                    onClick={handleFinalizeDraft}
                    disabled={isFinalizing}
                  >
                    {isFinalizing ? t.repairing : t.resumePublish}
                  </button>
                ) : null}
                {wallet.address && receipt?.buyer === wallet.address ? (
                  <button
                    className="secondary-action"
                    onClick={handleClaimReader}
                    disabled={
                      rewardView.claimableLamports === 0n || isClaiming !== null
                    }
                  >
                    {isClaiming === "reader"
                      ? t.claimingReader
                      : t.claimReaderReward}
                  </button>
                ) : null}
                {wallet.address === selectedArticle.author ? (
                  <button
                    className="secondary-action"
                    onClick={handleClaimAuthor}
                    disabled={
                      selectedArticle.authorPendingLamports === 0n ||
                      isClaiming !== null
                    }
                  >
                    {isClaiming === "author"
                      ? t.claimingAuthor
                      : t.claimAuthorRevenue}
                  </button>
                ) : null}
                {wallet.address === selectedArticle.platformAdmin ? (
                  <button
                    className="secondary-action"
                    onClick={handleClaimPlatform}
                    disabled={
                      selectedArticle.platformPendingLamports === 0n ||
                      isClaiming !== null
                    }
                  >
                    {isClaiming === "platform"
                      ? t.claimingFees
                      : t.claimPlatformFee}
                  </button>
                ) : null}
              </div>

              {wallet.error || readerError ? (
                <p className="error-text">{wallet.error ?? readerError}</p>
              ) : null}
              {notice ? <p className="notice-text">{notice}</p> : null}

              <section className="reader">
                {articleHtml ? (
                  <article
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: articleHtml }}
                  />
                ) : (
                  <div className="locked-state">
                    <LockKeyhole size={32} />
                    <div>
                      <strong>{t.privateGateTitle}</strong>
                      <span>{t.privateGateBody}</span>
                    </div>
                  </div>
                )}
              </section>
            </section>
          ) : null}
        </section>
      )}
    </main>
  );
}

function parseSolToLamports(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) {
    throw new Error("Price must be a SOL amount with up to 9 decimals.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function defaultRpcConfig() {
  return {
    solanaRpcUrl: DEFAULT_SOLANA_RPC_URL,
    perRpcUrl: DEFAULT_PER_RPC_URL,
  };
}

function loadRpcConfig() {
  try {
    const stored = localStorage.getItem("fluxor.rpcConfig");
    if (!stored) return defaultRpcConfig();
    return { ...defaultRpcConfig(), ...JSON.parse(stored) };
  } catch {
    return defaultRpcConfig();
  }
}

function saveRpcConfig(config: ReturnType<typeof defaultRpcConfig>) {
  localStorage.setItem("fluxor.rpcConfig", JSON.stringify(config));
  return config;
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
