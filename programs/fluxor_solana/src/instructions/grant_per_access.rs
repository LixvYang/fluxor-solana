use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
};

use crate::{
    events::ArticleAccessGranted, Article, ArticlePrivateContent, PurchaseReceipt, FluxorError,
    ARTICLE_SEED, CONTENT_SEED, MAGICBLOCK_PERMISSION_PROGRAM_ID, RECEIPT_SEED,
};

const UPDATE_PERMISSION_DISCRIMINATOR: u64 = 1;
const TX_MESSAGE_FLAG: u8 = 1 << 3;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
struct MagicMember {
    flags: u8,
    pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct MagicMembersArgs {
    members: Option<Vec<MagicMember>>,
}

#[derive(AnchorDeserialize)]
struct MagicPermission {
    _discriminator: u8,
    _bump: u8,
    permissioned_account: Pubkey,
    members: Option<Vec<MagicMember>>,
}

#[derive(Accounts)]
pub struct GrantPerAccess<'info> {
    pub buyer: Signer<'info>,
    #[account(
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump
    )]
    pub article: Account<'info, Article>,
    #[account(
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump = private_content.bump,
        constraint = private_content.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = private_content.permission == article.permission @ FluxorError::InvalidAccountRelationship
    )]
    pub private_content: Account<'info, ArticlePrivateContent>,
    #[account(
        seeds = [RECEIPT_SEED, article.key().as_ref(), buyer.key().as_ref()],
        bump = receipt.bump,
        constraint = receipt.article == article.key() @ FluxorError::InvalidAccountRelationship,
        constraint = receipt.reader == buyer.key() @ FluxorError::InvalidAccountRelationship
    )]
    pub receipt: Account<'info, PurchaseReceipt>,
    /// CHECK: Permission account is owned and interpreted by MagicBlock PER.
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: MagicBlock Permission Program.
    #[account(address = MAGICBLOCK_PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<GrantPerAccess>) -> Result<()> {
    require!(
        ctx.accounts.permission.key() == ctx.accounts.article.permission,
        FluxorError::InvalidAccountRelationship
    );

    update_magicblock_permission(&ctx)?;

    let granted_at = Clock::get()?.unix_timestamp;
    emit!(ArticleAccessGranted {
        article: ctx.accounts.article.key(),
        buyer: ctx.accounts.buyer.key(),
        permission: ctx.accounts.permission.key(),
        granted_at,
    });

    Ok(())
}

fn update_magicblock_permission(ctx: &Context<GrantPerAccess>) -> Result<()> {
    let mut members = {
        let permission_data = ctx.accounts.permission.try_borrow_data()?;
        let mut permission_data_ref: &[u8] = &permission_data;
        let permission_state = MagicPermission::deserialize(&mut permission_data_ref)
            .map_err(|_| error!(FluxorError::InvalidPermissionAccount))?;

        require!(
            permission_state.permissioned_account == ctx.accounts.private_content.key(),
            FluxorError::InvalidPermissionAccount
        );

        permission_state.members.unwrap_or_default()
    };

    match members
        .iter_mut()
        .find(|member| member.pubkey == ctx.accounts.buyer.key())
    {
        Some(member) => member.flags |= TX_MESSAGE_FLAG,
        None => members.push(MagicMember {
            flags: TX_MESSAGE_FLAG,
            pubkey: ctx.accounts.buyer.key(),
        }),
    }

    let args = MagicMembersArgs {
        members: Some(members),
    };
    let mut data = Vec::new();
    UPDATE_PERMISSION_DISCRIMINATOR.serialize(&mut data)?;
    args.serialize(&mut data)?;

    let instruction = Instruction {
        program_id: MAGICBLOCK_PERMISSION_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(ctx.accounts.buyer.key(), false),
            AccountMeta::new_readonly(ctx.accounts.private_content.key(), true),
            AccountMeta::new(ctx.accounts.permission.key(), false),
        ],
        data,
    };

    let article_key = ctx.accounts.article.key();
    let bump = [ctx.accounts.private_content.bump];
    let signer_seeds: &[&[u8]] = &[CONTENT_SEED, article_key.as_ref(), &bump];

    invoke_signed(
        &instruction,
        &[
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.private_content.to_account_info(),
            ctx.accounts.permission.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    Ok(())
}
