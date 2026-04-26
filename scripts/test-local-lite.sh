#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root"
NO_DNA=1 anchor build
bash "$repo_root/scripts/build-test-fixtures.sh"
cargo test -p fluxor_solana --test full_flow_litesvm -- --nocapture
