/**
 * End-to-end devnet check for create_article + delegate_content.
 *
 * Reads the next article_id from global_config, creates an article (so
 * ArticlePrivateContent exists), then calls delegate_content and asserts the
 * private_content account owner has switched to the MagicBlock Delegation
 * Program.
 *
 * Usage:
 *   pnpm test:delegate:devnet
 */
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const nodeCrypto = require("crypto");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("DGABGfY3Jjp45DVAwzVPDBjdRVGF1LSYNmsrqjiNbX4H");
const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const WALLET_PATH =
  process.env.SOLANA_WALLET ??
  path.join(os.homedir(), ".config/solana/id.json");

const GLOBAL_CONFIG_SEED = Buffer.from("global_config");
const ARTICLE_SEED = Buffer.from("article");
const VAULT_SEED = Buffer.from("vault");
const CONTENT_SEED = Buffer.from("content");
const BUFFER_SEED = Buffer.from("buffer");
const DELEGATION_RECORD_SEED = Buffer.from("delegation");
const DELEGATION_METADATA_SEED = Buffer.from("delegation-metadata");

async function main() {
  const idl = JSON.parse(
    fs.readFileSync("target/idl/fluxor_solana.json", "utf8")
  );
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);

  console.log(`RPC: ${RPC_URL}`);
  console.log(`Author/payer: ${wallet.publicKey.toBase58()}`);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [GLOBAL_CONFIG_SEED],
    PROGRAM_ID
  );
  const config = await program.account.globalConfig.fetch(globalConfig);
  const articleId = new anchor.BN(config.articleCount);
  const articleIdSeed = articleId.toArrayLike(Buffer, "le", 8);
  console.log(`Next article_id: ${articleId.toString()}`);

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

  console.log(`article: ${article.toBase58()}`);
  console.log(`private_content: ${privateContent.toBase58()}`);
  console.log(`buffer: ${buffer.toBase58()}`);
  console.log(`delegation_record: ${delegationRecord.toBase58()}`);
  console.log(`delegation_metadata: ${delegationMetadata.toBase58()}`);

  const permission = Keypair.generate().publicKey;
  const markdown = Buffer.from(
    `# Devnet delegate test (article ${articleId.toString()})`,
    "utf8"
  );
  const contentHash = Array.from(
    nodeCrypto.createHash("sha256").update(markdown).digest()
  );

  const existingArticle = await connection.getAccountInfo(article);
  if (existingArticle) {
    throw new Error(
      `Article PDA already exists (article_id ${articleId.toString()}). ` +
        `Re-run after global_config.article_count increments.`
    );
  }

  console.log("→ create_article");
  const createSig = await program.methods
    .createArticle(
      articleId,
      "Devnet delegate test",
      "Phase B test article — delegated to MagicBlock PER",
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
  console.log(`  tx: ${createSig}`);

  const before = await connection.getAccountInfo(privateContent);
  if (!before) throw new Error("private_content not created");
  console.log(`  private_content owner before: ${before.owner.toBase58()}`);
  if (!before.owner.equals(PROGRAM_ID)) {
    throw new Error("private_content should be owned by Fluxor before delegate");
  }

  console.log("→ delegate_content");
  let delegateSig: string;
  try {
    delegateSig = await program.methods
      .delegateContent(null)
      .accounts({
        author: wallet.publicKey,
        article,
        privateContent,
        buffer,
        delegationRecord,
        delegationMetadata,
        ownerProgram: PROGRAM_ID,
        delegationProgram: DELEGATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: false, commitment: "confirmed" });
  } catch (err: any) {
    console.error("Error class:", err?.constructor?.name);
    console.error("Error keys:", err ? Object.keys(err) : null);
    console.error("Error message:", err?.message);
    if (err?.signature) console.error("Signature:", err.signature);
    if (err?.transactionMessage)
      console.error("transactionMessage:", err.transactionMessage);
    if (typeof err?.getLogs === "function") {
      try {
        const logs = await err.getLogs(connection);
        console.error("Logs from getLogs():");
        if (Array.isArray(logs)) for (const l of logs) console.error("  ", l);
        else console.error("  ", logs);
      } catch (e) {
        console.error("getLogs failed:", e);
      }
    }
    if (err?.logs) {
      console.error("Logs (direct):");
      const arr = Array.isArray(err.logs) ? err.logs : [err.logs];
      for (const l of arr) console.error("  ", l);
    }
    throw err;
  }
  console.log(`  tx: ${delegateSig}`);

  const after = await connection.getAccountInfo(privateContent);
  if (!after) throw new Error("private_content disappeared");
  console.log(`  private_content owner after:  ${after.owner.toBase58()}`);

  if (!after.owner.equals(DELEGATION_PROGRAM_ID)) {
    throw new Error(
      `Expected owner=${DELEGATION_PROGRAM_ID.toBase58()}, got ${after.owner.toBase58()}`
    );
  }
  console.log("✓ delegation succeeded — private_content is now on PER");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
