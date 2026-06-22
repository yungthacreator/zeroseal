#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT/.stellar/claim-registry-demo"
LOG="$STATE_DIR/demo.log"
STAGE="initialisation"

mkdir -p "$STATE_DIR"
: > "$LOG"

trap '
code=$?
echo
echo "ZEROSEAL DEMO FAILED"
echo "Stage: $STAGE"
echo "Log: $LOG"
exit "$code"
' ERR

cd "$ROOT"

PUBLIC_INPUTS="$ROOT/circuits/proof_of_claim/target/public_inputs"
PROOF="$ROOT/circuits/proof_of_claim/target/proof"
VK="$ROOT/circuits/proof_of_claim/target/vk"
VERIFIER_FILE="$ROOT/.stellar/claim-verifier-id"
REGISTRY_WASM="$ROOT/target/wasm32v1-none/release/claim_registry.wasm"
REGISTRY_ID_FILE="$STATE_DIR/claim-registry-id"
RECEIPT_BEFORE_FILE="$STATE_DIR/receipt-before.json"
RECEIPT_AFTER_FILE="$STATE_DIR/receipt-after.json"
SUBMIT_RECEIPT_FILE="$STATE_DIR/submit-receipt.json"
USED_FILE="$STATE_DIR/nullifier-used.json"
DUPLICATE_LOG="$STATE_DIR/duplicate-rejection.log"

echo "ZEROSEAL DEMO READY"

STAGE="repository preflight"

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "feat/claim-registry" ]]; then
    echo "Expected feat/claim-registry, found $BRANCH" >> "$LOG"
    exit 1
fi

for file in \
    "$PUBLIC_INPUTS" \
    "$PROOF" \
    "$VK" \
    "$VERIFIER_FILE"
do
    if [[ ! -s "$file" ]]; then
        echo "Missing or empty required file: $file" >> "$LOG"
        exit 1
    fi
done

PUBLIC_INPUT_SIZE="$(stat -c '%s' "$PUBLIC_INPUTS")"
PROOF_SIZE="$(stat -c '%s' "$PROOF")"

if [[ "$PUBLIC_INPUT_SIZE" -ne 224 ]]; then
    echo "Expected 224-byte public input, found $PUBLIC_INPUT_SIZE" >> "$LOG"
    exit 1
fi

if [[ "$PROOF_SIZE" -ne 14592 ]]; then
    echo "Expected 14592-byte proof, found $PROOF_SIZE" >> "$LOG"
    exit 1
fi

for private_path in \
    circuits/proof_of_claim/Prover.toml \
    circuits/proof_of_claim/target \
    circuits/proof_of_impact/Prover.toml \
    circuits/proof_of_impact/target \
    .stellar \
    target
do
    if ! git check-ignore -q "$private_path"; then
        echo "Required ignored path is not ignored: $private_path" >> "$LOG"
        exit 1
    fi
done

if git ls-files | grep -Eq \
'(^|/)Prover\.toml$|(^|/)target/|(^|/)\.stellar/|(^|/)\.contract_id$'
then
    echo "Private or generated material is tracked." >> "$LOG"
    exit 1
fi

STAGE="localnet health"

if ! docker inspect stellar-stellar-local >/dev/null 2>&1; then
    echo "The stellar-stellar-local container does not exist." >> "$LOG"
    exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' stellar-stellar-local)" != "true" ]]; then
    docker start stellar-stellar-local >> "$LOG" 2>&1
    sleep 8
fi

stellar keys fund alice --network local >> "$LOG" 2>&1

ALICE_ADDRESS="$(
    stellar keys public-key alice |
    tr -d '\r\n '
)"

if [[ ! "$ALICE_ADDRESS" =~ ^G[A-Z2-7]{55}$ ]]; then
    echo "Invalid Alice public address: $ALICE_ADDRESS" >> "$LOG"
    exit 1
fi

echo "STELLAR LOCALNET HEALTHY"

STAGE="contract build"

cargo fmt --all -- --check >> "$LOG" 2>&1
cargo test --workspace >> "$LOG" 2>&1
cargo clippy --workspace --all-targets -- -D warnings >> "$LOG" 2>&1
stellar contract build >> "$LOG" 2>&1

if [[ ! -s "$REGISTRY_WASM" ]]; then
    echo "Claim Registry WASM was not generated." >> "$LOG"
    exit 1
fi

STAGE="verifier loading"

VERIFIER_ID="$(
    tr -d '\r\n[:space:]' < "$VERIFIER_FILE"
)"

if [[ ! "$VERIFIER_ID" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "Invalid verifier contract ID: $VERIFIER_ID" >> "$LOG"
    exit 1
fi

echo "REAL ULTRAHONK VERIFIER LOADED"

STAGE="public input decoding"

mapfile -t CLAIM_FIELDS < <(
    python3 - "$PUBLIC_INPUTS" <<'PY'
from pathlib import Path
import sys

data = Path(sys.argv[1]).read_bytes()

if len(data) != 224:
    raise SystemExit(f"expected 224 bytes, got {len(data)}")

for index in range(7):
    print(data[index * 32:(index + 1) * 32].hex())
PY
)

if [[ "${#CLAIM_FIELDS[@]}" -ne 7 ]]; then
    echo "Failed to decode seven public claim fields." >> "$LOG"
    exit 1
fi

PROGRAM_ID="${CLAIM_FIELDS[0]}"
SNAPSHOT_ID="${CLAIM_FIELDS[1]}"
IMPACT_RULE_ID="${CLAIM_FIELDS[2]}"
MINIMUM_LOSS="${CLAIM_FIELDS[3]}"
STATE_COMMITMENT="${CLAIM_FIELDS[4]}"
RESEARCHER_COMMITMENT="${CLAIM_FIELDS[5]}"
NULLIFIER="${CLAIM_FIELDS[6]}"

PUBLIC_INPUTS_HEX="$(
    python3 - "$PUBLIC_INPUTS" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).read_bytes().hex())
PY
)"

PROOF_HEX="$(
    python3 - "$PROOF" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).read_bytes().hex())
PY
)"

STAGE="registry deployment"

DEPLOY_OUTPUT="$(
    stellar -q contract deploy \
        --wasm "$REGISTRY_WASM" \
        --source alice \
        --network local \
        -- \
        --verifier "$VERIFIER_ID" \
        2>> "$LOG"
)"

printf '%s\n' "$DEPLOY_OUTPUT" >> "$LOG"

REGISTRY_ID="$(
    printf '%s\n' "$DEPLOY_OUTPUT" |
    grep -Eo 'C[A-Z2-7]{55}' |
    tail -n 1
)"

if [[ ! "$REGISTRY_ID" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "Could not extract registry contract ID." >> "$LOG"
    exit 1
fi

printf '%s\n' "$REGISTRY_ID" > "$REGISTRY_ID_FILE"

echo "CLAIM REGISTRY DEPLOYED"
echo "Registry: $REGISTRY_ID"
echo "Verifier: $VERIFIER_ID"
echo "Researcher: $ALICE_ADDRESS"

STAGE="program registration"

stellar -q contract invoke \
    --id "$REGISTRY_ID" \
    --source alice \
    --network local \
    --send yes \
    -- \
    register_program \
    --owner "$ALICE_ADDRESS" \
    --program_id "$PROGRAM_ID" \
    --snapshot_id "$SNAPSHOT_ID" \
    --impact_rule_id "$IMPACT_RULE_ID" \
    --minimum_loss "$MINIMUM_LOSS" \
    --state_commitment "$STATE_COMMITMENT" \
    >> "$LOG" 2>&1

echo "PROGRAM REGISTERED"

STAGE="researcher registration"

stellar -q contract invoke \
    --id "$REGISTRY_ID" \
    --source alice \
    --network local \
    --send yes \
    -- \
    register_researcher \
    --researcher "$ALICE_ADDRESS" \
    --researcher_commitment "$RESEARCHER_COMMITMENT" \
    >> "$LOG" 2>&1

echo "RESEARCHER COMMITMENT REGISTERED"

STAGE="genuine proof submission"

SUBMIT_OUTPUT="$(
    stellar -q contract invoke \
        --id "$REGISTRY_ID" \
        --source alice \
        --network local \
        --send yes \
        -- \
        submit_claim \
        --researcher "$ALICE_ADDRESS" \
        --public_inputs "$PUBLIC_INPUTS_HEX" \
        --proof_bytes "$PROOF_HEX" \
        2>> "$LOG"
)"

printf '%s\n' "$SUBMIT_OUTPUT" > "$SUBMIT_RECEIPT_FILE"
printf '%s\n' "$SUBMIT_OUTPUT" >> "$LOG"

echo "PRIVATE CLAIM PROOF ACCEPTED"

STAGE="receipt query"

stellar -q contract invoke \
    --id "$REGISTRY_ID" \
    --source alice \
    --network local \
    --send no \
    -- \
    get_claim \
    --nullifier "$NULLIFIER" \
    > "$RECEIPT_BEFORE_FILE" \
    2>> "$LOG"

validate_receipt() {
    local receipt_file="$1"

    python3 - \
        "$receipt_file" \
        "$PROGRAM_ID" \
        "$ALICE_ADDRESS" \
        "$SNAPSHOT_ID" \
        "$IMPACT_RULE_ID" \
        "$MINIMUM_LOSS" \
        "$STATE_COMMITMENT" \
        "$RESEARCHER_COMMITMENT" \
        "$NULLIFIER" <<'PY'
import json
import sys
from pathlib import Path

(
    path,
    program_id,
    researcher,
    snapshot_id,
    impact_rule_id,
    minimum_loss,
    state_commitment,
    researcher_commitment,
    nullifier,
) = sys.argv[1:]

raw = Path(path).read_text(encoding="utf-8").strip()
value = json.loads(raw)

if isinstance(value, str):
    try:
        value = json.loads(value)
    except json.JSONDecodeError:
        pass

if not isinstance(value, dict):
    raise SystemExit(f"receipt is not a JSON object: {value!r}")

expected = {
    "program_id": program_id,
    "researcher": researcher,
    "snapshot_id": snapshot_id,
    "impact_rule_id": impact_rule_id,
    "minimum_loss": minimum_loss,
    "state_commitment": state_commitment,
    "researcher_commitment": researcher_commitment,
    "nullifier": nullifier,
}

for key, expected_value in expected.items():
    if key not in value:
        raise SystemExit(f"missing receipt field: {key}")

    actual = value[key]

    if isinstance(actual, str):
        actual_normalized = actual.removeprefix("0x").lower()
    elif isinstance(actual, list) and all(isinstance(x, int) for x in actual):
        actual_normalized = bytes(actual).hex()
    else:
        actual_normalized = str(actual)

    expected_normalized = expected_value.removeprefix("0x").lower()

    if key == "researcher":
        actual_normalized = str(actual)
        expected_normalized = expected_value

    if actual_normalized != expected_normalized:
        raise SystemExit(
            f"{key} mismatch: expected {expected_normalized}, "
            f"got {actual_normalized}"
        )

ledger = int(value.get("accepted_ledger", 0))
if ledger <= 0:
    raise SystemExit("accepted_ledger is missing or invalid")

print(json.dumps(value, sort_keys=True, separators=(",", ":")))
PY
}

CANONICAL_BEFORE="$(validate_receipt "$RECEIPT_BEFORE_FILE")"
printf '%s\n' "$CANONICAL_BEFORE" > "$STATE_DIR/receipt-before.canonical.json"

echo "PUBLIC RECEIPT RECORDED"

STAGE="nullifier state query"

stellar -q contract invoke \
    --id "$REGISTRY_ID" \
    --source alice \
    --network local \
    --send no \
    -- \
    is_nullifier_used \
    --nullifier "$NULLIFIER" \
    > "$USED_FILE" \
    2>> "$LOG"

python3 - "$USED_FILE" <<'PY'
import json
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text(encoding="utf-8").strip()
value = json.loads(raw)

if value is not True:
    raise SystemExit(f"expected true, got {value!r}")
PY

echo "NULLIFIER MARKED AS USED"

STAGE="duplicate nullifier rejection"

DUPLICATE_CODE=0

if DUPLICATE_OUTPUT="$(
    stellar contract invoke \
        --id "$REGISTRY_ID" \
        --source alice \
        --network local \
        --send yes \
        -- \
        submit_claim \
        --researcher "$ALICE_ADDRESS" \
        --public_inputs "$PUBLIC_INPUTS_HEX" \
        --proof_bytes "$PROOF_HEX" \
        2>&1
)"; then
    DUPLICATE_CODE=0
else
    DUPLICATE_CODE=$?
fi

printf '%s\n' "$DUPLICATE_OUTPUT" > "$DUPLICATE_LOG"
printf '%s\n' "$DUPLICATE_OUTPUT" >> "$LOG"

if [[ "$DUPLICATE_CODE" -eq 0 ]]; then
    echo "Duplicate claim unexpectedly succeeded." >> "$LOG"
    exit 1
fi

DUPLICATE_PLAIN="$(
    printf '%s\n' "$DUPLICATE_OUTPUT" |
    sed -E $'s/\\x1B\\[[0-9;]*[[:alpha:]]//g'
)"

if ! printf '%s\n' "$DUPLICATE_PLAIN" |
    grep -aEqi \
    'NullifierAlreadyUsed|Error\(Contract,[[:space:]]*#?14\)|Contract[^0-9]*#?14|contract error[^0-9]*14'
then
    echo "Duplicate invocation failed, but contract error 14 was not visible." >> "$LOG"
    echo "Duplicate output:" >> "$LOG"
    printf '%s\n' "$DUPLICATE_PLAIN" >> "$LOG"
    exit 1
fi

echo "DUPLICATE NULLIFIER REJECTED"

STAGE="receipt preservation verification"

stellar -q contract invoke \
    --id "$REGISTRY_ID" \
    --source alice \
    --network local \
    --send no \
    -- \
    get_claim \
    --nullifier "$NULLIFIER" \
    > "$RECEIPT_AFTER_FILE" \
    2>> "$LOG"

CANONICAL_AFTER="$(validate_receipt "$RECEIPT_AFTER_FILE")"
printf '%s\n' "$CANONICAL_AFTER" > "$STATE_DIR/receipt-after.canonical.json"

if [[ "$CANONICAL_BEFORE" != "$CANONICAL_AFTER" ]]; then
    echo "Stored receipt changed after duplicate rejection." >> "$LOG"
    exit 1
fi

echo "ORIGINAL RECEIPT PRESERVED"

STAGE="final repository safety"

git diff --check

if git ls-files |
   grep -Eq \
   '(^|/)Prover\.toml$|(^|/)target/|(^|/)\.stellar/|(^|/)\.contract_id$'
then
    echo "Private or generated material became tracked." >> "$LOG"
    exit 1
fi

echo "ZEROSEAL DEMO PASSED"
