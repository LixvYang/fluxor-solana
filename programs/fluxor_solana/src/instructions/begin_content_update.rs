use anchor_lang::prelude::*;

use crate::{
    events::ContentUpdateStarted, Article, ArticlePrivateContent, FluxorError, ARTICLE_DISABLED,
    ARTICLE_SEED, CONTENT_SEED,
};

#[derive(Accounts)]
pub struct BeginContentUpdate<'info> {
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

pub fn handler(ctx: Context<BeginContentUpdate>) -> Result<()> {
    let article = &mut ctx.accounts.article;
    require!(
        article.status != ARTICLE_DISABLED,
        FluxorError::ArticleDisabled
    );

    let now = Clock::get()?.unix_timestamp;
    let content = &mut ctx.accounts.private_content;
    content.published = false;
    content.content_len = 0;
    content.content.clear();
    article.updated_at = now;

    emit!(ContentUpdateStarted {
        article: article.key(),
        author: ctx.accounts.author.key(),
        content_version: article.content_version,
        updated_at: now,
    });

    Ok(())
}
