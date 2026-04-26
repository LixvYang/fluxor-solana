use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

const INIT_PERMISSION_DISCRIMINATOR: u64 = 0;
const UPDATE_PERMISSION_DISCRIMINATOR: u64 = 1;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Member {
    pub flags: u8,
    pub pubkey: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MembersArgs {
    pub members: Option<Vec<Member>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct InitializePermissionArgs {
    pub permissioned_account: Pubkey,
    pub members: Option<Vec<Member>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Permission {
    pub discriminator: u8,
    pub bump: u8,
    pub permissioned_account: Pubkey,
    pub members: Option<Vec<Member>>,
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let mut data = instruction_data;
    let discriminator =
        u64::deserialize(&mut data).map_err(|_| ProgramError::InvalidInstructionData)?;

    if discriminator == INIT_PERMISSION_DISCRIMINATOR {
        return initialize_permission(accounts, data);
    }

    if discriminator == UPDATE_PERMISSION_DISCRIMINATOR {
        return update_permission(accounts, data);
    }

    Err(ProgramError::InvalidInstructionData)
}

fn initialize_permission(accounts: &[AccountInfo], mut data: &[u8]) -> ProgramResult {
    let args = InitializePermissionArgs::deserialize(&mut data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let account_iter = &mut accounts.iter();
    let permission_account = next_account_info(account_iter)?;

    if !permission_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let permission = Permission {
        discriminator: 0,
        bump: 0,
        permissioned_account: args.permissioned_account,
        members: args.members,
    };

    write_permission(permission_account, &permission)
}

fn update_permission(accounts: &[AccountInfo], mut data: &[u8]) -> ProgramResult {
    let args =
        MembersArgs::deserialize(&mut data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let account_iter = &mut accounts.iter();
    let authority = next_account_info(account_iter)?;
    let permissioned_account = next_account_info(account_iter)?;
    let permission_account = next_account_info(account_iter)?;

    if !authority.is_signer && !permissioned_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut permission = {
        let permission_data = permission_account.try_borrow_data()?;
        let mut permission_bytes: &[u8] = &permission_data;
        Permission::deserialize(&mut permission_bytes)
            .map_err(|_| ProgramError::InvalidAccountData)?
    };

    if permission.permissioned_account != *permissioned_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    permission.members = args.members;
    write_permission(permission_account, &permission)
}

fn write_permission(permission_account: &AccountInfo, permission: &Permission) -> ProgramResult {
    let mut permission_data = permission_account.try_borrow_mut_data()?;
    let serialized = borsh::to_vec(&permission).map_err(|_| ProgramError::InvalidAccountData)?;
    if serialized.len() > permission_data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }

    permission_data[..serialized.len()].copy_from_slice(&serialized);
    for byte in &mut permission_data[serialized.len()..] {
        *byte = 0;
    }

    Ok(())
}
