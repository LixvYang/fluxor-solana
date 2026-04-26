const anchor = require("@coral-xyz/anchor");
const { expect } = require("chai");
const { createHash } = require("crypto");
const { readFileSync } = require("fs");
const {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} = require("@solana/web3.js");

type Connection = import("@solana/web3.js").Connection;
type KeypairType = import("@solana/web3.js").Keypair;
type PublicKeyType = import("@solana/web3.js").PublicKey;

const idl = JSON.parse(readFileSync("target/idl/fluxor_solana.json", "utf8"));
const BN = anchor.BN;

const PROGRAM_ID = new PublicKey(
  "DGABGfY3Jjp45DVAwzVPDBjdRVGF1LSYNmsrqjiNbX4H"
);
const MAGICBLOCK_PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
);
const GLOBAL_CONFIG_SEED = Buffer.from("global_config");
const ARTICLE_SEED = Buffer.from("article");
const VAULT_SEED = Buffer.from("vault");
const CONTENT_SEED = Buffer.from("content");
const RECEIPT_SEED = Buffer.from("receipt");

const PRICE = new BN(1_000_000);
const PLATFORM_FEE = new BN(100_000);
const REWARD_POOL = new BN(400_000);
const AUTHOR_AMOUNT = new BN(500_000);
const PRECISION = new BN("1000000000000");
const PERMISSION_ACCOUNT_SPACE = 1024;
const AUTHORITY_FLAG = 1 << 0;
const TX_MESSAGE_FLAG = 1 << 3;

describe("fluxor_solana rpc full flow", () => {
  const connection = new anchor.web3.Connection(
    process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899",
    "confirmed"
  );
  const admin = Keypair.generate();
  const platformReceiver = Keypair.generate();
  const author = Keypair.generate();
  const buyer1 = Keypair.generate();
  const buyer2 = Keypair.generate();
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(admin),
    {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    }
  );
  const program = new anchor.Program(idl, provider);

  before(async () => {
    anchor.setProvider(provider);
    for (const keypair of [admin, platformReceiver, author, buyer1, buyer2]) {
      await airdrop(connection, keypair.publicKey, 10 * LAMPORTS_PER_SOL);
    }
  });

  it("creates, writes, publishes, buys, grants access, and claims over real RPC", async () => {
    const articleId = new BN(0);
    const articleIdSeed = articleId.toArrayLike(Buffer, "le", 8);
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [GLOBAL_CONFIG_SEED],
      PROGRAM_ID
    );
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
    const [receipt1] = PublicKey.findProgramAddressSync(
      [RECEIPT_SEED, article.toBuffer(), buyer1.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [receipt2] = PublicKey.findProgramAddressSync(
      [RECEIPT_SEED, article.toBuffer(), buyer2.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const permission = Keypair.generate();
    const markdown = Buffer.from(
      "# Fluxor\n\nPaid markdown over local RPC.",
      "utf8"
    );
    const contentHash = Array.from(
      createHash("sha256").update(markdown).digest()
    );

    await program.methods
      .initializeConfig(
        platformReceiver.publicKey,
        1_000,
        4_000,
        5_000,
        new BN(1),
        100
      )
      .accounts({
        globalConfig,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    await program.methods
      .createArticle(
        articleId,
        "RPC Test",
        "solana-test-validator full flow",
        PRICE,
        10,
        permission.publicKey,
        contentHash
      )
      .accounts({
        globalConfig,
        author: author.publicKey,
        article,
        vault,
        privateContent,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([author])
      .rpc();

    await createPermissionAccount(
      connection,
      admin,
      permission,
      privateContent,
      [{ flags: AUTHORITY_FLAG | TX_MESSAGE_FLAG, pubkey: author.publicKey }]
    );

    await program.methods
      .writeContentChunk(0, markdown)
      .accounts({
        article,
        author: author.publicKey,
        privateContent,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([author])
      .rpc();

    await program.methods
      .publishContent(markdown.length, contentHash)
      .accounts({
        article,
        author: author.publicKey,
        privateContent,
      } as any)
      .signers([author])
      .rpc();

    const contentState = await program.account.articlePrivateContent.fetch(
      privateContent
    );
    expect(contentState.published).to.equal(true);
    expect(contentState.contentLen).to.equal(markdown.length);
    expect(Buffer.from(contentState.content)).to.deep.equal(markdown);

    await program.methods
      .buyArticle()
      .accounts({
        globalConfig,
        buyer: buyer1.publicKey,
        article,
        vault,
        receipt: receipt1,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([buyer1])
      .rpc();

    await program.methods
      .grantAccess()
      .accounts({
        buyer: buyer1.publicKey,
        article,
        privateContent,
        receipt: receipt1,
        permission: permission.publicKey,
        permissionProgram: MAGICBLOCK_PERMISSION_PROGRAM_ID,
      } as any)
      .signers([buyer1])
      .rpc();

    const receipt1AfterGrant = await program.account.purchaseReceipt.fetch(
      receipt1
    );
    expect(receipt1AfterGrant.accessGranted).to.equal(true);
    expect(receipt1AfterGrant.purchaseIndex).to.equal(0);
    expect(receipt1AfterGrant.rewardDebt.eq(new BN(0))).to.equal(true);
    expectPermissionMember(
      await readPermission(connection, permission.publicKey),
      buyer1.publicKey,
      TX_MESSAGE_FLAG
    );

    await program.methods
      .buyArticle()
      .accounts({
        globalConfig,
        buyer: buyer2.publicKey,
        article,
        vault,
        receipt: receipt2,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([buyer2])
      .rpc();

    await program.methods
      .grantAccess()
      .accounts({
        buyer: buyer2.publicKey,
        article,
        privateContent,
        receipt: receipt2,
        permission: permission.publicKey,
        permissionProgram: MAGICBLOCK_PERMISSION_PROGRAM_ID,
      } as any)
      .signers([buyer2])
      .rpc();

    const articleAfterBuys = await program.account.article.fetch(article);
    expect(articleAfterBuys.purchaseCount).to.equal(2);
    expect(articleAfterBuys.totalPaid.eq(PRICE.muln(2))).to.equal(true);
    expect(articleAfterBuys.platformPending.eq(PLATFORM_FEE.muln(2))).to.equal(
      true
    );
    expect(
      articleAfterBuys.authorPending.eq(REWARD_POOL.add(AUTHOR_AMOUNT.muln(2)))
    ).to.equal(true);
    expect(
      articleAfterBuys.accRewardPerReader.eq(REWARD_POOL.mul(PRECISION))
    ).to.equal(true);

    await program.methods
      .claimReaderReward()
      .accounts({
        reader: buyer1.publicKey,
        article,
        vault,
        receipt: receipt1,
      } as any)
      .signers([buyer1])
      .rpc();

    const receipt1AfterClaim = await program.account.purchaseReceipt.fetch(
      receipt1
    );
    expect(receipt1AfterClaim.claimedRewards.eq(REWARD_POOL)).to.equal(true);
    expect(
      receipt1AfterClaim.rewardDebt.eq(REWARD_POOL.mul(PRECISION))
    ).to.equal(true);

    await program.methods
      .claimAuthorRevenue()
      .accounts({
        author: author.publicKey,
        article,
        vault,
      } as any)
      .signers([author])
      .rpc();

    await program.methods
      .claimPlatformFee()
      .accounts({
        globalConfig,
        admin: admin.publicKey,
        platformFeeReceiver: platformReceiver.publicKey,
        article,
        vault,
      } as any)
      .rpc();

    const articleAfterClaims = await program.account.article.fetch(article);
    expect(articleAfterClaims.authorPending.eq(new BN(0))).to.equal(true);
    expect(articleAfterClaims.platformPending.eq(new BN(0))).to.equal(true);
    expect(
      articleAfterClaims.authorClaimed.eq(
        REWARD_POOL.add(AUTHOR_AMOUNT.muln(2))
      )
    ).to.equal(true);
    expect(
      articleAfterClaims.platformClaimed.eq(PLATFORM_FEE.muln(2))
    ).to.equal(true);

    const vaultBalance = await connection.getBalance(vault);
    const vaultRent = await connection.getMinimumBalanceForRentExemption(42);
    expect(vaultBalance).to.equal(vaultRent);
  });
});

async function airdrop(
  connection: Connection,
  pubkey: PublicKeyType,
  lamports: number
) {
  const signature = await connection.requestAirdrop(pubkey, lamports);
  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...blockhash }, "confirmed");
}

async function createPermissionAccount(
  connection: Connection,
  payer: KeypairType,
  permission: KeypairType,
  permissionedAccount: PublicKeyType,
  members: PermissionMember[]
) {
  const rent = await connection.getMinimumBalanceForRentExemption(
    PERMISSION_ACCOUNT_SPACE
  );
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: permission.publicKey,
      lamports: rent,
      space: PERMISSION_ACCOUNT_SPACE,
      programId: MAGICBLOCK_PERMISSION_PROGRAM_ID,
    }),
    new TransactionInstruction({
      programId: MAGICBLOCK_PERMISSION_PROGRAM_ID,
      keys: [
        { pubkey: permission.publicKey, isSigner: true, isWritable: true },
      ],
      data: encodeInitializePermission(permissionedAccount, members),
    })
  );

  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, permission],
    {
      commitment: "confirmed",
    }
  );
}

type PermissionMember = {
  flags: number;
  pubkey: PublicKeyType;
};

type PermissionState = {
  permissionedAccount: PublicKeyType;
  members: PermissionMember[];
};

function encodeInitializePermission(
  permissionedAccount: PublicKeyType,
  members: PermissionMember[]
) {
  return Buffer.concat([
    u64(0),
    permissionedAccount.toBuffer(),
    encodeMembers(members),
  ]);
}

function encodeMembers(members: PermissionMember[]) {
  return Buffer.concat([
    Buffer.from([1]),
    u32(members.length),
    ...members.map((member) =>
      Buffer.concat([Buffer.from([member.flags]), member.pubkey.toBuffer()])
    ),
  ]);
}

async function readPermission(connection: Connection, pubkey: PublicKeyType) {
  const account = await connection.getAccountInfo(pubkey, "confirmed");
  expect(account).to.not.equal(null);
  const data = account!.data;
  let offset = 2;
  const permissionedAccount = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const optionTag = data[offset];
  offset += 1;
  const members: PermissionMember[] = [];

  if (optionTag === 1) {
    const len = data.readUInt32LE(offset);
    offset += 4;
    for (let i = 0; i < len; i += 1) {
      const flags = data[offset];
      offset += 1;
      const member = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;
      members.push({ flags, pubkey: member });
    }
  }

  return { permissionedAccount, members };
}

function expectPermissionMember(
  permission: PermissionState,
  member: PublicKeyType,
  requiredFlags: number
) {
  const found = permission.members.find((entry) => entry.pubkey.equals(member));
  expect(found, `missing permission member ${member.toBase58()}`).to.not.equal(
    undefined
  );
  expect((found!.flags & requiredFlags) === requiredFlags).to.equal(true);
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}
