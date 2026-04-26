use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
        system_instruction, system_program,
    },
};

use crate::{
    events::PrivateContentDelegated, Article, FluxorError, ARTICLE_SEED, CONTENT_SEED,
    DELEGATE_BUFFER_SEED, DELEGATION_METADATA_SEED, DELEGATION_RECORD_SEED,
    DLP_DEFAULT_COMMIT_FREQUENCY_MS, DLP_DELEGATE_DISCRIMINATOR, MAGICBLOCK_DELEGATION_PROGRAM_ID,
};

#[derive(AnchorSerialize)]
struct DelegateArgs {
    commit_frequency_ms: u32,
    seeds: Vec<Vec<u8>>,
    validator: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct DelegateContent<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(
        seeds = [ARTICLE_SEED, &article.id.to_le_bytes()],
        bump = article.bump,
        has_one = author @ FluxorError::Unauthorized
    )]
    pub article: Account<'info, Article>,
    /// CHECK: PDA being delegated. Validated by seeds; owner is checked at runtime.
    #[account(
        mut,
        seeds = [CONTENT_SEED, article.key().as_ref()],
        bump
    )]
    pub private_content: UncheckedAccount<'info>,
    /// CHECK: Owner-program-owned buffer PDA used to stage account data during delegation.
    #[account(
        mut,
        seeds = [DELEGATE_BUFFER_SEED, private_content.key().as_ref()],
        bump
    )]
    pub buffer: UncheckedAccount<'info>,
    /// CHECK: Delegation record PDA, owned by the delegation program.
    #[account(
        mut,
        seeds = [DELEGATION_RECORD_SEED, private_content.key().as_ref()],
        bump,
        seeds::program = MAGICBLOCK_DELEGATION_PROGRAM_ID
    )]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: Delegation metadata PDA, owned by the delegation program.
    #[account(
        mut,
        seeds = [DELEGATION_METADATA_SEED, private_content.key().as_ref()],
        bump,
        seeds::program = MAGICBLOCK_DELEGATION_PROGRAM_ID
    )]
    pub delegation_metadata: UncheckedAccount<'info>,
    /// CHECK: Owner program; must equal this program's id.
    #[account(address = crate::ID)]
    pub owner_program: UncheckedAccount<'info>,
    /// CHECK: MagicBlock Delegation Program.
    #[account(address = MAGICBLOCK_DELEGATION_PROGRAM_ID)]
    pub delegation_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DelegateContent>, validator: Option<Pubkey>) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.private_content.owner,
        crate::ID,
        FluxorError::ContentAlreadyDelegated
    );

    let article_key = ctx.accounts.article.key();
    let pc_key = ctx.accounts.private_content.key();
    let buffer_key = ctx.accounts.buffer.key();

    let pc_bump = ctx.bumps.private_content;
    let buffer_bump = ctx.bumps.buffer;

    let pc_seeds: &[&[u8]] = &[CONTENT_SEED, article_key.as_ref(), &[pc_bump]];
    let buffer_seeds: &[&[u8]] = &[DELEGATE_BUFFER_SEED, pc_key.as_ref(), &[buffer_bump]];

    let data_len = ctx.accounts.private_content.data_len();
    let rent = Rent::get()?;
    let buffer_lamports = rent.minimum_balance(data_len);

    // 1. Create the buffer PDA, owned by this program, sized to current pda data length.
    let create_buffer_ix = system_instruction::create_account(
        &ctx.accounts.author.key(),
        &buffer_key,
        buffer_lamports,
        data_len as u64,
        &crate::ID,
    );
    invoke_signed(
        &create_buffer_ix,
        &[
            ctx.accounts.author.to_account_info(),
            ctx.accounts.buffer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[buffer_seeds],
    )?;

    // 2. Copy private_content -> buffer.
    {
        let src = ctx.accounts.private_content.try_borrow_data()?;
        let mut dst = ctx.accounts.buffer.try_borrow_mut_data()?;
        dst.copy_from_slice(&src);
    }

    // 3. Zero the private_content data.
    {
        let mut data = ctx.accounts.private_content.try_borrow_mut_data()?;
        for byte in data.iter_mut() {
            *byte = 0;
        }
    }

    // 4. Reassign private_content owner: first directly hand it back to the system
    //    program (allowed because we still own it and its data is zeroed), then
    //    CPI into the system program to assign it to the delegation program.
    ctx.accounts
        .private_content
        .to_account_info()
        .assign(&system_program::ID);

    let assign_ix = system_instruction::assign(&pc_key, &MAGICBLOCK_DELEGATION_PROGRAM_ID);
    invoke_signed(
        &assign_ix,
        &[
            ctx.accounts.private_content.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[pc_seeds],
    )?;

    // 5. CPI into the delegation program with the canonical Delegate ix layout.
    let delegate_args = DelegateArgs {
        commit_frequency_ms: DLP_DEFAULT_COMMIT_FREQUENCY_MS,
        seeds: vec![CONTENT_SEED.to_vec(), article_key.as_ref().to_vec()],
        validator,
    };
    let mut data = DLP_DELEGATE_DISCRIMINATOR.to_le_bytes().to_vec();
    delegate_args.serialize(&mut data)?;

    let delegate_ix = Instruction {
        program_id: MAGICBLOCK_DELEGATION_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.author.key(), true),
            AccountMeta::new(pc_key, true),
            AccountMeta::new_readonly(crate::ID, false),
            AccountMeta::new(buffer_key, false),
            AccountMeta::new(ctx.accounts.delegation_record.key(), false),
            AccountMeta::new(ctx.accounts.delegation_metadata.key(), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data,
    };
    invoke_signed(
        &delegate_ix,
        &[
            ctx.accounts.author.to_account_info(),
            ctx.accounts.private_content.to_account_info(),
            ctx.accounts.owner_program.to_account_info(),
            ctx.accounts.buffer.to_account_info(),
            ctx.accounts.delegation_record.to_account_info(),
            ctx.accounts.delegation_metadata.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[pc_seeds],
    )?;

    // 6. Close the buffer back to the author. The buffer is still owned by this
    //    program after the delegate CPI, so shrink its data first, then drain its
    //    lamports, then assign it back to the system program.
    let buffer_info = ctx.accounts.buffer.to_account_info();
    buffer_info.resize(0)?;
    let lamports_to_recover = buffer_info.lamports();
    {
        let mut buf_lamports = buffer_info.try_borrow_mut_lamports()?;
        let mut author_lamports = ctx.accounts.author.try_borrow_mut_lamports()?;
        **author_lamports = author_lamports
            .checked_add(lamports_to_recover)
            .ok_or(FluxorError::ArithmeticOverflow)?;
        **buf_lamports = 0;
    }
    buffer_info.assign(&system_program::ID);

    let now = Clock::get()?.unix_timestamp;
    emit!(PrivateContentDelegated {
        article: article_key,
        private_content: pc_key,
        author: ctx.accounts.author.key(),
        validator,
        commit_frequency_ms: DLP_DEFAULT_COMMIT_FREQUENCY_MS,
        delegated_at: now,
    });

    Ok(())
}
