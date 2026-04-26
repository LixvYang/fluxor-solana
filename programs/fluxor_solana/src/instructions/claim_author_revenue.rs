use anchor_lang::prelude::*;

use crate::{
    events::AuthorRevenueClaimed, utils::transfer_from_vault, Article, ArticleVault, FluxorError,
    ARTICLE_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct ClaimAuthorRevenue<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(
        mut,
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::InvalidAccountRelationship
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

pub fn handler(ctx: Context<ClaimAuthorRevenue>) -> Result<()> {
    let amount = ctx.accounts.article.author_pending;
    require!(amount > 0, FluxorError::NothingToClaim);

    transfer_from_vault(
        &ctx.accounts.vault,
        &ctx.accounts.author.to_account_info(),
        amount,
    )?;

    let article = &mut ctx.accounts.article;
    article.author_pending = 0;
    article.author_claimed = article
        .author_claimed
        .checked_add(amount)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    emit!(AuthorRevenueClaimed {
        article: article.key(),
        author: ctx.accounts.author.key(),
        amount,
        claimed_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
