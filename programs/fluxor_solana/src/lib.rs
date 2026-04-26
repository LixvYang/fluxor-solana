pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::{
    BeginContentUpdate, BuyArticle, ClaimAuthorRevenue, ClaimPlatformFee, ClaimReaderReward,
    CreateArticle, CreateContentPermission, DelegateContent, FinalizeArticlePublish, GrantAccess,
    GrantPerAccess, InitializeConfig, MarkAccessGranted, PublishContent, PublishPrivateContent,
    ReserveContentCapacity, UpdateConfig, WriteContentChunk,
};
pub(crate) use instructions::{
    __client_accounts_begin_content_update, __client_accounts_buy_article,
    __client_accounts_claim_author_revenue, __client_accounts_claim_platform_fee,
    __client_accounts_claim_reader_reward, __client_accounts_create_article,
    __client_accounts_create_content_permission, __client_accounts_delegate_content,
    __client_accounts_finalize_article_publish, __client_accounts_grant_access,
    __client_accounts_grant_per_access, __client_accounts_initialize_config,
    __client_accounts_mark_access_granted, __client_accounts_publish_content,
    __client_accounts_publish_private_content, __client_accounts_reserve_content_capacity,
    __client_accounts_update_config, __client_accounts_write_content_chunk,
};
pub use state::*;

declare_id!("CMq4uBd2ztptM1QZ4rFc7RTwgUC8ez4LEth63H6L6RQg");

#[program]
pub mod fluxor_solana {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        platform_fee_receiver: Pubkey,
        platform_fee_bps: u16,
        reward_bps: u16,
        author_bps: u16,
        min_price_lamports: u64,
        max_purchases_limit: u32,
    ) -> Result<()> {
        instructions::initialize_config::handler(
            ctx,
            platform_fee_receiver,
            platform_fee_bps,
            reward_bps,
            author_bps,
            min_price_lamports,
            max_purchases_limit,
        )
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin: Pubkey,
        platform_fee_receiver: Pubkey,
        platform_fee_bps: u16,
        reward_bps: u16,
        author_bps: u16,
        min_price_lamports: u64,
        max_purchases_limit: u32,
        paused: bool,
    ) -> Result<()> {
        instructions::update_config::handler(
            ctx,
            new_admin,
            platform_fee_receiver,
            platform_fee_bps,
            reward_bps,
            author_bps,
            min_price_lamports,
            max_purchases_limit,
            paused,
        )
    }

    pub fn create_article(
        ctx: Context<CreateArticle>,
        article_id: u64,
        title: String,
        summary: String,
        price_lamports: u64,
        max_purchases: u32,
        permission: Pubkey,
        content_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_article::handler(
            ctx,
            article_id,
            title,
            summary,
            price_lamports,
            max_purchases,
            permission,
            content_hash,
        )
    }

    pub fn begin_content_update(ctx: Context<BeginContentUpdate>) -> Result<()> {
        instructions::begin_content_update::handler(ctx)
    }

    pub fn write_content_chunk(
        ctx: Context<WriteContentChunk>,
        offset: u32,
        chunk: Vec<u8>,
    ) -> Result<()> {
        instructions::write_content_chunk::handler(ctx, offset, chunk)
    }

    pub fn reserve_content_capacity(
        ctx: Context<ReserveContentCapacity>,
        capacity: u32,
    ) -> Result<()> {
        instructions::reserve_content_capacity::handler(ctx, capacity)
    }

    pub fn publish_content(
        ctx: Context<PublishContent>,
        content_len: u32,
        content_hash: [u8; 32],
    ) -> Result<()> {
        // Single-layer local/mock path. Production PER clients should use
        // publish_private_content on PER, then finalize_article_publish on base.
        instructions::publish_content::handler(ctx, content_len, content_hash)
    }

    pub fn publish_private_content(
        ctx: Context<PublishPrivateContent>,
        content_len: u32,
        content_hash: [u8; 32],
    ) -> Result<()> {
        instructions::publish_private_content::handler(ctx, content_len, content_hash)
    }

    pub fn finalize_article_publish(
        ctx: Context<FinalizeArticlePublish>,
        content_len: u32,
        content_hash: [u8; 32],
    ) -> Result<()> {
        instructions::finalize_article_publish::handler(ctx, content_len, content_hash)
    }

    pub fn buy_article(ctx: Context<BuyArticle>) -> Result<()> {
        instructions::buy_article::handler(ctx)
    }

    pub fn delegate_content(
        ctx: Context<DelegateContent>,
        validator: Option<Pubkey>,
    ) -> Result<()> {
        instructions::delegate_content::handler(ctx, validator)
    }

    pub fn create_content_permission(ctx: Context<CreateContentPermission>) -> Result<()> {
        instructions::create_content_permission::handler(ctx)
    }

    pub fn grant_access(ctx: Context<GrantAccess>) -> Result<()> {
        // Single-layer local/mock path. Production PER clients should use
        // grant_per_access on PER, then mark_access_granted on base.
        instructions::grant_access::handler(ctx)
    }

    pub fn grant_per_access(ctx: Context<GrantPerAccess>) -> Result<()> {
        instructions::grant_per_access::handler(ctx)
    }

    pub fn mark_access_granted(ctx: Context<MarkAccessGranted>) -> Result<()> {
        instructions::mark_access_granted::handler(ctx)
    }

    pub fn claim_reader_reward(ctx: Context<ClaimReaderReward>) -> Result<()> {
        instructions::claim_reader_reward::handler(ctx)
    }

    pub fn claim_author_revenue(ctx: Context<ClaimAuthorRevenue>) -> Result<()> {
        instructions::claim_author_revenue::handler(ctx)
    }

    pub fn claim_platform_fee(ctx: Context<ClaimPlatformFee>) -> Result<()> {
        instructions::claim_platform_fee::handler(ctx)
    }
}
