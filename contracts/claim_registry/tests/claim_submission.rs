mod common;

use claim_registry::Error;
use common::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Event as _,
};

#[test]
fn first_claim_from_new_researcher_registers_and_records_claim() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);
    let researcher_commitment = b(&env, 1);
    let claim_commitment = b(&env, 2);
    let nullifier = b(&env, 3);

    env.mock_all_auths();
    let receipt = client.submit_claim(
        &researcher,
        &researcher_commitment,
        &claim_commitment,
        &nullifier,
    );

    assert_eq!(receipt.researcher, researcher);
    assert_eq!(receipt.researcher_commitment, researcher_commitment);
    assert_eq!(receipt.claim_commitment, claim_commitment);
    assert_eq!(receipt.nullifier, nullifier);
    assert!(client.is_claim_commitment_used(&claim_commitment));
    assert!(client.is_nullifier_used(&nullifier));
    assert_eq!(
        client.get_researcher_commitment(&researcher),
        researcher_commitment
    );
    assert_eq!(client.get_claim(&claim_commitment), receipt);
}

#[test]
fn second_unique_claim_from_same_researcher_is_allowed() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);
    let researcher_commitment = b(&env, 1);

    env.mock_all_auths();
    client.submit_claim(&researcher, &researcher_commitment, &b(&env, 2), &b(&env, 3));
    let second =
        client.submit_claim(&researcher, &researcher_commitment, &b(&env, 4), &b(&env, 5));

    assert_eq!(second.researcher, researcher);
    assert_eq!(second.researcher_commitment, researcher_commitment);
    assert_eq!(second.claim_commitment, b(&env, 4));
    assert_eq!(second.nullifier, b(&env, 5));
}

#[test]
fn claim_from_another_researcher_is_independent() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let first_researcher = Address::generate(&env);
    let second_researcher = Address::generate(&env);

    env.mock_all_auths();
    client.submit_claim(&first_researcher, &b(&env, 1), &b(&env, 2), &b(&env, 3));
    let receipt = client.submit_claim(&second_researcher, &b(&env, 4), &b(&env, 5), &b(&env, 6));

    assert_eq!(receipt.researcher, second_researcher);
    assert_eq!(client.get_researcher_commitment(&second_researcher), b(&env, 4));
}

#[test]
fn duplicate_claim_commitment_is_rejected() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);
    let claim_commitment = b(&env, 2);

    env.mock_all_auths();
    client.submit_claim(&researcher, &b(&env, 1), &claim_commitment, &b(&env, 3));
    let result = client.try_submit_claim(&researcher, &b(&env, 1), &claim_commitment, &b(&env, 4));

    assert_eq!(result, Err(Ok(Error::ClaimCommitmentAlreadyUsed)));
}

#[test]
fn duplicate_nullifier_is_rejected() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);
    let nullifier = b(&env, 3);

    env.mock_all_auths();
    client.submit_claim(&researcher, &b(&env, 1), &b(&env, 2), &nullifier);
    let result = client.try_submit_claim(&researcher, &b(&env, 1), &b(&env, 4), &nullifier);

    assert_eq!(result, Err(Ok(Error::NullifierAlreadyUsed)));
}

#[test]
fn missing_authentication_is_rejected() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);

    env.set_auths(&[]);
    let result = client.try_submit_claim(&researcher, &b(&env, 1), &b(&env, 2), &b(&env, 3));

    assert!(matches!(result, Err(Err(_))));
}

#[test]
fn researcher_commitment_mismatch_is_rejected() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);

    env.mock_all_auths();
    client.submit_claim(&researcher, &b(&env, 1), &b(&env, 2), &b(&env, 3));
    let result = client.try_submit_claim(&researcher, &b(&env, 9), &b(&env, 4), &b(&env, 5));

    assert_eq!(result, Err(Ok(Error::ResearcherCommitmentMismatch)));
}

#[test]
fn accepted_claim_emits_only_safe_public_values() {
    let (env, contract_id) = setup();
    let client = client(&env, &contract_id);
    let researcher = Address::generate(&env);
    let researcher_commitment = b(&env, 1);
    let claim_commitment = b(&env, 2);
    let nullifier = b(&env, 3);

    env.mock_all_auths();
    let receipt = client.submit_claim(
        &researcher,
        &researcher_commitment,
        &claim_commitment,
        &nullifier,
    );

    let actual = env.events().all();
    let expected = claim_registry::ClaimSubmitted {
        researcher: receipt.researcher,
        researcher_commitment: receipt.researcher_commitment,
        claim_commitment: receipt.claim_commitment,
        nullifier: receipt.nullifier,
    }
    .to_xdr(&env, &client.address);

    assert_eq!(actual, std::vec![expected]);
}
