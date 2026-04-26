use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub version: u8,
    pub admin: Pubkey,
    pub platform_fee_receiver: Pubkey,
    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,
    pub min_price_lamports: u64,
    pub max_purchases_limit: u32,
    pub article_count: u64,
    pub paused: bool,
    pub bump: u8,
}

impl GlobalConfig {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

#[account]
#[derive(InitSpace)]
pub struct Article {
    pub version: u8,
    pub id: u64,
    pub author: Pubkey,
    #[max_len(96)]
    pub title: String,
    #[max_len(280)]
    pub summary: String,
    pub price_lamports: u64,
    pub max_purchases: u32,
    pub purchase_count: u32,
    pub vault: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,
    pub total_paid: u64,
    pub acc_reward_per_reader: u128,
    pub author_pending: u64,
    pub author_claimed: u64,
    pub platform_pending: u64,
    pub platform_claimed: u64,
    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,
    pub content_hash: [u8; 32],
    pub content_version: u32,
    pub status: u8,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Article {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

#[account]
#[derive(InitSpace)]
pub struct ArticleVault {
    pub version: u8,
    pub article: Pubkey,
    pub bump: u8,
}

impl ArticleVault {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

#[account]
#[derive(InitSpace)]
pub struct PurchaseReceipt {
    pub version: u8,
    pub article: Pubkey,
    pub reader: Pubkey,
    pub purchase_index: u32,
    pub paid_lamports: u64,
    pub reward_debt: u128,
    pub claimed_rewards: u64,
    pub access_granted: bool,
    pub purchased_at: i64,
    pub bump: u8,
}

impl PurchaseReceipt {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

#[account]
#[derive(InitSpace)]
pub struct ArticlePrivateContent {
    pub version: u8,
    pub article: Pubkey,
    pub author: Pubkey,
    pub permission: Pubkey,
    pub content_len: u32,
    pub content_hash: [u8; 32],
    pub content_version: u32,
    #[max_len(32768)]
    pub content: Vec<u8>,
    pub published: bool,
    pub bump: u8,
}

impl ArticlePrivateContent {
    pub const EMPTY_SPACE: usize = 8 + 1 + 32 + 32 + 32 + 4 + 32 + 4 + 4 + 1 + 1;

    pub fn space_for_content_len(content_len: usize) -> usize {
        Self::EMPTY_SPACE + content_len
    }

    pub fn content_capacity_from_account_len(account_len: usize) -> usize {
        account_len.saturating_sub(Self::EMPTY_SPACE)
    }
}
