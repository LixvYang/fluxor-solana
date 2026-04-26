import * as anchor from "@coral-xyz/anchor";
import {
  createDelegatePermissionInstruction,
  getAuthToken,
  permissionPdaFromAccount,
  waitUntilPermissionActive,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import idl from "../idl/fluxor_solana.json";
import { MOCK_WALLET, mockArticles, mockReceipts } from "../data/mockArticles";
import {
  DEFAULT_PER_RPC_URL,
  DEFAULT_SOLANA_RPC_URL,
} from "../domain/constants";
import type {
  ArticleDetail,
  ArticleStatus,
  PurchaseReceipt,
} from "../domain/types";
import type { BrowserWallet } from "./wallet";

const PROGRAM_ID = new PublicKey(
  "DGABGfY3Jjp45DVAwzVPDBjdRVGF1LSYNmsrqjiNbX4H"
);
const PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
);
const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
const TEE_DEVNET_VALIDATOR = new PublicKey(
  "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"
);
const BufferCtor = (globalThis as any).Buffer;

const GLOBAL_CONFIG_SEED = BufferCtor.from("global_config");
const ARTICLE_SEED = BufferCtor.from("article");
const VAULT_SEED = BufferCtor.from("vault");
const CONTENT_SEED = BufferCtor.from("content");
const RECEIPT_SEED = BufferCtor.from("receipt");
const BUFFER_SEED = BufferCtor.from("buffer");
const DELEGATION_RECORD_SEED = BufferCtor.from("delegation");
const DELEGATION_METADATA_SEED = BufferCtor.from("delegation-metadata");
const MAX_CONTENT_CHUNK_BYTES = 900;
const MAX_REALLOC_INCREASE_BYTES = 9_000;

type AnchorProgram = any;
type AnchorAccount = Record<string, any>;

export type RpcConfig = {
  solanaRpcUrl: string;
  perRpcUrl: string;
};

export type CreateArticleInput = {
  title: string;
  summary: string;
  priceLamports: bigint;
  maxPurchases: number;
  markdown: string;
};

export type FluxorClient = {
  listArticles(): Promise<ArticleDetail[]>;
  getArticle(articleId: string): Promise<ArticleDetail | null>;
  getPurchaseReceipt(
    articleId: string,
    walletAddress: string | null
  ): Promise<PurchaseReceipt | null>;
  buyArticle(
    articleId: string,
    walletAddress: string
  ): Promise<PurchaseReceipt>;
  grantAccess(
    articleId: string,
    walletAddress: string
  ): Promise<PurchaseReceipt>;
  readPrivateMarkdown(
    articleId: string,
    walletAddress: string
  ): Promise<string>;
  claimReaderReward(
    articleId: string,
    walletAddress: string
  ): Promise<PurchaseReceipt | null>;
  claimAuthorRevenue(articleId: string): Promise<void>;
  claimPlatformFee(articleId: string): Promise<void>;
  createAndPublishArticle(input: CreateArticleInput): Promise<ArticleDetail>;
  finalizeDraftArticle(
    articleId: string,
    fallbackMarkdown?: string
  ): Promise<ArticleDetail>;
};

export function createFluxorClient(
  wallet: BrowserWallet | null,
  rpcConfig: RpcConfig = {
    solanaRpcUrl: DEFAULT_SOLANA_RPC_URL,
    perRpcUrl: DEFAULT_PER_RPC_URL,
  }
): FluxorClient {
  if (import.meta.env.VITE_FLUXOR_USE_MOCK === "1") {
    return createMockFluxorClient();
  }
  return new OnChainFluxorClient(wallet, rpcConfig);
}

class OnChainFluxorClient implements FluxorClient {
  private readonly baseConnection: Connection;

  constructor(
    private readonly wallet: BrowserWallet | null,
    private readonly rpcConfig: RpcConfig
  ) {
    this.baseConnection = new Connection(rpcConfig.solanaRpcUrl, "confirmed");
  }

  async listArticles() {
    const program = this.baseProgram();
    const [globalConfig] = globalConfigPda();
    const config = await program.account.globalConfig.fetch(globalConfig);
    const count = Number(config.articleCount);
    const start = Math.max(0, count - 50);
    const articles = await Promise.all(
      Array.from({ length: count - start }, (_, index) =>
        this.fetchArticleById(String(start + index), config)
      )
    );
    return articles
      .filter((article): article is ArticleDetail => Boolean(article))
      .reverse();
  }

  async getArticle(articleId: string) {
    const program = this.baseProgram();
    const [globalConfig] = globalConfigPda();
    const config = await program.account.globalConfig.fetch(globalConfig);
    return this.fetchArticleById(articleId, config);
  }

  async getPurchaseReceipt(articleId: string, walletAddress: string | null) {
    if (!walletAddress) return null;
    const program = this.baseProgram();
    const [article] = articlePda(articleId);
    const [receipt] = receiptPda(article, new PublicKey(walletAddress));
    try {
      const state = await program.account.purchaseReceipt.fetch(receipt);
      return mapReceipt(articleId, walletAddress, state);
    } catch (error) {
      if (isMissingAccountError(error)) return null;
      throw error;
    }
  }

  async buyArticle(articleId: string, walletAddress: string) {
    const wallet = this.requireWallet(walletAddress);
    const articleDetail = await this.requireArticle(articleId);
    if (articleDetail.status !== "published") {
      throw new Error(
        `Article #${articleId} is ${articleDetail.status}; it cannot be purchased until publishing is finalized.`
      );
    }
    const program = this.baseProgram(wallet);
    const [globalConfig] = globalConfigPda();
    const [article] = articlePda(articleId);
    const [vault] = vaultPda(article);
    const [receipt] = receiptPda(article, new PublicKey(walletAddress));
    const transaction = await program.methods
      .buyArticle()
      .accounts({
        globalConfig,
        buyer: new PublicKey(walletAddress),
        article,
        vault,
        receipt,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, transaction);

    try {
      return await this.grantAccess(articleId, walletAddress);
    } catch (error) {
      console.warn(
        "PER grant failed after purchase; user can retry grant_access.",
        error
      );
      const pendingReceipt = await this.getPurchaseReceipt(
        articleId,
        walletAddress
      );
      if (pendingReceipt) return pendingReceipt;
      throw error;
    }
  }

  async grantAccess(articleId: string, walletAddress: string) {
    const wallet = this.requireWallet(walletAddress);
    const articleDetail = await this.requireArticle(articleId);
    const buyer = new PublicKey(walletAddress);
    if (!articleDetail.account)
      throw new Error("Article account address is missing.");
    const article = new PublicKey(articleDetail.account);
    const privateContent = new PublicKey(articleDetail.privateContentAccount);
    const permission = new PublicKey(articleDetail.permissionAccount);
    const [receipt] = receiptPda(article, buyer);
    const perEndpoint = await this.authenticatedPerEndpoint(wallet, buyer);
    const perConnection = new Connection(perEndpoint, "confirmed");
    const perProgram = this.program(perConnection, wallet);
    const grantIx = await perProgram.methods
      .grantPerAccess()
      .accounts({
        buyer,
        article,
        privateContent,
        receipt,
        permission,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .instruction();
    await sendPerInstruction(perConnection, perEndpoint, wallet, grantIx);

    const baseProgram = this.baseProgram(wallet);
    const markTx = await baseProgram.methods
      .markAccessGranted()
      .accounts({
        buyer,
        article,
        receipt,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, markTx);
    const nextReceipt = await this.getPurchaseReceipt(articleId, walletAddress);
    if (!nextReceipt)
      throw new Error("Purchase receipt was not found after PER grant.");
    return nextReceipt;
  }

  async readPrivateMarkdown(articleId: string, walletAddress: string) {
    const wallet = this.requireWallet(walletAddress);
    const article = await this.requireArticle(articleId);
    const perEndpoint = await this.authenticatedPerEndpoint(
      wallet,
      new PublicKey(walletAddress)
    );
    const perProgram = this.program(
      new Connection(perEndpoint, "confirmed"),
      wallet
    );
    const state = await perProgram.account.articlePrivateContent.fetch(
      new PublicKey(article.privateContentAccount)
    );
    if (!state.published) {
      throw new Error(
        "Private content is not published on PER yet. The author must repair publishing with the original Markdown."
      );
    }
    const contentLen = Number(state.contentLen);
    if (contentLen <= 0) {
      throw new Error(
        "Private content is empty on PER. The author must repair publishing with the original Markdown."
      );
    }
    const bytes = Uint8Array.from(state.content).slice(0, contentLen);
    return new TextDecoder().decode(bytes);
  }

  async claimReaderReward(articleId: string, walletAddress: string) {
    const wallet = this.requireWallet(walletAddress);
    const program = this.baseProgram(wallet);
    const [article] = articlePda(articleId);
    const [vault] = vaultPda(article);
    const reader = new PublicKey(walletAddress);
    const [receipt] = receiptPda(article, reader);
    const transaction = await program.methods
      .claimReaderReward()
      .accounts({
        reader,
        article,
        vault,
        receipt,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, transaction);
    return this.getPurchaseReceipt(articleId, walletAddress);
  }

  async claimAuthorRevenue(articleId: string) {
    const wallet = this.requireWallet();
    const author = publicKeyFromWallet(wallet);
    const program = this.baseProgram(wallet);
    const [article] = articlePda(articleId);
    const [vault] = vaultPda(article);
    const transaction = await program.methods
      .claimAuthorRevenue()
      .accounts({
        author,
        article,
        vault,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, transaction);
  }

  async claimPlatformFee(articleId: string) {
    const wallet = this.requireWallet();
    const admin = publicKeyFromWallet(wallet);
    const program = this.baseProgram(wallet);
    const [globalConfig] = globalConfigPda();
    const config = await program.account.globalConfig.fetch(globalConfig);
    if (!admin.equals(config.admin)) {
      throw new Error(
        `Only platform admin ${config.admin.toBase58()} can claim platform fees.`
      );
    }
    const [article] = articlePda(articleId);
    const [vault] = vaultPda(article);
    const transaction = await program.methods
      .claimPlatformFee()
      .accounts({
        globalConfig,
        admin,
        platformFeeReceiver: config.platformFeeReceiver,
        article,
        vault,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, transaction);
  }

  async createAndPublishArticle(input: CreateArticleInput) {
    const wallet = this.requireWallet();
    const author = publicKeyFromWallet(wallet);
    if (input.title.trim().length === 0) throw new Error("Title is required.");
    if (input.summary.trim().length === 0)
      throw new Error("Summary is required.");
    if (input.markdown.trim().length === 0)
      throw new Error("Markdown content is required.");
    if (input.priceLamports <= 0n)
      throw new Error("Price must be greater than 0 lamports.");
    if (!Number.isInteger(input.maxPurchases) || input.maxPurchases <= 0)
      throw new Error("Max purchases must be greater than 0.");

    const program = this.baseProgram(wallet);
    const [globalConfig] = globalConfigPda();
    const config = await program.account.globalConfig.fetch(globalConfig);
    const articleId = new anchor.BN(config.articleCount);
    const [article] = articlePda(articleId.toString());
    const [vault] = vaultPda(article);
    const [privateContent] = privateContentPda(article);
    const permission = permissionPdaFromAccount(privateContent);
    const markdownBytes = new TextEncoder().encode(input.markdown);
    if (markdownBytes.length > 32 * 1024) {
      throw new Error("Markdown content must be 32KB or smaller.");
    }
    const contentHash = Array.from(await sha256(markdownBytes));

    const createTx = await program.methods
      .createArticle(
        articleId,
        input.title.trim(),
        input.summary.trim(),
        new anchor.BN(input.priceLamports.toString()),
        input.maxPurchases,
        permission,
        contentHash
      )
      .accounts({
        globalConfig,
        author,
        article,
        vault,
        privateContent,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, createTx);

    const createPermissionTx = await program.methods
      .createContentPermission()
      .accounts({
        author,
        article,
        privateContent,
        permission,
        permissionProgram: PERMISSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    await sendWalletTransaction(
      this.baseConnection,
      wallet,
      createPermissionTx
    );

    for (
      let capacity = Math.min(MAX_REALLOC_INCREASE_BYTES, markdownBytes.length);
      capacity <= markdownBytes.length;
      capacity = Math.min(
        capacity + MAX_REALLOC_INCREASE_BYTES,
        markdownBytes.length
      )
    ) {
      const reserveTx = await program.methods
        .reserveContentCapacity(capacity)
        .accounts({
          article,
          author,
          privateContent,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      await sendWalletTransaction(this.baseConnection, wallet, reserveTx);
      if (capacity === markdownBytes.length) break;
    }

    const delegatePermissionTx = new Transaction().add(
      createDelegatePermissionInstruction(
        {
          payer: author,
          authority: [author, true],
          permissionedAccount: [privateContent, false],
          ownerProgram: PERMISSION_PROGRAM_ID,
        },
        { validator: TEE_DEVNET_VALIDATOR }
      )
    );
    await sendWalletTransaction(
      this.baseConnection,
      wallet,
      delegatePermissionTx
    );

    const delegateAccounts = deriveContentDelegationAccounts(privateContent);
    const delegateContentTx = await program.methods
      .delegateContent(TEE_DEVNET_VALIDATOR)
      .accounts({
        author,
        article,
        privateContent,
        buffer: delegateAccounts.buffer,
        delegationRecord: delegateAccounts.delegationRecord,
        delegationMetadata: delegateAccounts.delegationMetadata,
        ownerProgram: PROGRAM_ID,
        delegationProgram: DELEGATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, delegateContentTx);

    const active = await waitUntilPermissionActive(
      this.rpcConfig.perRpcUrl,
      privateContent,
      60000
    );
    if (!active) {
      throw new Error("MagicBlock PER permission did not become active.");
    }

    const perEndpoint = await this.authenticatedPerEndpoint(wallet, author);
    const perConnection = new Connection(perEndpoint, "confirmed");
    const perProgram = this.program(perConnection, wallet);
    for (
      let offset = 0;
      offset < markdownBytes.length;
      offset += MAX_CONTENT_CHUNK_BYTES
    ) {
      const chunk = markdownBytes.slice(
        offset,
        Math.min(offset + MAX_CONTENT_CHUNK_BYTES, markdownBytes.length)
      );
      const writeIx = await perProgram.methods
        .writeContentChunk(offset, BufferCtor.from(chunk))
        .accounts({
          article,
          author,
          privateContent,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      await sendPerInstruction(perConnection, perEndpoint, wallet, writeIx);
    }

    const publishIx = await perProgram.methods
      .publishPrivateContent(markdownBytes.length, contentHash)
      .accounts({
        article,
        author,
        privateContent,
      })
      .instruction();
    await sendPerInstruction(perConnection, perEndpoint, wallet, publishIx);

    const finalizeTx = await program.methods
      .finalizeArticlePublish(markdownBytes.length, contentHash)
      .accounts({
        author,
        article,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, finalizeTx);

    const created = await this.fetchArticleById(articleId.toString(), config);
    if (!created) throw new Error("Created article could not be fetched.");
    return created;
  }

  async finalizeDraftArticle(articleId: string, fallbackMarkdown?: string) {
    const wallet = this.requireWallet();
    const author = publicKeyFromWallet(wallet);
    const articleDetail = await this.requireArticle(articleId);
    if (articleDetail.author !== author.toBase58()) {
      throw new Error("Only the article author can finalize publishing.");
    }

    const article = new PublicKey(
      articleDetail.account ?? articlePda(articleId)[0]
    );
    const privateContent = new PublicKey(articleDetail.privateContentAccount);
    const perEndpoint = await this.authenticatedPerEndpoint(wallet, author);
    const perConnection = new Connection(perEndpoint, "confirmed");
    const perProgram = this.program(perConnection, wallet);
    const contentState = await perProgram.account.articlePrivateContent.fetch(
      privateContent
    );
    let contentLen = Number(contentState.contentLen);
    let contentHash = Array.from(contentState.contentHash);

    if (
      contentState.published &&
      contentLen > 0 &&
      articleDetail.status !== "draft"
    ) {
      return articleDetail;
    }

    if (!contentState.published) {
      if (!fallbackMarkdown?.trim()) {
        throw new Error(
          "Private content is not published on PER yet. Paste the original Markdown in the writer form, then retry finalize."
        );
      }
      const markdownBytes = new TextEncoder().encode(fallbackMarkdown);
      const fallbackHash = Array.from(await sha256(markdownBytes));
      if (
        BufferCtor.from(fallbackHash).toString("hex") !==
        articleDetail.contentHash
      ) {
        throw new Error(
          "The Markdown in the writer form does not match this article's original content hash. Paste the exact Markdown used when creating the article."
        );
      }

      const active = await waitUntilPermissionActive(
        this.rpcConfig.perRpcUrl,
        privateContent,
        60000
      );
      if (!active) {
        throw new Error(
          "MagicBlock PER permission is not active yet. Wait a moment and retry."
        );
      }

      for (
        let offset = 0;
        offset < markdownBytes.length;
        offset += MAX_CONTENT_CHUNK_BYTES
      ) {
        const chunk = markdownBytes.slice(
          offset,
          Math.min(offset + MAX_CONTENT_CHUNK_BYTES, markdownBytes.length)
        );
        const writeIx = await perProgram.methods
          .writeContentChunk(offset, BufferCtor.from(chunk))
          .accounts({
            article,
            author,
            privateContent,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        await sendPerInstruction(perConnection, perEndpoint, wallet, writeIx);
      }

      const publishIx = await perProgram.methods
        .publishPrivateContent(markdownBytes.length, fallbackHash)
        .accounts({
          article,
          author,
          privateContent,
        })
        .instruction();
      await sendPerInstruction(perConnection, perEndpoint, wallet, publishIx);

      contentLen = markdownBytes.length;
      contentHash = fallbackHash;
    }

    const program = this.baseProgram(wallet);
    const finalizeTx = await program.methods
      .finalizeArticlePublish(contentLen, contentHash)
      .accounts({
        author,
        article,
      })
      .transaction();
    await sendWalletTransaction(this.baseConnection, wallet, finalizeTx);

    const finalized = await this.getArticle(articleId);
    if (!finalized) throw new Error("Finalized article could not be fetched.");
    return finalized;
  }

  private async fetchArticleById(
    articleId: string,
    config?: AnchorAccount
  ): Promise<ArticleDetail | null> {
    const program = this.baseProgram();
    const resolvedConfig =
      config ??
      (await program.account.globalConfig.fetch(globalConfigPda()[0]));
    const [article] = articlePda(articleId);
    try {
      const state = await program.account.article.fetch(article);
      return mapArticle(article.toBase58(), state, resolvedConfig);
    } catch (error) {
      if (isMissingAccountError(error)) return null;
      throw error;
    }
  }

  private async requireArticle(articleId: string) {
    const article = await this.fetchArticleById(articleId);
    if (!article) throw new Error("Article not found.");
    return article;
  }

  private async authenticatedPerEndpoint(
    wallet: BrowserWallet,
    publicKey: PublicKey
  ) {
    if (!wallet.signMessage) {
      throw new Error(
        "Wallet must support message signing to read or update PER private accounts."
      );
    }
    const auth = await getAuthToken(
      this.rpcConfig.perRpcUrl,
      publicKey,
      async (message: Uint8Array) => {
        const result = await wallet.signMessage!(message, "utf8");
        return result.signature;
      }
    );
    return `${this.rpcConfig.perRpcUrl}?token=${auth.token}`;
  }

  private baseProgram(wallet?: BrowserWallet) {
    return this.program(this.baseConnection, wallet);
  }

  private program(
    connection: Connection,
    wallet?: BrowserWallet
  ): AnchorProgram {
    const provider = new anchor.AnchorProvider(
      connection,
      toAnchorWallet(wallet),
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );
    return new anchor.Program(idl as anchor.Idl, provider) as AnchorProgram;
  }

  private requireWallet(expectedAddress?: string) {
    if (!this.wallet) throw new Error("Connect a wallet first.");
    const publicKey = publicKeyFromWallet(this.wallet);
    if (expectedAddress && publicKey.toBase58() !== expectedAddress) {
      throw new Error("Connected wallet changed. Reconnect and retry.");
    }
    if (!this.wallet.signTransaction) {
      throw new Error("Wallet must support transaction signing.");
    }
    return this.wallet;
  }
}

function createMockFluxorClient(): FluxorClient {
  return {
    async listArticles() {
      return mockArticles;
    },
    async getArticle(articleId) {
      return mockArticles.find((article) => article.id === articleId) ?? null;
    },
    async getPurchaseReceipt(articleId, walletAddress) {
      if (!walletAddress) return null;
      return mockReceipts[articleId] ?? null;
    },
    async buyArticle(articleId, walletAddress) {
      const article = mockArticles.find((item) => item.id === articleId);
      if (!article) throw new Error("Article not found.");

      const receipt: PurchaseReceipt = {
        articleId,
        buyer: walletAddress,
        readerRank: article.purchaseCount + 1,
        rewardDebt: article.accRewardPerReader,
        claimedRewardsLamports: 0n,
        accessGranted: true,
      };
      mockReceipts[articleId] = receipt;
      article.purchaseCount += 1;
      article.status =
        article.purchaseCount >= article.maxPurchases
          ? "sold_out"
          : "published";
      return receipt;
    },
    async grantAccess(articleId, walletAddress) {
      const receipt = mockReceipts[articleId];
      if (!receipt || receipt.buyer !== walletAddress)
        throw new Error("Purchase receipt not found.");
      receipt.accessGranted = true;
      return receipt;
    },
    async readPrivateMarkdown(articleId, walletAddress) {
      const receipt = mockReceipts[articleId];
      const article = mockArticles.find((item) => item.id === articleId);
      if (!article) throw new Error("Article not found.");
      if (
        !receipt ||
        receipt.buyer !== walletAddress ||
        !receipt.accessGranted
      ) {
        throw new Error(
          "Private content requires a purchase receipt and PER permission."
        );
      }
      return article.markdownPreview;
    },
    async claimReaderReward(articleId) {
      return mockReceipts[articleId] ?? null;
    },
    async claimAuthorRevenue() {},
    async claimPlatformFee() {},
    async createAndPublishArticle(input) {
      const id = String(mockArticles.length + 1);
      const article: ArticleDetail = {
        id,
        title: input.title,
        preview: input.summary,
        author: MOCK_WALLET,
        priceLamports: input.priceLamports,
        maxPurchases: input.maxPurchases,
        purchaseCount: 0,
        contentHash: "mock",
        publishedAt: new Date().toISOString(),
        status: "published",
        platformAdmin: MOCK_WALLET,
        platformFeeReceiver: MOCK_WALLET,
        markdownPreview: input.markdown,
        privateContentAccount: "MockContent",
        permissionAccount: "MockPermission",
        accRewardPerReader: 0n,
        authorPendingLamports: 0n,
        authorClaimedLamports: 0n,
        platformPendingLamports: 0n,
      };
      mockArticles.unshift(article);
      return article;
    },
    async finalizeDraftArticle(articleId) {
      const article = mockArticles.find((item) => item.id === articleId);
      if (!article) throw new Error("Article not found.");
      article.status = "published";
      return article;
    },
  };
}

function toAnchorWallet(wallet?: BrowserWallet): any {
  if (!wallet) {
    return {
      publicKey: PublicKey.default,
      signTransaction: async () => {
        throw new Error("Read-only client cannot sign transactions.");
      },
      signAllTransactions: async () => {
        throw new Error("Read-only client cannot sign transactions.");
      },
    };
  }
  return {
    publicKey: publicKeyFromWallet(wallet),
    signTransaction: async <T extends Transaction>(transaction: T) => {
      if (!wallet.signTransaction)
        throw new Error("Wallet must support transaction signing.");
      return wallet.signTransaction(transaction);
    },
    signAllTransactions: async <T extends Transaction>(transactions: T[]) => {
      if (wallet.signAllTransactions)
        return wallet.signAllTransactions(transactions);
      if (!wallet.signTransaction)
        throw new Error("Wallet must support transaction signing.");
      return Promise.all(
        transactions.map((transaction) => wallet.signTransaction!(transaction))
      );
    },
  };
}

function publicKeyFromWallet(wallet: BrowserWallet) {
  if (!wallet.publicKey) throw new Error("Wallet is not connected.");
  return new PublicKey(wallet.publicKey.toString());
}

async function sendWalletTransaction(
  connection: Connection,
  wallet: BrowserWallet,
  transaction: Transaction
) {
  if (!wallet.signTransaction)
    throw new Error("Wallet must support transaction signing.");
  transaction.feePayer = publicKeyFromWallet(wallet);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;
  const signed = await wallet.signTransaction(transaction);
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch (error) {
    if (isAlreadyProcessedError(error)) {
      return "already-processed";
    }
    throw error;
  }
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
  return signature;
}

async function sendPerInstruction(
  connection: Connection,
  endpoint: string,
  wallet: BrowserWallet,
  instruction: TransactionInstruction
) {
  if (!wallet.signTransaction)
    throw new Error("Wallet must support transaction signing.");
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = publicKeyFromWallet(wallet);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;
  const signed = await wallet.signTransaction(transaction);
  const encoded = BufferCtor.from(signed.serialize()).toString("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        encoded,
        {
          encoding: "base64",
          skipPreflight: true,
          preflightCommitment: "confirmed",
        },
      ],
    }),
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    if (isAlreadyProcessedError(JSON.stringify(json.error ?? json))) {
      return "already-processed";
    }
    throw new Error(
      `PER sendTransaction failed: ${JSON.stringify(json.error ?? json)}`
    );
  }
  const signature = json.result as string;
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
  return signature;
}

function mapArticle(
  account: string,
  state: AnchorAccount,
  config: AnchorAccount
): ArticleDetail {
  const purchaseCount = Number(state.purchaseCount);
  const maxPurchases = Number(state.maxPurchases);
  const active = Number(state.status) === 1;
  const status: ArticleStatus = !active
    ? "draft"
    : purchaseCount >= maxPurchases
    ? "sold_out"
    : "published";
  return {
    id: state.id.toString(),
    account,
    title: state.title,
    preview: state.summary,
    author: state.author.toBase58(),
    priceLamports: bnToBigInt(state.priceLamports),
    maxPurchases,
    purchaseCount,
    contentHash: BufferCtor.from(state.contentHash).toString("hex"),
    publishedAt: dateFromSeconds(state.createdAt),
    status,
    platformAdmin: config.admin.toBase58(),
    platformFeeReceiver: config.platformFeeReceiver.toBase58(),
    markdownPreview: state.summary,
    privateContentAccount: state.privateContent.toBase58(),
    permissionAccount: state.permission.toBase58(),
    accRewardPerReader: bnToBigInt(state.accRewardPerReader),
    authorPendingLamports: bnToBigInt(state.authorPending),
    authorClaimedLamports: bnToBigInt(state.authorClaimed),
    platformPendingLamports: bnToBigInt(state.platformPending),
  };
}

function mapReceipt(
  articleId: string,
  walletAddress: string,
  state: AnchorAccount
): PurchaseReceipt {
  return {
    articleId,
    buyer: walletAddress,
    readerRank: Number(state.purchaseIndex),
    rewardDebt: bnToBigInt(state.rewardDebt),
    claimedRewardsLamports: bnToBigInt(state.claimedRewards),
    accessGranted: Boolean(state.accessGranted),
  };
}

function globalConfigPda() {
  return PublicKey.findProgramAddressSync([GLOBAL_CONFIG_SEED], PROGRAM_ID);
}

function articlePda(articleId: string) {
  const seed = new anchor.BN(articleId).toArrayLike(BufferCtor, "le", 8);
  return PublicKey.findProgramAddressSync([ARTICLE_SEED, seed], PROGRAM_ID);
}

function vaultPda(article: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, article.toBuffer()],
    PROGRAM_ID
  );
}

function privateContentPda(article: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [CONTENT_SEED, article.toBuffer()],
    PROGRAM_ID
  );
}

function receiptPda(article: PublicKey, buyer: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [RECEIPT_SEED, article.toBuffer(), buyer.toBuffer()],
    PROGRAM_ID
  );
}

function deriveContentDelegationAccounts(privateContent: PublicKey) {
  const [buffer] = PublicKey.findProgramAddressSync(
    [BUFFER_SEED, privateContent.toBuffer()],
    PROGRAM_ID
  );
  const [delegationRecord] = PublicKey.findProgramAddressSync(
    [DELEGATION_RECORD_SEED, privateContent.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  const [delegationMetadata] = PublicKey.findProgramAddressSync(
    [DELEGATION_METADATA_SEED, privateContent.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  return { buffer, delegationRecord, delegationMetadata };
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return new Uint8Array(digest);
}

function bnToBigInt(value: { toString(): string }) {
  return BigInt(value.toString());
}

function dateFromSeconds(value: { toString(): string }) {
  const seconds = Number(value.toString());
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : "";
}

function isMissingAccountError(error: unknown) {
  return (
    error instanceof Error &&
    /Account does not exist|could not find account|Account not found/i.test(
      error.message
    )
  );
}

function isAlreadyProcessedError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "";
  return /already been processed|already processed/i.test(message);
}
