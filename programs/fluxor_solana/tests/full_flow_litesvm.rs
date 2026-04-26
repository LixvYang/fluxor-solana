use anchor_lang::{
    prelude::Pubkey, AccountDeserialize, AnchorDeserialize, AnchorSerialize, InstructionData,
    ToAccountMetas,
};
use litesvm::LiteSVM;
use solana_account::Account;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_rent::Rent;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use std::path::PathBuf;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
const PRICE: u64 = 1_000_000;
const PLATFORM_FEE: u64 = 100_000;
const REWARD_POOL: u64 = 400_000;
const AUTHOR_AMOUNT: u64 = 500_000;
const PERMISSION_ACCOUNT_SPACE: usize = 1024;
const TX_MESSAGE_FLAG: u8 = 1 << 3;
const AUTHORITY_FLAG: u8 = 1 << 0;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
struct TestPermissionMember {
    flags: u8,
    pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
struct TestPermission {
    discriminator: u8,
    bump: u8,
    permissioned_account: Pubkey,
    members: Option<Vec<TestPermissionMember>>,
}

#[test]
fn full_article_purchase_access_and_claim_flow() {
    let mut svm = LiteSVM::new();
    svm.add_program(fluxor_solana::id(), &read_deploy_so("fluxor_solana"))
        .unwrap();
    svm.add_program(
        fluxor_solana::MAGICBLOCK_PERMISSION_PROGRAM_ID,
        &read_deploy_so("mock_permission"),
    )
    .unwrap();

    let admin = Keypair::new();
    let platform_receiver = Keypair::new();
    let author = Keypair::new();
    let buyer1 = Keypair::new();
    let buyer2 = Keypair::new();

    for keypair in [&admin, &platform_receiver, &author, &buyer1, &buyer2] {
        svm.airdrop(&keypair.pubkey(), 10 * LAMPORTS_PER_SOL)
            .unwrap();
    }

    let (global_config, _) =
        Pubkey::find_program_address(&[fluxor_solana::GLOBAL_CONFIG_SEED], &fluxor_solana::id());
    let article_id = 0_u64;
    let article_id_bytes = article_id.to_le_bytes();
    let (article, _) = Pubkey::find_program_address(
        &[fluxor_solana::ARTICLE_SEED, &article_id_bytes],
        &fluxor_solana::id(),
    );
    let (vault, _) = Pubkey::find_program_address(
        &[fluxor_solana::VAULT_SEED, article.as_ref()],
        &fluxor_solana::id(),
    );
    let (private_content, _) = Pubkey::find_program_address(
        &[fluxor_solana::CONTENT_SEED, article.as_ref()],
        &fluxor_solana::id(),
    );
    let (receipt1, _) = Pubkey::find_program_address(
        &[
            fluxor_solana::RECEIPT_SEED,
            article.as_ref(),
            buyer1.pubkey().as_ref(),
        ],
        &fluxor_solana::id(),
    );
    let (receipt2, _) = Pubkey::find_program_address(
        &[
            fluxor_solana::RECEIPT_SEED,
            article.as_ref(),
            buyer2.pubkey().as_ref(),
        ],
        &fluxor_solana::id(),
    );
    let permission = Pubkey::new_unique();
    let markdown = b"# Fluxor\n\nPaid markdown.";
    let content_hash = solana_sha256_hasher::hash(markdown).to_bytes();

    send_ix(
        &mut svm,
        fluxor_solana::instruction::InitializeConfig {
            platform_fee_receiver: platform_receiver.pubkey(),
            platform_fee_bps: 1_000,
            reward_bps: 4_000,
            author_bps: 5_000,
            min_price_lamports: 1,
            max_purchases_limit: 100,
        },
        fluxor_solana::accounts::InitializeConfig {
            global_config,
            admin: admin.pubkey(),
            system_program: solana_sdk_ids::system_program::id(),
        },
        &admin.pubkey(),
        &[&admin],
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::CreateArticle {
            article_id,
            title: "Local Test".to_string(),
            summary: "LiteSVM full flow".to_string(),
            price_lamports: PRICE,
            max_purchases: 10,
            permission,
            content_hash,
        },
        fluxor_solana::accounts::CreateArticle {
            global_config,
            author: author.pubkey(),
            article,
            vault,
            private_content,
            system_program: solana_sdk_ids::system_program::id(),
        },
        &author.pubkey(),
        &[&author],
    );

    write_permission_account(&mut svm, permission, private_content, author.pubkey());

    send_ix(
        &mut svm,
        fluxor_solana::instruction::WriteContentChunk {
            offset: 0,
            chunk: markdown.to_vec(),
        },
        fluxor_solana::accounts::WriteContentChunk {
            article,
            author: author.pubkey(),
            private_content,
            system_program: solana_sdk_ids::system_program::id(),
        },
        &author.pubkey(),
        &[&author],
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::PublishContent {
            content_len: markdown.len() as u32,
            content_hash,
        },
        fluxor_solana::accounts::PublishContent {
            article,
            author: author.pubkey(),
            private_content,
        },
        &author.pubkey(),
        &[&author],
    );

    let content_state = read_account::<fluxor_solana::ArticlePrivateContent>(&svm, private_content);
    assert!(content_state.published);
    assert_eq!(content_state.content_len, markdown.len() as u32);
    assert_eq!(content_state.content, markdown);

    send_ix(
        &mut svm,
        fluxor_solana::instruction::BuyArticle {},
        fluxor_solana::accounts::BuyArticle {
            global_config,
            buyer: buyer1.pubkey(),
            article,
            vault,
            receipt: receipt1,
            system_program: solana_sdk_ids::system_program::id(),
        },
        &buyer1.pubkey(),
        &[&buyer1],
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::GrantAccess {},
        fluxor_solana::accounts::GrantAccess {
            buyer: buyer1.pubkey(),
            article,
            private_content,
            receipt: receipt1,
            permission,
            permission_program: fluxor_solana::MAGICBLOCK_PERMISSION_PROGRAM_ID,
        },
        &buyer1.pubkey(),
        &[&buyer1],
    );

    let receipt1_state = read_account::<fluxor_solana::PurchaseReceipt>(&svm, receipt1);
    assert!(receipt1_state.access_granted);
    assert_eq!(receipt1_state.purchase_index, 0);
    assert_eq!(receipt1_state.reward_debt, 0);
    assert_permission_member(&svm, permission, buyer1.pubkey(), TX_MESSAGE_FLAG);

    send_ix(
        &mut svm,
        fluxor_solana::instruction::BuyArticle {},
        fluxor_solana::accounts::BuyArticle {
            global_config,
            buyer: buyer2.pubkey(),
            article,
            vault,
            receipt: receipt2,
            system_program: solana_sdk_ids::system_program::id(),
        },
        &buyer2.pubkey(),
        &[&buyer2],
    );

    let article_state = read_account::<fluxor_solana::Article>(&svm, article);
    assert_eq!(article_state.purchase_count, 2);
    assert_eq!(article_state.total_paid, PRICE * 2);
    assert_eq!(article_state.platform_pending, PLATFORM_FEE * 2);
    assert_eq!(
        article_state.author_pending,
        REWARD_POOL + AUTHOR_AMOUNT + AUTHOR_AMOUNT
    );
    assert_eq!(
        article_state.acc_reward_per_reader,
        u128::from(REWARD_POOL) * fluxor_solana::PRECISION
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::ClaimReaderReward {},
        fluxor_solana::accounts::ClaimReaderReward {
            reader: buyer1.pubkey(),
            article,
            vault,
            receipt: receipt1,
        },
        &buyer1.pubkey(),
        &[&buyer1],
    );

    let receipt1_state = read_account::<fluxor_solana::PurchaseReceipt>(&svm, receipt1);
    assert_eq!(receipt1_state.claimed_rewards, REWARD_POOL);
    assert_eq!(
        receipt1_state.reward_debt,
        u128::from(REWARD_POOL) * fluxor_solana::PRECISION
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::ClaimAuthorRevenue {},
        fluxor_solana::accounts::ClaimAuthorRevenue {
            author: author.pubkey(),
            article,
            vault,
        },
        &author.pubkey(),
        &[&author],
    );

    let article_state = read_account::<fluxor_solana::Article>(&svm, article);
    assert_eq!(article_state.author_pending, 0);
    assert_eq!(
        article_state.author_claimed,
        REWARD_POOL + AUTHOR_AMOUNT + AUTHOR_AMOUNT
    );

    send_ix(
        &mut svm,
        fluxor_solana::instruction::ClaimPlatformFee {},
        fluxor_solana::accounts::ClaimPlatformFee {
            global_config,
            admin: admin.pubkey(),
            platform_fee_receiver: platform_receiver.pubkey(),
            article,
            vault,
        },
        &admin.pubkey(),
        &[&admin],
    );

    let article_state = read_account::<fluxor_solana::Article>(&svm, article);
    assert_eq!(article_state.platform_pending, 0);
    assert_eq!(article_state.platform_claimed, PLATFORM_FEE * 2);

    let vault_account = svm.get_account(&vault).unwrap();
    assert_eq!(
        vault_account.lamports,
        Rent::default().minimum_balance(fluxor_solana::ArticleVault::SPACE)
    );
}

fn send_ix<I, A>(
    svm: &mut LiteSVM,
    instruction_data: I,
    accounts: A,
    payer: &Pubkey,
    signers: &[&Keypair],
) where
    I: InstructionData,
    A: ToAccountMetas,
{
    let ix = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        fluxor_solana::id(),
        &instruction_data.data(),
        accounts.to_account_metas(None),
    );
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(payer), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn read_account<T>(svm: &LiteSVM, address: Pubkey) -> T
where
    T: AccountDeserialize,
{
    let account = svm.get_account(&address).unwrap();
    let mut data: &[u8] = &account.data;
    T::try_deserialize(&mut data).unwrap()
}

fn write_permission_account(
    svm: &mut LiteSVM,
    permission: Pubkey,
    permissioned_account: Pubkey,
    author: Pubkey,
) {
    let state = TestPermission {
        discriminator: 0,
        bump: 0,
        permissioned_account,
        members: Some(vec![TestPermissionMember {
            flags: AUTHORITY_FLAG | TX_MESSAGE_FLAG,
            pubkey: author,
        }]),
    };
    let mut serialized = Vec::new();
    state.serialize(&mut serialized).unwrap();
    let mut data = vec![0_u8; PERMISSION_ACCOUNT_SPACE];
    data[..serialized.len()].copy_from_slice(&serialized);

    svm.set_account(
        permission,
        Account {
            lamports: Rent::default().minimum_balance(PERMISSION_ACCOUNT_SPACE),
            data,
            owner: fluxor_solana::MAGICBLOCK_PERMISSION_PROGRAM_ID
                .to_bytes()
                .into(),
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn assert_permission_member(svm: &LiteSVM, permission: Pubkey, member: Pubkey, flag: u8) {
    let account = svm.get_account(&permission).unwrap();
    let mut data: &[u8] = &account.data;
    let permission_state = TestPermission::deserialize(&mut data).unwrap();
    let members = permission_state.members.unwrap();
    let member_state = members
        .iter()
        .find(|candidate| candidate.pubkey == member)
        .unwrap();
    assert_eq!(member_state.flags & flag, flag);
}

fn read_deploy_so(name: &str) -> Vec<u8> {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("..");
    path.push("..");
    path.push("target");
    path.push("deploy");
    path.push(format!("{name}.so"));
    std::fs::read(&path).unwrap_or_else(|err| {
        panic!(
            "failed to read {}: {err}. Run `bash scripts/test-local-lite.sh` from the repo root first",
            path.display()
        )
    })
}
