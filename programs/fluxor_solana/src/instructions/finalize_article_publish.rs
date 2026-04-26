use anchor_lang::prelude::*;

use crate::{
    events::ArticlePublishFinalized, Article, FluxorError, ARTICLE_ACTIVE, ARTICLE_DISABLED,
    ARTICLE_DRAFT, ARTICLE_SEED,
};

#[derive(Accounts)]
pub struct FinalizeArticlePublish<'info> {
    pub author: Signer<'info>,
    #[account(
        mut,
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::InvalidAccountRelationship
    )]
    pub article: Account<'info, Article>,
}

pub fn handler(
    ctx: Context<FinalizeArticlePublish>,
    content_len: u32,
    content_hash: [u8; 32],
) -> Result<()> {
    let article = &mut ctx.accounts.article;
    require!(
        article.status != ARTICLE_DISABLED,
        FluxorError::ArticleDisabled
    );
    require!(content_len > 0, FluxorError::ContentTooLarge);
    require!(
        article.content_hash == content_hash,
        FluxorError::ContentHashMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    article.content_version = article
        .content_version
        .checked_add(1)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    if article.status == ARTICLE_DRAFT {
        article.status = ARTICLE_ACTIVE;
    }
    article.updated_at = now;

    emit!(ArticlePublishFinalized {
        article: article.key(),
        author: ctx.accounts.author.key(),
        content_len,
        content_hash,
        content_version: article.content_version,
        finalized_at: now,
    });

    Ok(())
}
