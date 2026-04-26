#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cargo build-sbf \
  --manifest-path "$repo_root/tests/fixtures/mock_permission/Cargo.toml" \
  --sbf-out-dir "$repo_root/target/deploy"
