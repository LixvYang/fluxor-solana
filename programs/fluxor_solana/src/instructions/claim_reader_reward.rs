use anchor_lang::prelude::*;

use crate::{
    events::ReaderRewardClaimed, utils::transfer_from_vault, Article, ArticleVault,
    PurchaseReceipt, FluxorError, ARTICLE_SEED, PRECISION, RECEIPT_SEED, VAULT_SEED,
};

#[derive(Accounts)]
pub struct ClaimReaderReward<'info> {
    #[account(mut)]
    pub reader: Signer<'info>,
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
        mut,
        seeds = [RECEIPT_SEED, article.key().as_ref(), reader.key().as_ref()],
        bump = receipt.bump,
        constraint = receipt.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = receipt.reader == reader.key() @ FluxorError::InvalidAccountRelationship
    )]
    pub receipt: Account<'info, PurchaseReceipt>,
}

pub fn handler(ctx: Context<ClaimReaderReward>) -> Result<()> {
    let article = &ctx.accounts.article;
    let pending_scaled = article
        .acc_reward_per_reader
        .checked_sub(ctx.accounts.receipt.reward_debt)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    let claimable = pending_scaled
        .checked_div(PRECISION)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    let claimable = u64::try_from(claimable).map_err(|_| FluxorError::ArithmeticOverflow)?;
    require!(claimable > 0, FluxorError::NothingToClaim);

    transfer_from_vault(
        &ctx.accounts.vault,
        &ctx.accounts.reader.to_account_info(),
        claimable,
    )?;

    let receipt = &mut ctx.accounts.receipt;
    receipt.reward_debt = receipt
        .reward_debt
        .checked_add(
            u128::from(claimable)
                .checked_mul(PRECISION)
                .ok_or(FluxorError::ArithmeticOverflow)?,
        )
        .ok_or(FluxorError::ArithmeticOverflow)?;
    receipt.claimed_rewards = receipt
        .claimed_rewards
        .checked_add(claimable)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    emit!(ReaderRewardClaimed {
        article: ctx.accounts.article.key(),
        reader: ctx.accounts.reader.key(),
        amount: claimable,
        claimed_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
