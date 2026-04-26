use anchor_lang::prelude::*;

use crate::{
    events::PlatformFeeClaimed, utils::transfer_from_vault, Article, ArticleVault, GlobalConfig,
    FluxorError, ARTICLE_SEED, GLOBAL_CONFIG_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct ClaimPlatformFee<'info> {
    #[account(
        seeds = [GLOBAL_CONFIG_SEED],
        bump = global_config.bump,
        has_one = admin @ FluxorError::InvalidAccountRelationship
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub platform_fee_receiver: SystemAccount<'info>,
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
}

pub fn handler(ctx: Context<ClaimPlatformFee>) -> Result<()> {
    require!(
        ctx.accounts.platform_fee_receiver.key()
            == ctx.accounts.global_config.platform_fee_receiver,
        FluxorError::InvalidPlatformFeeReceiver
    );

    let amount = ctx.accounts.article.platform_pending;
    require!(amount > 0, FluxorError::NothingToClaim);

    transfer_from_vault(
        &ctx.accounts.vault,
        &ctx.accounts.platform_fee_receiver.to_account_info(),
        amount,
    )?;

    let article = &mut ctx.accounts.article;
    article.platform_pending = 0;
    article.platform_claimed = article
        .platform_claimed
        .checked_add(amount)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    emit!(PlatformFeeClaimed {
        article: article.key(),
        receiver: ctx.accounts.platform_fee_receiver.key(),
        amount,
        claimed_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
