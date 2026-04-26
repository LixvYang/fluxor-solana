use anchor_lang::prelude::*;

#[error_code]
pub enum FluxorError {
    #[msg("Fee bps must sum to 10000")]
    InvalidFeeSplit,
    #[msg("Maximum purchases limit must be greater than zero")]
    InvalidMaxPurchasesLimit,
    #[msg("Platform is paused")]
    PlatformPaused,
    #[msg("Article price is below the configured minimum")]
    PriceBelowMinimum,
    #[msg("Article maximum purchases is invalid")]
    InvalidMaxPurchases,
    #[msg("Article id must equal the current global article count")]
    InvalidArticleId,
    #[msg("Title is empty or too long")]
    InvalidTitle,
    #[msg("Summary is empty or too long")]
    InvalidSummary,
    #[msg("Article is not active")]
    ArticleNotActive,
    #[msg("Article is disabled")]
    ArticleDisabled,
    #[msg("Author cannot buy their own article")]
    AuthorCannotBuy,
    #[msg("Article is sold out")]
    SoldOut,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid account relationship")]
    InvalidAccountRelationship,
    #[msg("Content chunk is too large")]
    ContentChunkTooLarge,
    #[msg("Content offset is invalid")]
    InvalidContentOffset,
    #[msg("Content length exceeds the maximum")]
    ContentTooLarge,
    #[msg("Content is already published; begin an update first")]
    ContentAlreadyPublished,
    #[msg("Content is not published")]
    ContentNotPublished,
    #[msg("Content hash mismatch")]
    ContentHashMismatch,
    #[msg("Receipt access has already been granted")]
    AccessAlreadyGranted,
    #[msg("Invalid MagicBlock permission account")]
    InvalidPermissionAccount,
    #[msg("No rewards are currently claimable")]
    NothingToClaim,
    #[msg("Vault does not have enough claimable lamports")]
    InsufficientVaultBalance,
    #[msg("Invalid platform fee receiver")]
    InvalidPlatformFeeReceiver,
    #[msg("Account is already delegated to MagicBlock")]
    ContentAlreadyDelegated,
    #[msg("Unauthorized signer")]
    Unauthorized,
}
