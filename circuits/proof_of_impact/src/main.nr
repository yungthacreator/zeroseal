fn main(
    entitlement: u64,
    first_withdrawal: u64,
    second_withdrawal: u64,
    actor_is_privileged: bool,
    minimum_loss: pub u64,
) {
    // ZeroSeal accepts only an unprivileged exploitation path.
    assert(!actor_is_privileged);

    // The vulnerable contract validates both withdrawals against the
    // same stale entitlement instead of reducing it after the first call.
    assert(first_withdrawal <= entitlement);
    assert(second_withdrawal <= entitlement);

    // Widen before addition so the calculation cannot overflow u64.
    let entitlement_wide: u128 = entitlement as u128;
    let first_withdrawal_wide: u128 = first_withdrawal as u128;
    let second_withdrawal_wide: u128 = second_withdrawal as u128;

    let total_withdrawal: u128 =
        first_withdrawal_wide + second_withdrawal_wide;

    // The combined withdrawals must exceed the legitimate entitlement.
    assert(total_withdrawal > entitlement_wide);

    let demonstrated_loss: u128 =
        total_withdrawal - entitlement_wide;

    // The exact loss remains private. The proof reveals only that the
    // registered public threshold has been reached.
    let minimum_loss_wide: u128 = minimum_loss as u128;
    assert(demonstrated_loss >= minimum_loss_wide);
}

#[test]
fn accepts_unprivileged_double_withdrawal() {
    main(
        100,
        100,
        100,
        false,
        50,
    );
}

#[test(should_fail)]
fn rejects_privileged_actor() {
    main(
        100,
        100,
        100,
        true,
        50,
    );
}

#[test(should_fail)]
fn rejects_withdrawal_above_entitlement() {
    main(
        100,
        101,
        100,
        false,
        50,
    );
}

#[test(should_fail)]
fn rejects_when_total_does_not_exceed_entitlement() {
    main(
        100,
        60,
        40,
        false,
        1,
    );
}

#[test(should_fail)]
fn rejects_loss_below_registered_threshold() {
    main(
        100,
        80,
        40,
        false,
        25,
    );
}
