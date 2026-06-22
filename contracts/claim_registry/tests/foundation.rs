mod common;

use claim_registry::{ClaimRegistryClient, Error, ProgramConfig};
use common::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN};

#[test]
fn constructor_stores_verifier() {
    let (env, contract_id, verifier) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    assert_eq!(client.verifier(), verifier);
}

#[test]
fn program_registration_succeeds_with_authentication() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let program_id = b(&env, 1);
    env.mock_all_auths();
    register_program_ok(&client, &owner, &env, &program_id);
    assert_eq!(
        client.get_program(&program_id),
        ProgramConfig {
            owner,
            program_id,
            snapshot_id: b(&env, 2),
            impact_rule_id: b(&env, 3),
            minimum_loss: b(&env, 4),
            state_commitment: b(&env, 5),
        }
    );
}

#[test]
fn unauthorized_program_registration_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let result = client.try_register_program(
        &owner,
        &b(&env, 1),
        &b(&env, 2),
        &b(&env, 3),
        &b(&env, 4),
        &b(&env, 5),
    );
    assert!(matches!(result, Err(Err(_))));
}

#[test]
fn duplicate_program_registration_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let program_id = b(&env, 1);
    env.mock_all_auths();
    register_program_ok(&client, &owner, &env, &program_id);
    let result = client.try_register_program(
        &owner,
        &program_id,
        &b(&env, 2),
        &b(&env, 3),
        &b(&env, 4),
        &b(&env, 5),
    );
    assert_eq!(result, Err(Ok(Error::ProgramAlreadyExists)));
}

#[test]
fn zero_program_fields_fail() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.mock_all_auths();
    let result = client.try_register_program(
        &owner,
        &b(&env, 0),
        &b(&env, 2),
        &b(&env, 3),
        &b(&env, 4),
        &b(&env, 5),
    );
    assert_eq!(result, Err(Ok(Error::ZeroIdentifier)));
}

#[test]
fn researcher_registration_succeeds_with_authentication() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    register_researcher_ok(&client, &researcher, &env);
    assert_eq!(client.get_researcher_commitment(&researcher), b(&env, 6));
}

#[test]
fn unauthorized_researcher_registration_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    let result = client.try_register_researcher(&researcher, &b(&env, 9));
    assert!(matches!(result, Err(Err(_))));
}

#[test]
fn duplicate_researcher_registration_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    register_researcher_ok(&client, &researcher, &env);
    let result = client.try_register_researcher(&researcher, &b(&env, 6));
    assert_eq!(result, Err(Ok(Error::ResearcherAlreadyRegistered)));
}

#[test]
fn zero_researcher_commitment_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    let result = client.try_register_researcher(&researcher, &b(&env, 0));
    assert_eq!(result, Err(Ok(Error::ZeroIdentifier)));
}

#[test]
fn decode_public_inputs_correctly() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let bytes = inputs(
        &env,
        b(&env, 1),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 7),
    );
    let decoded = client.decode_public_inputs(&bytes);
    assert_eq!(decoded.program_id, b(&env, 1));
    assert_eq!(decoded.snapshot_id, b(&env, 2));
    assert_eq!(decoded.impact_rule_id, b(&env, 3));
    assert_eq!(decoded.minimum_loss, b(&env, 4));
    assert_eq!(decoded.state_commitment, b(&env, 5));
    assert_eq!(decoded.researcher_commitment, b(&env, 6));
    assert_eq!(decoded.nullifier, b(&env, 7));
}

#[test]
fn field_byte_order_is_preserved() {
    let (env, contract_id, _) = setup(1);
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
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let result = client.try_decode_public_inputs(&Bytes::from_array(&env, &[0u8; 223]));
    assert_eq!(result, Err(Ok(Error::InvalidPublicInputLength)));
}

#[test]
fn long_public_input_fails() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let result = client.try_decode_public_inputs(&Bytes::from_array(&env, &[0u8; 225]));
    assert_eq!(result, Err(Ok(Error::InvalidPublicInputLength)));
}
