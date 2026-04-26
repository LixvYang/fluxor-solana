use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
};

use crate::{
    events::ContentPermissionCreated, Article, ArticlePrivateContent, FluxorError, ARTICLE_SEED,
    CONTENT_SEED, MAGICBLOCK_PERMISSION_PROGRAM_ID, PERMISSION_CREATE_DISCRIMINATOR,
    PERMISSION_SEED,
};

const AUTHORITY_FLAG: u8 = 1 << 0;
const TX_LOGS_FLAG: u8 = 1 << 1;
const TX_BALANCES_FLAG: u8 = 1 << 2;
const TX_MESSAGE_FLAG: u8 = 1 << 3;
const ACCOUNT_SIGNATURES_FLAG: u8 = 1 << 4;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
struct MagicMember {
    flags: u8,
    pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct MagicMembersArgs {
    members: Option<Vec<MagicMember>>,
}

#[derive(Accounts)]
pub struct CreateContentPermission<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::Unauthorized
    )]
    pub article: Account<'info, Article>,
    #[account(
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump = private_content.bump,
        constraint = private_content.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.author == author.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.permission == article.permission @ FluxorError::InvalidAccountRelationship
    )]
    pub private_content: Account<'info, ArticlePrivateContent>,
    /// CHECK: Permission PDA owned and initialized by MagicBlock Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, private_content.key().as_ref()],
        bump,
        seeds::program = MAGICBLOCK_PERMISSION_PROGRAM_ID,
        constraint = permission.key() == article.permission @ FluxorError::InvalidAccountRelationship
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: MagicBlock Permission Program.
    #[account(address = MAGICBLOCK_PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateContentPermission>) -> Result<()> {
    let initial_flags = AUTHORITY_FLAG
        | TX_LOGS_FLAG
        | TX_BALANCES_FLAG
        | TX_MESSAGE_FLAG
        | ACCOUNT_SIGNATURES_FLAG;
    let args = MagicMembersArgs {
        members: Some(vec![MagicMember {
            flags: initial_flags,
            pubkey: ctx.accounts.author.key(),
        }]),
    };
    let mut data = PERMISSION_CREATE_DISCRIMINATOR.to_le_bytes().to_vec();
    args.serialize(&mut data)?;

    let instruction = Instruction {
        program_id: MAGICBLOCK_PERMISSION_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(ctx.accounts.private_content.key(), true),
            AccountMeta::new(ctx.accounts.permission.key(), false),
            AccountMeta::new(ctx.accounts.author.key(), true),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data,
    };

    let article_key = ctx.accounts.article.key();
    let bump = [ctx.accounts.private_content.bump];
    let signer_seeds: &[&[u8]] = &[CONTENT_SEED, article_key.as_ref(), &bump];

    invoke_signed(
        &instruction,
        &[
            ctx.accounts.private_content.to_account_info(),
            ctx.accounts.permission.to_account_info(),
            ctx.accounts.author.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    emit!(ContentPermissionCreated {
        article: ctx.accounts.article.key(),
        private_content: ctx.accounts.private_content.key(),
        permission: ctx.accounts.permission.key(),
        authority: ctx.accounts.author.key(),
        created_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
