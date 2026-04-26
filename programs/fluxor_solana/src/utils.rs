use anchor_lang::prelude::*;

use crate::{error::FluxorError, state::ArticleVault, BPS_DENOMINATOR, PRECISION};

pub fn validate_fee_split(platform_fee_bps: u16, reward_bps: u16, author_bps: u16) -> Result<()> {
    let total = u64::from(platform_fee_bps)
        .checked_add(u64::from(reward_bps))
        .and_then(|v| v.checked_add(u64::from(author_bps)))
        .ok_or(FluxorError::ArithmeticOverflow)?;
    require!(total == BPS_DENOMINATOR, FluxorError::InvalidFeeSplit);
    Ok(())
}

pub fn bps_amount(amount: u64, bps: u16) -> Result<u64> {
    let numerator = u128::from(amount)
        .checked_mul(u128::from(bps))
        .ok_or(FluxorError::ArithmeticOverflow)?;
    let value = numerator
        .checked_div(u128::from(BPS_DENOMINATOR))
        .ok_or(FluxorError::ArithmeticOverflow)?;
    u64::try_from(value).map_err(|_| FluxorError::ArithmeticOverflow.into())
}

pub fn reward_delta_per_reader(reward_pool: u64, previous_reader_count: u32) -> Result<u128> {
    let numerator = u128::from(reward_pool)
        .checked_mul(PRECISION)
        .ok_or(FluxorError::ArithmeticOverflow)?;
    numerator
        .checked_div(u128::from(previous_reader_count))
        .ok_or_else(|| FluxorError::ArithmeticOverflow.into())
}

pub fn transfer_from_vault<'info>(
    vault: &Account<'info, ArticleVault>,
    receiver: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let rent_minimum = Rent::get()?.minimum_balance(ArticleVault::SPACE);
    let vault_info = vault.to_account_info();
    let vault_balance = vault_info.lamports();
    let remaining = vault_balance
        .checked_sub(amount)
        .ok_or(FluxorError::InsufficientVaultBalance)?;

    require!(
        remaining >= rent_minimum,
        FluxorError::InsufficientVaultBalance
    );

    **vault_info.try_borrow_mut_lamports()? = remaining;
    let receiver_balance = receiver.lamports();
    **receiver.try_borrow_mut_lamports()? = receiver_balance
        .checked_add(amount)
        .ok_or(FluxorError::ArithmeticOverflow)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_default_fee_split() {
        assert!(validate_fee_split(1_000, 4_000, 5_000).is_ok());
        assert!(validate_fee_split(1_000, 4_001, 5_000).is_err());
    }

    #[test]
    fn calculates_bps_amounts() {
        let price = 1_000_000_000;
        assert_eq!(bps_amount(price, 1_000).unwrap(), 100_000_000);
        assert_eq!(bps_amount(price, 4_000).unwrap(), 400_000_000);
        assert_eq!(bps_amount(price, 5_000).unwrap(), 500_000_000);
    }

    #[test]
    fn calculates_reward_delta_per_reader() {
        let delta = reward_delta_per_reader(400_000_000, 2).unwrap();
        assert_eq!(delta, 200_000_000 * PRECISION);
    }
}
