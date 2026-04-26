use anchor_lang::prelude::*;

use crate::{
    events::ContentChunkWritten, Article, ArticlePrivateContent, FluxorError, ARTICLE_DISABLED,
    ARTICLE_SEED, CONTENT_SEED, MAX_CONTENT_BYTES, MAX_CONTENT_CHUNK_BYTES,
};

#[derive(Accounts)]
#[instruction(offset: u32, chunk: Vec<u8>)]
pub struct WriteContentChunk<'info> {
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
        realloc = ArticlePrivateContent::space_for_content_len(
            ArticlePrivateContent::content_capacity_from_account_len(
                private_content.to_account_info().data_len()
            ).max((offset as usize).saturating_add(chunk.len()))
        ),
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

pub fn handler(ctx: Context<WriteContentChunk>, offset: u32, chunk: Vec<u8>) -> Result<()> {
    require!(
        ctx.accounts.article.status != ARTICLE_DISABLED,
        FluxorError::ArticleDisabled
    );
    require!(
        !ctx.accounts.private_content.published,
        FluxorError::ContentAlreadyPublished
    );
    require!(
        !chunk.is_empty() && chunk.len() <= MAX_CONTENT_CHUNK_BYTES,
        FluxorError::ContentChunkTooLarge
    );

    let offset = usize::try_from(offset).map_err(|_| FluxorError::InvalidContentOffset)?;
    let end = offset
        .checked_add(chunk.len())
        .ok_or(FluxorError::ArithmeticOverflow)?;
    require!(end <= MAX_CONTENT_BYTES, FluxorError::ContentTooLarge);

    let content = &mut ctx.accounts.private_content;
    if content.content.len() < end {
        content.content.resize(end, 0);
    }
    content.content[offset..end].copy_from_slice(&chunk);
    content.content_len =
        u32::try_from(content.content.len()).map_err(|_| FluxorError::ArithmeticOverflow)?;

    emit!(ContentChunkWritten {
        article: ctx.accounts.article.key(),
        author: ctx.accounts.author.key(),
        offset: offset as u32,
        len: chunk.len() as u32,
    });

    Ok(())
}
