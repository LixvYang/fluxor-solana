/**
 * Initialize the Fluxor global_config PDA on Solana devnet.
 *
 * Usage:
 *   npx ts-node scripts/init-config-devnet.ts
 *
 * Idempotent: if global_config already exists, prints its current state and exits.
 */
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("DGABGfY3Jjp45DVAwzVPDBjdRVGF1LSYNmsrqjiNbX4H");
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const WALLET_PATH = process.env.SOLANA_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");

const PLATFORM_FEE_BPS = 1_000; // 10%
const REWARD_BPS = 4_000; // 40%
const AUTHOR_BPS = 5_000; // 50%
const MIN_PRICE_LAMPORTS = new anchor.BN(1_000_000); // 0.001 SOL
const MAX_PURCHASES_LIMIT = 100;

async function main() {
  const idl = JSON.parse(fs.readFileSync("target/idl/fluxor_solana.json", "utf8"));
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);

  const [globalConfig, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );

  console.log(`RPC: ${RPC_URL}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`Admin/payer: ${admin.publicKey.toBase58()}`);
  console.log(`global_config PDA: ${globalConfig.toBase58()} (bump ${bump})`);

  const existing = await connection.getAccountInfo(globalConfig);
  if (existing) {
    const account = await program.account.globalConfig.fetch(globalConfig);
    console.log("Already initialized:");
    console.log(JSON.stringify(account, replacer, 2));
    return;
  }

  const platformReceiver = admin.publicKey; // can be changed later via update_config
  console.log(
    `Initializing with fees ${PLATFORM_FEE_BPS}/${AUTHOR_BPS}/${REWARD_BPS} (platform/author/reward bps)`
  );

  const sig = await program.methods
    .initializeConfig(
      platformReceiver,
      PLATFORM_FEE_BPS,
      REWARD_BPS,
      AUTHOR_BPS,
      MIN_PRICE_LAMPORTS,
      MAX_PURCHASES_LIMIT
    )
    .accounts({
      globalConfig,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`Tx: ${sig}`);
  const account = await program.account.globalConfig.fetch(globalConfig);
  console.log(JSON.stringify(account, replacer, 2));
}

function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && "toBase58" in value) {
    return (value as { toBase58: () => string }).toBase58();
  }
  if (value && typeof value === "object" && "toString" in value && (value as any)._bn) {
    return (value as { toString: () => string }).toString();
  }
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
