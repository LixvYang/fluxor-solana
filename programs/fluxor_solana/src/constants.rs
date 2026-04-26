use anchor_lang::prelude::*;

#[constant]
pub const PROGRAM_VERSION: u8 = 1;

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const PRECISION: u128 = 1_000_000_000_000;

pub const MAX_TITLE_BYTES: usize = 96;
pub const MAX_SUMMARY_BYTES: usize = 280;
pub const MAX_CONTENT_BYTES: usize = 32 * 1024;
pub const MAX_CONTENT_CHUNK_BYTES: usize = 900;

pub const ARTICLE_DRAFT: u8 = 0;
pub const ARTICLE_ACTIVE: u8 = 1;
pub const ARTICLE_DISABLED: u8 = 2;

pub const GLOBAL_CONFIG_SEED: &[u8] = b"global_config";
pub const ARTICLE_SEED: &[u8] = b"article";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CONTENT_SEED: &[u8] = b"content";
pub const RECEIPT_SEED: &[u8] = b"receipt";

pub const DELEGATE_BUFFER_SEED: &[u8] = b"buffer";
pub const DELEGATION_RECORD_SEED: &[u8] = b"delegation";
pub const DELEGATION_METADATA_SEED: &[u8] = b"delegation-metadata";
pub const PERMISSION_SEED: &[u8] = b"permission:";

pub const PERMISSION_CREATE_DISCRIMINATOR: u64 = 0;
pub const DLP_DELEGATE_DISCRIMINATOR: u64 = 0;
pub const DLP_DEFAULT_COMMIT_FREQUENCY_MS: u32 = 30_000;

#[constant]
pub const MAGICBLOCK_PERMISSION_PROGRAM_ID: Pubkey =
    pubkey!("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");

#[constant]
pub const MAGICBLOCK_DELEGATION_PROGRAM_ID: Pubkey =
    pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
