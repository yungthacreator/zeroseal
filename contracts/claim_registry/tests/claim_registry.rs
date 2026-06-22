use claim_registry::{ClaimRegistry, ClaimRegistryArgs, ClaimRegistryClient, ProgramConfig};
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env};
use std::panic::{catch_unwind, AssertUnwindSafe};

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    let verifier = Address::generate(&env);
    let contract_id = env.register(ClaimRegistry, ClaimRegistryArgs::__constructor(&verifier));
    (env, contract_id, verifier)
}

fn b(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn constructor_stores_verifier() {
    let (env, contract_id, verifier) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    assert_eq!(client.verifier(), verifier);
}

#[test]
fn program_registration_succeeds_with_authentication() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let program_id = b(&env, 1);
    let snapshot_id = b(&env, 2);
    let impact_rule_id = b(&env, 3);
    let minimum_loss = b(&env, 4);
    let state_commitment = b(&env, 5);
    env.mock_all_auths();
    client.register_program(
        &owner,
        &program_id,
        &snapshot_id,
        &impact_rule_id,
        &minimum_loss,
        &state_commitment,
    );
    let program = client.get_program(&program_id);
    assert_eq!(
        program,
        ProgramConfig {
            owner,
            program_id,
            snapshot_id,
            impact_rule_id,
            minimum_loss,
            state_commitment
        }
    );
}

#[test]
fn unauthorized_program_registration_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_program(
            &owner,
            &b(&env, 1),
            &b(&env, 2),
            &b(&env, 3),
            &b(&env, 4),
            &b(&env, 5),
        );
    }));
    assert!(result.is_err());
}

#[test]
fn duplicate_program_registration_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let program_id = b(&env, 1);
    let snapshot_id = b(&env, 2);
    let impact_rule_id = b(&env, 3);
    let minimum_loss = b(&env, 4);
    let state_commitment = b(&env, 5);
    env.mock_all_auths();
    client.register_program(
        &owner,
        &program_id,
        &snapshot_id,
        &impact_rule_id,
        &minimum_loss,
        &state_commitment,
    );
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_program(
            &owner,
            &program_id,
            &snapshot_id,
            &impact_rule_id,
            &minimum_loss,
            &state_commitment,
        );
    }));
    assert!(result.is_err());
}

#[test]
fn zero_program_fields_fail() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.mock_all_auths();
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_program(
            &owner,
            &b(&env, 0),
            &b(&env, 2),
            &b(&env, 3),
            &b(&env, 4),
            &b(&env, 5),
        );
    }));
    assert!(result.is_err());
}

#[test]
fn researcher_registration_succeeds_with_authentication() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    let commitment = b(&env, 9);
    env.mock_all_auths();
    client.register_researcher(&researcher, &commitment);
    assert_eq!(client.get_researcher_commitment(&researcher), commitment);
}

#[test]
fn unauthorized_researcher_registration_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_researcher(&researcher, &b(&env, 9));
    }));
    assert!(result.is_err());
}

#[test]
fn duplicate_researcher_registration_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    let commitment = b(&env, 9);
    env.mock_all_auths();
    client.register_researcher(&researcher, &commitment);
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_researcher(&researcher, &commitment);
    }));
    assert!(result.is_err());
}

#[test]
fn zero_researcher_commitment_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.register_researcher(&researcher, &b(&env, 0));
    }));
    assert!(result.is_err());
}

#[test]
fn decode_public_inputs_correctly() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let fields = [1u8, 2, 3, 4, 5, 6, 7];
    let mut raw = [0u8; 224];
    for (i, seed) in fields.iter().enumerate() {
        raw[i * 32..i * 32 + 32].fill(*seed);
    }
    let bytes = Bytes::from_array(&env, &raw);
    let decoded = client.decode_public_inputs(&bytes);
    assert_eq!(decoded.program_id, BytesN::from_array(&env, &[1u8; 32]));
    assert_eq!(decoded.snapshot_id, BytesN::from_array(&env, &[2u8; 32]));
    assert_eq!(decoded.impact_rule_id, BytesN::from_array(&env, &[3u8; 32]));
    assert_eq!(decoded.minimum_loss, BytesN::from_array(&env, &[4u8; 32]));
    assert_eq!(
        decoded.state_commitment,
        BytesN::from_array(&env, &[5u8; 32])
    );
    assert_eq!(
        decoded.researcher_commitment,
        BytesN::from_array(&env, &[6u8; 32])
    );
    assert_eq!(decoded.nullifier, BytesN::from_array(&env, &[7u8; 32]));
}

#[test]
fn field_byte_order_is_preserved() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let mut raw = [0u8; 224];
    raw[0] = 0x11;
    raw[31] = 0x22;
    raw[32] = 0x33;
    raw[63] = 0x44;
    let bytes = Bytes::from_array(&env, &raw);
    let decoded = client.decode_public_inputs(&bytes);
    let mut expected0 = [0u8; 32];
    expected0[0] = 0x11;
    expected0[31] = 0x22;
    let mut expected1 = [0u8; 32];
    expected1[0] = 0x33;
    expected1[31] = 0x44;
    assert_eq!(decoded.program_id, BytesN::from_array(&env, &expected0));
    assert_eq!(decoded.snapshot_id, BytesN::from_array(&env, &expected1));
}

#[test]
fn short_public_input_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let bytes = Bytes::from_array(&env, &[0u8; 223]);
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.decode_public_inputs(&bytes);
    }));
    assert!(result.is_err());
}

#[test]
fn long_public_input_fails() {
    let (env, contract_id, _) = setup();
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let bytes = Bytes::from_array(&env, &[0u8; 225]);
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.decode_public_inputs(&bytes);
    }));
    assert!(result.is_err());
}
