#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rpc_port="${RPC_PORT:-8899}"
faucet_port="${FAUCET_PORT:-9900}"
ledger_dir="$repo_root/target/test-ledger-rpc"
validator_log="$repo_root/target/test-validator-rpc.log"
fluxor_program_id="DGABGfY3Jjp45DVAwzVPDBjdRVGF1LSYNmsrqjiNbX4H"
permission_program_id="ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"

cd "$repo_root"

NO_DNA=1 anchor build
bash "$repo_root/scripts/build-test-fixtures.sh"

mkdir -p "$repo_root/target"

solana-test-validator \
  --reset \
  --quiet \
  --ledger "$ledger_dir" \
  --rpc-port "$rpc_port" \
  --faucet-port "$faucet_port" \
  --bpf-program "$fluxor_program_id" "$repo_root/target/deploy/fluxor_solana.so" \
  --bpf-program "$permission_program_id" "$repo_root/target/deploy/mock_permission.so" \
  >"$validator_log" 2>&1 &

validator_pid="$!"
cleanup() {
  kill "$validator_pid" >/dev/null 2>&1 || true
  wait "$validator_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if solana --url "http://127.0.0.1:$rpc_port" cluster-version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! solana --url "http://127.0.0.1:$rpc_port" cluster-version >/dev/null 2>&1; then
  echo "solana-test-validator did not become healthy. Log: $validator_log" >&2
  exit 1
fi

ANCHOR_PROVIDER_URL="http://127.0.0.1:$rpc_port" \
  pnpm ts-mocha -p ./tsconfig.json -t 120000 tests/full_flow_rpc.ts
