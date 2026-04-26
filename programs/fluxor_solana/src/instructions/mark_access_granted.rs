use anchor_lang::prelude::*;

use crate::{
    events::ReceiptAccessMarked, Article, PurchaseReceipt, FluxorError, ARTICLE_SEED, RECEIPT_SEED,
};

#[derive(Accounts)]
pub struct MarkAccessGranted<'info> {
    pub buyer: Signer<'info>,
    #[account(
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump
    )]
    pub article: Account<'info, Article>,
    #[account(
        mut,
        seeds = [RECEIPT_SEED, article.key().as_ref(), buyer.key().as_ref()],
        bump = receipt.bump,
        constraint = receipt.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = receipt.reader == buyer.key() @ FluxorError::InvalidAccountRelationship
    )]
    pub receipt: Account<'info, PurchaseReceipt>,
}

pub fn handler(ctx: Context<MarkAccessGranted>) -> Result<()> {
    require!(
        !ctx.accounts.receipt.access_granted,
        FluxorError::AccessAlreadyGranted
    );

    ctx.accounts.receipt.access_granted = true;
    emit!(ReceiptAccessMarked {
        article: ctx.accounts.article.key(),
        buyer: ctx.accounts.buyer.key(),
        receipt: ctx.accounts.receipt.key(),
        marked_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
