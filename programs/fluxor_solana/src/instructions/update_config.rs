use anchor_lang::prelude::*;

use crate::{
    events::ConfigUpdated, utils::validate_fee_split, GlobalConfig, FluxorError, GLOBAL_CONFIG_SEED,
};

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_CONFIG_SEED],
        bump = global_config.bump,
        has_one = admin @ FluxorError::InvalidAccountRelationship
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    new_admin: Pubkey,
    platform_fee_receiver: Pubkey,
    platform_fee_bps: u16,
    reward_bps: u16,
    author_bps: u16,
    min_price_lamports: u64,
    max_purchases_limit: u32,
    paused: bool,
) -> Result<()> {
    validate_fee_split(platform_fee_bps, reward_bps, author_bps)?;
    require!(
        max_purchases_limit > 0,
        FluxorError::InvalidMaxPurchasesLimit
    );

    let config = &mut ctx.accounts.global_config;
    config.admin = new_admin;
    config.platform_fee_receiver = platform_fee_receiver;
    config.platform_fee_bps = platform_fee_bps;
    config.reward_bps = reward_bps;
    config.author_bps = author_bps;
    config.min_price_lamports = min_price_lamports;
    config.max_purchases_limit = max_purchases_limit;
    config.paused = paused;

    emit!(ConfigUpdated {
        admin: new_admin,
        platform_fee_receiver,
        platform_fee_bps,
        reward_bps,
        author_bps,
        min_price_lamports,
        max_purchases_limit,
        paused,
    });

    Ok(())
}
