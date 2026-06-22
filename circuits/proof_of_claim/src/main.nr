fn assert_private_impact(
    entitlement: u64,
    first_withdrawal: u64,
    second_withdrawal: u64,
    actor_is_privileged: bool,
    minimum_loss: u64,
) {
    assert(!actor_is_privileged);
    assert(minimum_loss > 0);

    // Both withdrawals independently pass the vulnerable stale check.
    assert(first_withdrawal <= entitlement);
    assert(second_withdrawal <= entitlement);

    let entitlement_wide: u128 = entitlement as u128;
    let first_wide: u128 = first_withdrawal as u128;
    let second_wide: u128 = second_withdrawal as u128;

    let total_withdrawal: u128 = first_wide + second_wide;

    assert(total_withdrawal > entitlement_wide);

    let demonstrated_loss: u128 =
        total_withdrawal - entitlement_wide;

    let threshold_wide: u128 = minimum_loss as u128;

    assert(demonstrated_loss >= threshold_wide);
}

fn derive_public_claim(
    program_id: Field,
    snapshot_id: Field,
    impact_rule_id: Field,
    minimum_loss: u64,
    researcher_secret: Field,
    entitlement: u64,
) -> [Field; 7] {
    let researcher_preimage: [Field; 2] = [
        1,
        researcher_secret,
    ];

    let researcher_commitment: Field =
        std::hash::pedersen_hash(
            researcher_preimage,
        );

    let state_preimage: [Field; 4] = [
        2,
        program_id,
        snapshot_id,
        entitlement as Field,
    ];

    let state_commitment: Field =
        std::hash::pedersen_hash(
            state_preimage,
        );

    let nullifier_preimage: [Field; 5] = [
        3,
        program_id,
        snapshot_id,
        impact_rule_id,
        researcher_secret,
    ];

    let nullifier: Field =
        std::hash::pedersen_hash(
            nullifier_preimage,
        );

    [
        program_id,
        snapshot_id,
        impact_rule_id,
        minimum_loss as Field,
        state_commitment,
        researcher_commitment,
        nullifier,
    ]
}

fn main(
    program_id: Field,
    snapshot_id: Field,
    impact_rule_id: Field,
    minimum_loss: u64,
    researcher_secret: Field,
    entitlement: u64,
    first_withdrawal: u64,
    second_withdrawal: u64,
    actor_is_privileged: bool,
) -> pub [Field; 7] {
    assert(program_id != 0);
    assert(snapshot_id != 0);
    assert(impact_rule_id != 0);
    assert(researcher_secret != 0);

    assert_private_impact(
        entitlement,
        first_withdrawal,
        second_withdrawal,
        actor_is_privileged,
        minimum_loss,
    );

    derive_public_claim(
        program_id,
        snapshot_id,
        impact_rule_id,
        minimum_loss,
        researcher_secret,
        entitlement,
    )
}

#[test]
fn accepts_and_binds_valid_claim() {
    let outputs = main(
        1001,
        42,
        1,
        50,
        987654321,
        100,
        100,
        100,
        false,
    );

    assert(outputs[0] == 1001);
    assert(outputs[1] == 42);
    assert(outputs[2] == 1);
    assert(outputs[3] == 50);

    let expected = derive_public_claim(
        1001,
        42,
        1,
        50,
        987654321,
        100,
    );

    assert(outputs[4] == expected[4]);
    assert(outputs[5] == expected[5]);
    assert(outputs[6] == expected[6]);
}

#[test]
fn produces_deterministic_nullifier() {
    let first = derive_public_claim(
        1001,
        42,
        1,
        50,
        987654321,
        100,
    );

    let second = derive_public_claim(
        1001,
        42,
        1,
        50,
        987654321,
        100,
    );

    assert(first[6] == second[6]);
}

#[test]
fn different_researcher_changes_nullifier() {
    let first = derive_public_claim(
        1001,
        42,
        1,
        50,
        987654321,
        100,
    );

    let second = derive_public_claim(
        1001,
        42,
        1,
        50,
        123456789,
        100,
    );

    assert(first[6] != second[6]);
    assert(first[5] != second[5]);
}

#[test]
fn different_snapshot_changes_nullifier() {
    let first = derive_public_claim(
        1001,
        42,
        1,
        50,
        987654321,
        100,
    );

    let second = derive_public_claim(
        1001,
        43,
        1,
        50,
        987654321,
        100,
    );

    assert(first[6] != second[6]);
    assert(first[4] != second[4]);
}

#[test(should_fail)]
fn rejects_privileged_actor() {
    let _ignored = main(
        1001,
        42,
        1,
        50,
        987654321,
        100,
        100,
        100,
        true,
    );
}

#[test(should_fail)]
fn rejects_loss_below_threshold() {
    let _ignored = main(
        1001,
        42,
        1,
        25,
        987654321,
        100,
        80,
        40,
        false,
    );
}

#[test(should_fail)]
fn rejects_zero_researcher_secret() {
    let _ignored = main(
        1001,
        42,
        1,
        50,
        0,
        100,
        100,
        100,
        false,
    );
}

#[test(should_fail)]
fn rejects_zero_program_identifier() {
    let _ignored = main(
        0,
        42,
        1,
        50,
        987654321,
        100,
        100,
        100,
        false,
    );
}
