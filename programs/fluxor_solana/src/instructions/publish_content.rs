use anchor_lang::prelude::*;

use crate::{
    events::ContentPublished, Article, ArticlePrivateContent, FluxorError, ARTICLE_ACTIVE,
    ARTICLE_DISABLED, ARTICLE_DRAFT, ARTICLE_SEED, CONTENT_SEED, MAX_CONTENT_BYTES,
};

#[derive(Accounts)]
pub struct PublishContent<'info> {
    #[account(
        mut,
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::InvalidAccountRelationship
    )]
    pub article: Account<'info, Article>,
    pub author: Signer<'info>,
    #[account(
        mut,
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump = private_content.bump,
        constraint = private_content.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.author == author.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.permission == article.permission @ FluxorError::InvalidAccountRelationship
    )]
    pub private_content: Account<'info, ArticlePrivateContent>,
}

pub fn handler(
    ctx: Context<PublishContent>,
    content_len: u32,
    content_hash: [u8; 32],
) -> Result<()> {
    let article = &mut ctx.accounts.article;
    require!(
        article.status != ARTICLE_DISABLED,
        FluxorError::ArticleDisabled
    );
    require!(
        !ctx.accounts.private_content.published,
        FluxorError::ContentAlreadyPublished
    );

    let content_len = usize::try_from(content_len).map_err(|_| FluxorError::ContentTooLarge)?;
    require!(
        content_len > 0 && content_len <= MAX_CONTENT_BYTES,
        FluxorError::ContentTooLarge
    );
    require!(
        content_len <= ctx.accounts.private_content.content.len(),
        FluxorError::ContentTooLarge
    );

    let actual_hash =
        solana_sha256_hasher::hash(&ctx.accounts.private_content.content[..content_len]).to_bytes();
    require!(actual_hash == content_hash, FluxorError::ContentHashMismatch);

    let now = Clock::get()?.unix_timestamp;
    article.content_hash = content_hash;
    article.content_version = article
        .content_version
        .checked_add(1)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    if article.status == ARTICLE_DRAFT {
        article.status = ARTICLE_ACTIVE;
    }
    article.updated_at = now;

    let content = &mut ctx.accounts.private_content;
    content.content.truncate(content_len);
    content.content_len = u32::try_from(content_len).map_err(|_| FluxorError::ArithmeticOverflow)?;
    content.content_hash = content_hash;
    content.content_version = article.content_version;
    content.published = true;

    emit!(ContentPublished {
        article: article.key(),
        author: ctx.accounts.author.key(),
        content_len: content.content_len,
        content_hash,
        content_version: content.content_version,
        published_at: now,
    });

    Ok(())
}
