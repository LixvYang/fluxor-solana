use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub platform_fee_receiver: Pubkey,
    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,
    pub min_price_lamports: u64,
    pub max_purchases_limit: u32,
}

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub platform_fee_receiver: Pubkey,
    pub platform_fee_bps: u16,
    pub reward_bps: u16,
    pub author_bps: u16,
    pub min_price_lamports: u64,
    pub max_purchases_limit: u32,
    pub paused: bool,
}

#[event]
pub struct ArticleCreated {
    pub article: Pubkey,
    pub article_id: u64,
    pub author: Pubkey,
    pub price_lamports: u64,
    pub max_purchases: u32,
    pub vault: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,
    pub content_hash: [u8; 32],
    pub created_at: i64,
}

#[event]
pub struct ContentUpdateStarted {
    pub article: Pubkey,
    pub author: Pubkey,
    pub content_version: u32,
    pub updated_at: i64,
}

#[event]
pub struct ContentChunkWritten {
    pub article: Pubkey,
    pub author: Pubkey,
    pub offset: u32,
    pub len: u32,
}

#[event]
pub struct ContentPublished {
    pub article: Pubkey,
    pub author: Pubkey,
    pub content_len: u32,
    pub content_hash: [u8; 32],
    pub content_version: u32,
    pub published_at: i64,
}

#[event]
pub struct ArticlePublishFinalized {
    pub article: Pubkey,
    pub author: Pubkey,
    pub content_len: u32,
    pub content_hash: [u8; 32],
    pub content_version: u32,
    pub finalized_at: i64,
}

#[event]
pub struct ArticlePurchased {
    pub article: Pubkey,
    pub article_id: u64,
    pub buyer: Pubkey,
    pub author: Pubkey,
    pub amount: u64,
    pub purchase_index: u32,
    pub purchased_at: i64,
}

#[event]
pub struct ArticleAccessGranted {
    pub article: Pubkey,
    pub buyer: Pubkey,
    pub permission: Pubkey,
    pub granted_at: i64,
}

#[event]
pub struct ReceiptAccessMarked {
    pub article: Pubkey,
    pub buyer: Pubkey,
    pub receipt: Pubkey,
    pub marked_at: i64,
}

#[event]
pub struct ReaderRewardClaimed {
    pub article: Pubkey,
    pub reader: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}

#[event]
pub struct AuthorRevenueClaimed {
    pub article: Pubkey,
    pub author: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}

#[event]
pub struct PlatformFeeClaimed {
    pub article: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}

#[event]
pub struct PrivateContentDelegated {
    pub article: Pubkey,
    pub private_content: Pubkey,
    pub author: Pubkey,
    pub validator: Option<Pubkey>,
    pub commit_frequency_ms: u32,
    pub delegated_at: i64,
}

#[event]
pub struct ContentPermissionCreated {
    pub article: Pubkey,
    pub private_content: Pubkey,
    pub permission: Pubkey,
    pub authority: Pubkey,
    pub created_at: i64,
}
