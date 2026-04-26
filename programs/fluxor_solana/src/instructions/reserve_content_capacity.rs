use anchor_lang::prelude::*;

use crate::{
    Article, ArticlePrivateContent, FluxorError, ARTICLE_DISABLED, ARTICLE_SEED, CONTENT_SEED,
    MAX_CONTENT_BYTES,
};

#[derive(Accounts)]
#[instruction(capacity: u32)]
pub struct ReserveContentCapacity<'info> {
    #[account(
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::InvalidAccountRelationship
    )]
    pub article: Account<'info, Article>,
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(
        mut,
        realloc = ArticlePrivateContent::space_for_content_len(capacity as usize),
        realloc::payer = author,
        realloc::zero = false,
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump = private_content.bump,
        constraint = private_content.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.author == author.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.permission == article.permission @ FluxorError::InvalidAccountRelationship
    )]
    pub private_content: Account<'info, ArticlePrivateContent>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ReserveContentCapacity>, capacity: u32) -> Result<()> {
    require!(
        ctx.accounts.article.status != ARTICLE_DISABLED,
        FluxorError::ArticleDisabled
    );
    require!(
        !ctx.accounts.private_content.published,
        FluxorError::ContentAlreadyPublished
    );

    let capacity = usize::try_from(capacity).map_err(|_| FluxorError::ContentTooLarge)?;
    require!(capacity <= MAX_CONTENT_BYTES, FluxorError::ContentTooLarge);
    require!(
        capacity >= ctx.accounts.private_content.content.len(),
        FluxorError::InvalidContentOffset
    );

    Ok(())
}
