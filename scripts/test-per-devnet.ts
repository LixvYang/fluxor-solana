/**
 * Phase C devnet check for MagicBlock public PER endpoint.
 *
 * Flow:
 *   base devnet: create_article + create real Permission Account + delegate Permission + delegate content
 *   PER devnet:  write_content_chunk + publish_content
 *   base devnet: buy_article x2
 *   PER devnet:  grant_access x2
 *   base devnet: mark_access_granted x2 + reader/author/platform claims
 *
 * Usage:
 *   pnpm test:per:devnet
 */
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const nodeCrypto = require("crypto");
const nacl = require("tweetnacl");
const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} = require("@solana/web3.js");
const {
  ACCOUNT_SIGNATURES_FLAG,
  AUTHORITY_FLAG,
  TX_BALANCES_FLAG,
  TX_LOGS_FLAG,
  TX_MESSAGE_FLAG,
  createDelegatePermissionInstruction,
  deserializePermission,
  getAuthToken,
  permissionPdaFromAccount,
  waitUntilPermissionActive,
} = require("@magicblock-labs/ephemeral-rollups-sdk");

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

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PER_RPC_URL =
  process.env.MAGICBLOCK_PER_RPC_URL ?? "https://devnet-tee.magicblock.app";
const WALLET_PATH =
  process.env.SOLANA_WALLET ??
  path.join(os.homedir(), ".config/solana/id.json");

const GLOBAL_CONFIG_SEED = Buffer.from("global_config");
const ARTICLE_SEED = Buffer.from("article");
const VAULT_SEED = Buffer.from("vault");
const CONTENT_SEED = Buffer.from("content");
const RECEIPT_SEED = Buffer.from("receipt");
const BUFFER_SEED = Buffer.from("buffer");
const DELEGATION_RECORD_SEED = Buffer.from("delegation");
const DELEGATION_METADATA_SEED = Buffer.from("delegation-metadata");

async function main() {
  const idl = JSON.parse(
    fs.readFileSync("target/idl/fluxor_solana.json", "utf8")
  );
  const wallet = loadWallet(WALLET_PATH);
  const baseConnection = new Connection(SOLANA_RPC_URL, "confirmed");
  const baseProvider = new anchor.AnchorProvider(
    baseConnection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  const baseProgram = new anchor.Program(idl, baseProvider);
  const buyer1 = Keypair.generate();
  const buyer2 = Keypair.generate();
  await fundBuyer(baseConnection, wallet, buyer1);
  await fundBuyer(baseConnection, wallet, buyer2);
  const buyer1Provider = new anchor.AnchorProvider(
    baseConnection,
    new anchor.Wallet(buyer1),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  const buyer2Provider = new anchor.AnchorProvider(
    baseConnection,
    new anchor.Wallet(buyer2),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  const buyer1Program = new anchor.Program(idl, buyer1Provider);
  const buyer2Program = new anchor.Program(idl, buyer2Provider);

  console.log(`base RPC: ${SOLANA_RPC_URL}`);
  console.log(`PER RPC:  ${PER_RPC_URL}`);
  console.log(`author:   ${wallet.publicKey.toBase58()}`);
  console.log(`buyer 1:  ${buyer1.publicKey.toBase58()}`);
  console.log(`buyer 2:  ${buyer2.publicKey.toBase58()}`);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [GLOBAL_CONFIG_SEED],
    PROGRAM_ID
  );
  const config = await baseProgram.account.globalConfig.fetch(globalConfig);
  const articleId = new anchor.BN(config.articleCount);
  const articleIdSeed = articleId.toArrayLike(Buffer, "le", 8);

  const [article] = PublicKey.findProgramAddressSync(
    [ARTICLE_SEED, articleIdSeed],
    PROGRAM_ID
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, article.toBuffer()],
    PROGRAM_ID
  );
  const [privateContent] = PublicKey.findProgramAddressSync(
    [CONTENT_SEED, article.toBuffer()],
    PROGRAM_ID
  );
  const permission = permissionPdaFromAccount(privateContent);
  const [receipt1] = PublicKey.findProgramAddressSync(
    [RECEIPT_SEED, article.toBuffer(), buyer1.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [receipt2] = PublicKey.findProgramAddressSync(
    [RECEIPT_SEED, article.toBuffer(), buyer2.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const markdown = Buffer.from(
    `# Fluxor PER devnet test\n\nArticle ${articleId.toString()} written through MagicBlock PER.`,
    "utf8"
  );
  const contentHash = Array.from(
    nodeCrypto.createHash("sha256").update(markdown).digest()
  );

  console.log(`article_id:       ${articleId.toString()}`);
  console.log(`article:          ${article.toBase58()}`);
  console.log(`private_content:  ${privateContent.toBase58()}`);
  console.log(`permission:       ${permission.toBase58()}`);

  console.log("→ base create_article");
  const createSig = await baseProgram.methods
    .createArticle(
      articleId,
      "PER devnet test",
      "Phase C public MagicBlock PER test",
      new anchor.BN(1_000_000),
      10,
      permission,
      contentHash
    )
    .accounts({
      globalConfig,
      author: wallet.publicKey,
      article,
      vault,
      privateContent,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  tx: ${explorer(createSig)}`);

  console.log("→ base create_content_permission");
  const createPermissionSig = await baseProgram.methods
    .createContentPermission()
    .accounts({
      author: wallet.publicKey,
      article,
      privateContent,
      permission,
      permissionProgram: PERMISSION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  tx: ${explorer(createPermissionSig)}`);
  await assertPermissionMember(baseConnection, permission, wallet.publicKey);

  console.log("→ base reserve_content_capacity");
  const reserveSig = await baseProgram.methods
    .reserveContentCapacity(markdown.length)
    .accounts({
      article,
      author: wallet.publicKey,
      privateContent,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  tx: ${explorer(reserveSig)}`);

  console.log("→ base delegate Permission Account");
  const delegatePermissionIx = createDelegatePermissionInstruction(
    {
      payer: wallet.publicKey,
      authority: [wallet.publicKey, true],
      permissionedAccount: [privateContent, false],
      ownerProgram: PERMISSION_PROGRAM_ID,
    },
    { validator: TEE_DEVNET_VALIDATOR }
  );
  const delegatePermissionSig = await sendAndConfirmTransaction(
    baseConnection,
    new Transaction().add(delegatePermissionIx),
    [wallet],
    { commitment: "confirmed", skipPreflight: false }
  );
  console.log(`  tx: ${explorer(delegatePermissionSig)}`);

  console.log("→ base delegate private_content");
  const delegateAccounts = deriveContentDelegationAccounts(privateContent);
  const delegateContentSig = await baseProgram.methods
    .delegateContent(TEE_DEVNET_VALIDATOR)
    .accounts({
      author: wallet.publicKey,
      article,
      privateContent,
      buffer: delegateAccounts.buffer,
      delegationRecord: delegateAccounts.delegationRecord,
      delegationMetadata: delegateAccounts.delegationMetadata,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ skipPreflight: false, commitment: "confirmed" });
  console.log(`  tx: ${explorer(delegateContentSig)}`);

  await sleep(5000);
  const permissionActive = await waitUntilPermissionActive(
    PER_RPC_URL,
    privateContent,
    60000
  );
  if (!permissionActive) {
    throw new Error(
      "Permission did not become active on the public PER endpoint"
    );
  }

  console.log("→ PER auth token");
  const auth = await getAuthToken(
    PER_RPC_URL,
    wallet.publicKey,
    async (message) => nacl.sign.detached(message, wallet.secretKey)
  );
  const perConnection = new Connection(
    `${PER_RPC_URL}?token=${auth.token}`,
    "confirmed"
  );
  const perProvider = new anchor.AnchorProvider(
    perConnection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  const perProgram = new anchor.Program(idl, perProvider);

  console.log("→ PER write_content_chunk");
  const writeIx = await perProgram.methods
    .writeContentChunk(0, markdown)
    .accounts({
      article,
      author: wallet.publicKey,
      privateContent,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  const writeSig = await sendPerInstruction(
    perConnection,
    `${PER_RPC_URL}?token=${auth.token}`,
    wallet,
    writeIx
  );
  console.log(`  tx: ${writeSig}`);

  console.log("→ PER publish_content");
  const publishIx = await perProgram.methods
    .publishPrivateContent(markdown.length, contentHash)
    .accounts({
      article,
      author: wallet.publicKey,
      privateContent,
    })
    .instruction();
  const publishSig = await sendPerInstruction(
    perConnection,
    `${PER_RPC_URL}?token=${auth.token}`,
    wallet,
    publishIx
  );
  console.log(`  tx: ${publishSig}`);

  const contentState = await perProgram.account.articlePrivateContent.fetch(
    privateContent
  );
  if (!contentState.published) throw new Error("PER content was not published");
  if (!Buffer.from(contentState.content).equals(markdown)) {
    throw new Error("PER content bytes do not match markdown");
  }

  console.log("→ base finalize_article_publish");
  const finalizeSig = await baseProgram.methods
    .finalizeArticlePublish(markdown.length, contentHash)
    .accounts({
      author: wallet.publicKey,
      article,
    })
    .rpc();
  console.log(`  tx: ${explorer(finalizeSig)}`);

  await buyGrantAndMark({
    label: "buyer 1",
    buyer: buyer1,
    buyerProgram: buyer1Program,
    receipt: receipt1,
    idl,
    article,
    vault,
    privateContent,
    permission,
    globalConfig,
    baseProgram,
  });

  await buyGrantAndMark({
    label: "buyer 2",
    buyer: buyer2,
    buyerProgram: buyer2Program,
    receipt: receipt2,
    idl,
    article,
    vault,
    privateContent,
    permission,
    globalConfig,
    baseProgram,
  });

  console.log("→ base buyer 1 claim_reader_reward");
  const claimReaderSig = await buyer1Program.methods
    .claimReaderReward()
    .accounts({
      reader: buyer1.publicKey,
      article,
      vault,
      receipt: receipt1,
    })
    .rpc();
  console.log(`  tx: ${explorer(claimReaderSig)}`);

  console.log("→ base author claim_author_revenue");
  const claimAuthorSig = await baseProgram.methods
    .claimAuthorRevenue()
    .accounts({
      author: wallet.publicKey,
      article,
      vault,
    })
    .rpc();
  console.log(`  tx: ${explorer(claimAuthorSig)}`);

  console.log("→ base admin claim_platform_fee");
  const claimPlatformSig = await baseProgram.methods
    .claimPlatformFee()
    .accounts({
      globalConfig,
      admin: wallet.publicKey,
      platformFeeReceiver: config.platformFeeReceiver,
      article,
      vault,
    })
    .rpc();
  console.log(`  tx: ${explorer(claimPlatformSig)}`);

  const receipt1State = await baseProgram.account.purchaseReceipt.fetch(
    receipt1
  );
  const receipt2State = await baseProgram.account.purchaseReceipt.fetch(
    receipt2
  );
  const articleState = await baseProgram.account.article.fetch(article);
  if (!receipt1State.accessGranted || !receipt2State.accessGranted) {
    throw new Error("access_granted was not committed for both receipts");
  }
  if (receipt1State.claimedRewards.lte(new anchor.BN(0))) {
    throw new Error("buyer 1 reader reward was not claimed");
  }
  if (articleState.authorPending.gt(new anchor.BN(0))) {
    throw new Error("author pending revenue was not fully claimed");
  }
  if (articleState.platformPending.gt(new anchor.BN(0))) {
    throw new Error("platform pending fees were not fully claimed");
  }

  console.log("✓ Phase C public PER devnet buy/grant/claim flow completed");
}

function loadWallet(walletPath) {
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function fundBuyer(connection, payer, buyer) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: buyer.publicKey,
      lamports: LAMPORTS_PER_SOL / 10,
    })
  );
  await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: "confirmed",
  });
}

function deriveContentDelegationAccounts(privateContent) {
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

async function assertPermissionMember(connection, permission, member) {
  const account = await connection.getAccountInfo(permission, "confirmed");
  if (!account) throw new Error("Permission account was not created");
  const state = deserializePermission(account.data);
  const found = state.members?.find((entry) => entry.pubkey.equals(member));
  if (!found)
    throw new Error("Permission account is missing initial authority member");
  const required =
    AUTHORITY_FLAG |
    TX_LOGS_FLAG |
    TX_BALANCES_FLAG |
    TX_MESSAGE_FLAG |
    ACCOUNT_SIGNATURES_FLAG;
  if ((found.flags & required) !== required) {
    throw new Error(
      `Initial permission flags ${found.flags} do not include ${required}`
    );
  }
}

async function buyGrantAndMark({
  label,
  buyer,
  buyerProgram,
  receipt,
  idl,
  article,
  vault,
  privateContent,
  permission,
  globalConfig,
  baseProgram,
}) {
  console.log(`→ base ${label} buy_article`);
  const buySig = await buyerProgram.methods
    .buyArticle()
    .accounts({
      globalConfig,
      buyer: buyer.publicKey,
      article,
      vault,
      receipt,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  tx: ${explorer(buySig)}`);

  console.log(`→ PER ${label} grant_per_access`);
  const buyerAuth = await getAuthToken(
    PER_RPC_URL,
    buyer.publicKey,
    async (message) => nacl.sign.detached(message, buyer.secretKey)
  );
  const buyerPerEndpoint = `${PER_RPC_URL}?token=${buyerAuth.token}`;
  const buyerPerConnection = new Connection(buyerPerEndpoint, "confirmed");
  const buyerPerProvider = new anchor.AnchorProvider(
    buyerPerConnection,
    new anchor.Wallet(buyer),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  const buyerPerProgram = new anchor.Program(idl, buyerPerProvider);
  const grantIx = await buyerPerProgram.methods
    .grantPerAccess()
    .accounts({
      buyer: buyer.publicKey,
      article,
      privateContent,
      receipt,
      permission,
      permissionProgram: PERMISSION_PROGRAM_ID,
    })
    .instruction();
  const grantSig = await sendPerInstruction(
    buyerPerConnection,
    buyerPerEndpoint,
    buyer,
    grantIx
  );
  console.log(`  tx: ${grantSig}`);

  console.log(`→ base ${label} mark_access_granted`);
  const markSig = await buyerProgram.methods
    .markAccessGranted()
    .accounts({
      buyer: buyer.publicKey,
      article,
      receipt,
    })
    .rpc();
  console.log(`  tx: ${explorer(markSig)}`);

  const receiptState = await baseProgram.account.purchaseReceipt.fetch(receipt);
  if (!receiptState.accessGranted) {
    throw new Error(`${label} receipt.access_granted was not committed`);
  }
}

async function sendPerInstruction(
  connection,
  endpoint,
  wallet,
  instruction,
  extraSigners = []
) {
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(wallet, ...extraSigners);

  const encoded = transaction.serialize().toString("base64");
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
  const json: any = await response.json();
  if (!response.ok || json.error) {
    throw new Error(`PER sendTransaction failed: ${JSON.stringify(json)}`);
  }
  const signature = json.result;
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
  return signature;
}

function explorer(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
