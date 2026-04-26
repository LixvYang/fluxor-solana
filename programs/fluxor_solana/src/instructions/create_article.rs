use anchor_lang::prelude::*;

use crate::{
    events::ArticleCreated, Article, ArticlePrivateContent, ArticleVault, GlobalConfig, FluxorError,
    ARTICLE_DRAFT, ARTICLE_SEED, CONTENT_SEED, GLOBAL_CONFIG_SEED, MAX_SUMMARY_BYTES,
    MAX_TITLE_BYTES, PROGRAM_VERSION, VAULT_SEED,
};

#[derive(Accounts)]
#[instruction(article_id: u64)]
pub struct CreateArticle<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_CONFIG_SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(
        init,
        payer = author,
        space = Article::SPACE,
        seeds = [ARTICLE_SEED, &article_id.to_le_bytes()],
        bump
    )]
    pub article: Account<'info, Article>,
    #[account(
        init,
        payer = author,
        space = ArticleVault::SPACE,
        seeds = [VAULT_SEED, article.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, ArticleVault>,
    #[account(
        init,
        payer = author,
        space = ArticlePrivateContent::EMPTY_SPACE,
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump
    )]
    pub private_content: Account<'info, ArticlePrivateContent>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateArticle>,
    article_id: u64,
    title: String,
    summary: String,
    price_lamports: u64,
    max_purchases: u32,
    permission: Pubkey,
    content_hash: [u8; 32],
) -> Result<()> {
    let config = &mut ctx.accounts.global_config;
    require!(!config.paused, FluxorError::PlatformPaused);
    require!(
        article_id == config.article_count,
        FluxorError::InvalidArticleId
    );
    require!(
        !title.is_empty() && title.as_bytes().len() <= MAX_TITLE_BYTES,
        FluxorError::InvalidTitle
    );
    require!(
        !summary.is_empty() && summary.as_bytes().len() <= MAX_SUMMARY_BYTES,
        FluxorError::InvalidSummary
    );
    require!(
        price_lamports >= config.min_price_lamports,
        FluxorError::PriceBelowMinimum
    );
    require!(
        max_purchases > 0 && max_purchases <= config.max_purchases_limit,
        FluxorError::InvalidMaxPurchases
    );

    let now = Clock::get()?.unix_timestamp;
    let article_key = ctx.accounts.article.key();
    let vault_key = ctx.accounts.vault.key();
    let private_content_key = ctx.accounts.private_content.key();

    let article = &mut ctx.accounts.article;
    article.version = PROGRAM_VERSION;
    article.id = article_id;
    article.author = ctx.accounts.author.key();
    article.title = title;
    article.summary = summary;
    article.price_lamports = price_lamports;
    article.max_purchases = max_purchases;
    article.purchase_count = 0;
    article.vault = vault_key;
    article.private_content = private_content_key;
    article.permission = permission;
    article.total_paid = 0;
    article.acc_reward_per_reader = 0;
    article.author_pending = 0;
    article.author_claimed = 0;
    article.platform_pending = 0;
    article.platform_claimed = 0;
    article.platform_fee_bps = config.platform_fee_bps;
    article.reward_bps = config.reward_bps;
    article.author_bps = config.author_bps;
    article.content_hash = content_hash;
    article.content_version = 0;
    article.status = ARTICLE_DRAFT;
    article.created_at = now;
    article.updated_at = now;
    article.bump = ctx.bumps.article;
    article.vault_bump = ctx.bumps.vault;

    let vault = &mut ctx.accounts.vault;
    vault.version = PROGRAM_VERSION;
    vault.article = article_key;
    vault.bump = ctx.bumps.vault;

    let content = &mut ctx.accounts.private_content;
    content.version = PROGRAM_VERSION;
    content.article = article_key;
    content.author = ctx.accounts.author.key();
    content.permission = permission;
    content.content_len = 0;
    content.content_hash = content_hash;
    content.content_version = 0;
    content.content = Vec::new();
    content.published = false;
    content.bump = ctx.bumps.private_content;

    config.article_count = config
        .article_count
        .checked_add(1)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    emit!(ArticleCreated {
        article: article_key,
        article_id,
        author: ctx.accounts.author.key(),
        price_lamports,
        max_purchases,
        vault: vault_key,
        private_content: private_content_key,
        permission,
        content_hash,
        created_at: now,
    });

    Ok(())
}
