use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    events::ArticlePurchased,
    utils::{bps_amount, reward_delta_per_reader},
    Article, ArticleVault, GlobalConfig, PurchaseReceipt, FluxorError, ARTICLE_ACTIVE, ARTICLE_SEED,
    GLOBAL_CONFIG_SEED, PRECISION, PROGRAM_VERSION, RECEIPT_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct BuyArticle<'info> {
    #[account(
        seeds = [GLOBAL_CONFIG_SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump
    )]
    pub article: Account<'info, Article>,
    #[account(
        mut,
        seeds = [VAULT_SEED, article.key().as_ref()],
        bump = vault.bump,
        constraint = vault.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = article.vault == vault.key() @ FluxorError::InvalidAccountRelationship
    )]
    pub vault: Account<'info, ArticleVault>,
    #[account(
        init,
        payer = buyer,
        space = PurchaseReceipt::SPACE,
        seeds = [RECEIPT_SEED, article.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, PurchaseReceipt>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyArticle>) -> Result<()> {
    require!(
        !ctx.accounts.global_config.paused,
        FluxorError::PlatformPaused
    );
    require!(
        ctx.accounts.article.status == ARTICLE_ACTIVE,
        FluxorError::ArticleNotActive
    );
    require!(
        ctx.accounts.buyer.key() != ctx.accounts.article.author,
        FluxorError::AuthorCannotBuy
    );
    require!(
        ctx.accounts.article.purchase_count < ctx.accounts.article.max_purchases,
        FluxorError::SoldOut
    );

    let price = ctx.accounts.article.price_lamports;
    transfer(
        CpiContext::new(
            anchor_lang::system_program::ID,
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        price,
    )?;

    let article = &mut ctx.accounts.article;
    let platform_fee = bps_amount(price, article.platform_fee_bps)?;
    let reward_pool = bps_amount(price, article.reward_bps)?;
    let author_amount = price
        .checked_sub(platform_fee)
        .and_then(|v| v.checked_sub(reward_pool))
        .ok_or(FluxorError::ArithmeticOverflow)?;

    if article.purchase_count == 0 {
        article.author_pending = article
            .author_pending
            .checked_add(author_amount)
            .and_then(|v| v.checked_add(reward_pool))
            .ok_or(FluxorError::ArithmeticOverflow)?;
    } else {
        let delta = reward_delta_per_reader(reward_pool, article.purchase_count)?;
        article.acc_reward_per_reader = article
            .acc_reward_per_reader
            .checked_add(delta)
            .ok_or(FluxorError::ArithmeticOverflow)?;
        article.author_pending = article
            .author_pending
            .checked_add(author_amount)
            .ok_or(FluxorError::ArithmeticOverflow)?;
    }

    article.platform_pending = article
        .platform_pending
        .checked_add(platform_fee)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    let purchase_index = article.purchase_count;
    let purchased_at = Clock::get()?.unix_timestamp;

    let receipt = &mut ctx.accounts.receipt;
    receipt.version = PROGRAM_VERSION;
    receipt.article = article.key();
    receipt.reader = ctx.accounts.buyer.key();
    receipt.purchase_index = purchase_index;
    receipt.paid_lamports = price;
    receipt.reward_debt = article.acc_reward_per_reader;
    receipt.claimed_rewards = 0;
    receipt.access_granted = false;
    receipt.purchased_at = purchased_at;
    receipt.bump = ctx.bumps.receipt;

    article.purchase_count = article
        .purchase_count
        .checked_add(1)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    article.total_paid = article
        .total_paid
        .checked_add(price)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    // Sanity check documents the unit used by receipts and frontend calculations.
    require!(
        receipt.reward_debt <= article.acc_reward_per_reader
            && article.acc_reward_per_reader % PRECISION < PRECISION,
        FluxorError::ArithmeticOverflow
    );

    emit!(ArticlePurchased {
        article: article.key(),
        article_id: article.id,
        buyer: ctx.accounts.buyer.key(),
        author: article.author,
        amount: price,
        purchase_index,
        purchased_at,
    });

    Ok(())
}
