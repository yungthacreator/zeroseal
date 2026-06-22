mod common;

use claim_registry::{ClaimAccepted, ClaimReceipt, ClaimRegistryClient, Error};
use common::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Bytes, BytesN, Env, Event as _,
};

fn prepare_claim(
    client: &ClaimRegistryClient<'_>,
    env: &Env,
    owner: &Address,
    researcher: &Address,
    program_id: &BytesN<32>,
) {
    env.mock_all_auths();
    register_program_ok(client, owner, env, program_id);
    register_researcher_ok(client, researcher, env);
}

#[allow(clippy::too_many_arguments)]
fn submit_ok(
    client: &ClaimRegistryClient<'_>,
    env: &Env,
    researcher: &Address,
    program_id: BytesN<32>,
    snapshot_id: BytesN<32>,
    impact_rule_id: BytesN<32>,
    minimum_loss: BytesN<32>,
    state_commitment: BytesN<32>,
    researcher_commitment: BytesN<32>,
    nullifier: BytesN<32>,
    proof_marker: u8,
) -> ClaimReceipt {
    match client.try_submit_claim(
        researcher,
        &inputs(
            env,
            program_id,
            snapshot_id,
            impact_rule_id,
            minimum_loss,
            state_commitment,
            researcher_commitment,
            nullifier,
        ),
        &Bytes::from_array(env, &[proof_marker]),
    ) {
        Ok(Ok(v)) => v,
        other => panic!("expected success, got {:?}", other),
    }
}

#[test]
fn valid_claim_accepted() {
    let (env, contract_id, verifier) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let receipt = submit_ok(
        &client,
        &env,
        &researcher,
        program_id.clone(),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 7),
        1,
    );
    assert_eq!(receipt.program_id, b(&env, 1));
    assert_eq!(receipt.researcher, researcher);
    assert!(client.is_nullifier_used(&b(&env, 7)));
    assert_eq!(MockVerifierClient::new(&env, &verifier).call_count(), 1);
}

#[test]
fn receipt_stored_correctly() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let receipt = submit_ok(
        &client,
        &env,
        &researcher,
        program_id.clone(),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 7),
        1,
    );
    assert_eq!(client.try_get_claim(&b(&env, 7)), Ok(Ok(receipt)));
}

#[test]
fn unknown_program_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    register_researcher_ok(&client, &researcher, &env);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            b(&env, 1),
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::ProgramNotFound)));
}

#[test]
fn unregistered_researcher_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    env.mock_all_auths();
    register_program_ok(&client, &owner, &env, &b(&env, 1));
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            b(&env, 1),
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::ResearcherNotRegistered)));
}

#[test]
fn snapshot_mismatch_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 9),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::SnapshotMismatch)));
}

#[test]
fn impact_rule_mismatch_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 9),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::ImpactRuleMismatch)));
}

#[test]
fn minimum_loss_mismatch_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 9),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::MinimumLossMismatch)));
}

#[test]
fn state_commitment_mismatch_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 9),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::StateCommitmentMismatch)));
}

#[test]
fn researcher_commitment_mismatch_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 9),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::ResearcherCommitmentMismatch)));
}

#[test]
fn zero_nullifier_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 0),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::ZeroNullifier)));
}

#[test]
fn invalid_verifier_proof_rejected() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[0u8]),
    );
    assert_eq!(result, Err(Ok(Error::VerifierRejected)));
}

#[test]
fn failed_verifier_call_does_not_consume_nullifier() {
    let (env, contract_id, verifier) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let nullifier = b(&env, 7);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            nullifier.clone(),
        ),
        &Bytes::from_array(&env, &[0u8]),
    );
    assert_eq!(result, Err(Ok(Error::VerifierRejected)));
    assert!(!client.is_nullifier_used(&nullifier));
    assert_eq!(MockVerifierClient::new(&env, &verifier).call_count(), 0);
}

#[test]
fn failed_verifier_call_creates_no_receipt() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let nullifier = b(&env, 7);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            nullifier.clone(),
        ),
        &Bytes::from_array(&env, &[0u8]),
    );
    assert_eq!(result, Err(Ok(Error::VerifierRejected)));
    assert_eq!(
        client.try_get_claim(&nullifier),
        Err(Ok(Error::ClaimNotFound))
    );
    assert!(!client.is_nullifier_used(&nullifier));
}

#[test]
fn duplicate_valid_claim_rejects_second_submission() {
    let (env, contract_id, verifier) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let nullifier = b(&env, 7);
    let _ = submit_ok(
        &client,
        &env,
        &researcher,
        program_id.clone(),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        nullifier.clone(),
        1,
    );
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            nullifier.clone(),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::NullifierAlreadyUsed)));
    assert_eq!(MockVerifierClient::new(&env, &verifier).call_count(), 1);
}

#[test]
fn duplicate_nullifier_rejected_before_verifier_invocation() {
    let (env, contract_id, verifier) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let nullifier = b(&env, 7);
    let _ = submit_ok(
        &client,
        &env,
        &researcher,
        program_id.clone(),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        nullifier.clone(),
        1,
    );
    let before = MockVerifierClient::new(&env, &verifier).call_count();
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            nullifier.clone(),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert_eq!(result, Err(Ok(Error::NullifierAlreadyUsed)));
    assert_eq!(
        MockVerifierClient::new(&env, &verifier).call_count(),
        before
    );
}

#[test]
fn different_valid_nullifier_creates_separate_receipt() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let first = submit_ok(
        &client,
        &env,
        &researcher,
        program_id.clone(),
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 7),
        1,
    );
    let second = submit_ok(
        &client,
        &env,
        &researcher,
        program_id,
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 8),
        1,
    );
    assert_ne!(first.nullifier, second.nullifier);
    assert_eq!(client.try_get_claim(&b(&env, 7)), Ok(Ok(first)));
    assert_eq!(client.try_get_claim(&b(&env, 8)), Ok(Ok(second)));
}

#[test]
fn claim_submission_requires_researcher_authentication() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    env.mock_all_auths();
    register_program_ok(&client, &owner, &env, &program_id);
    register_researcher_ok(&client, &researcher, &env);
    env.set_auths(&[]);
    let result = client.try_submit_claim(
        &researcher,
        &inputs(
            &env,
            program_id,
            b(&env, 2),
            b(&env, 3),
            b(&env, 4),
            b(&env, 5),
            b(&env, 6),
            b(&env, 7),
        ),
        &Bytes::from_array(&env, &[1u8]),
    );
    assert!(matches!(result, Err(Err(_))));
}

#[test]
fn accepted_claim_emits_an_event() {
    let (env, contract_id, _) = setup(1);
    let client = ClaimRegistryClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let researcher = Address::generate(&env);
    let program_id = b(&env, 1);
    prepare_claim(&client, &env, &owner, &researcher, &program_id);
    let receipt = submit_ok(
        &client,
        &env,
        &researcher,
        program_id,
        b(&env, 2),
        b(&env, 3),
        b(&env, 4),
        b(&env, 5),
        b(&env, 6),
        b(&env, 7),
        1,
    );
    let actual = env.events().all();
    let expected = ClaimAccepted {
        program_id: receipt.program_id.clone(),
        researcher: receipt.researcher.clone(),
        snapshot_id: receipt.snapshot_id.clone(),
        impact_rule_id: receipt.impact_rule_id.clone(),
        minimum_loss: receipt.minimum_loss.clone(),
        state_commitment: receipt.state_commitment.clone(),
        researcher_commitment: receipt.researcher_commitment.clone(),
        nullifier: receipt.nullifier.clone(),
        accepted_ledger: receipt.accepted_ledger,
    }
    .to_xdr(&env, &client.address);
    assert_eq!(actual, std::vec![expected]);
}
