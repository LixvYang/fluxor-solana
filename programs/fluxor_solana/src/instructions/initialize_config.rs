use anchor_lang::prelude::*;

use crate::{
    events::ConfigInitialized, utils::validate_fee_split, GlobalConfig, GLOBAL_CONFIG_SEED,
    PROGRAM_VERSION,
};

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = GlobalConfig::SPACE,
        seeds = [GLOBAL_CONFIG_SEED],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    platform_fee_receiver: Pubkey,
    platform_fee_bps: u16,
    reward_bps: u16,
    author_bps: u16,
    min_price_lamports: u64,
    max_purchases_limit: u32,
) -> Result<()> {
    validate_fee_split(platform_fee_bps, reward_bps, author_bps)?;
    require!(
        max_purchases_limit > 0,
        crate::FluxorError::InvalidMaxPurchasesLimit
    );

    let config = &mut ctx.accounts.global_config;
    config.version = PROGRAM_VERSION;
    config.admin = ctx.accounts.admin.key();
    config.platform_fee_receiver = platform_fee_receiver;
    config.platform_fee_bps = platform_fee_bps;
    config.reward_bps = reward_bps;
    config.author_bps = author_bps;
    config.min_price_lamports = min_price_lamports;
    config.max_purchases_limit = max_purchases_limit;
    config.article_count = 0;
    config.paused = false;
    config.bump = ctx.bumps.global_config;

    emit!(ConfigInitialized {
        admin: config.admin,
        platform_fee_receiver,
        platform_fee_bps,
        reward_bps,
        author_bps,
        min_price_lamports,
        max_purchases_limit,
    });

    Ok(())
}
