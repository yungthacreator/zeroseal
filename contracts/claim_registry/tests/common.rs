use claim_registry::{ClaimRegistry, ClaimRegistryArgs};
use soroban_sdk::{contract, contracterror, contractimpl, Address, Bytes, BytesN, Env, Symbol};

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u32)]
pub enum MockVerifierError {
    Rejected = 1,
}

#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    pub fn __constructor(env: Env, accepted_marker: u32) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "marker"), &accepted_marker);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "calls"), &0u32);
    }

    pub fn verify_proof(
        env: Env,
        public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<(), MockVerifierError> {
        let key_calls = Symbol::new(&env, "calls");
        let key_marker = Symbol::new(&env, "marker");
        let mut calls: u32 = env.storage().instance().get(&key_calls).unwrap_or(0);
        calls += 1;
        env.storage().instance().set(&key_calls, &calls);

        let marker: u32 = env.storage().instance().get(&key_marker).unwrap_or(0);
        if proof_bytes.len() != 1 || public_inputs.len() != 224 {
            return Err(MockVerifierError::Rejected);
        }
        if proof_bytes.get(0).unwrap_or(0) as u32 != marker {
            return Err(MockVerifierError::Rejected);
        }
        Ok(())
    }

    pub fn call_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, "calls"))
            .unwrap_or(0)
    }
}

pub fn setup(accepted_marker: u8) -> (Env, Address, Address) {
    let env = Env::default();
    let verifier = env.register(MockVerifier, (accepted_marker as u32,));
    let contract_id = env.register(ClaimRegistry, ClaimRegistryArgs::__constructor(&verifier));
    (env, contract_id, verifier)
}

pub fn b(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[allow(clippy::too_many_arguments)]
pub fn inputs(
    env: &Env,
    program_id: BytesN<32>,
    snapshot_id: BytesN<32>,
    impact_rule_id: BytesN<32>,
    minimum_loss: BytesN<32>,
    state_commitment: BytesN<32>,
    researcher_commitment: BytesN<32>,
    nullifier: BytesN<32>,
) -> Bytes {
    let mut raw = [0u8; 224];
    raw[0..32].copy_from_slice(&program_id.to_array());
    raw[32..64].copy_from_slice(&snapshot_id.to_array());
    raw[64..96].copy_from_slice(&impact_rule_id.to_array());
    raw[96..128].copy_from_slice(&minimum_loss.to_array());
    raw[128..160].copy_from_slice(&state_commitment.to_array());
    raw[160..192].copy_from_slice(&researcher_commitment.to_array());
    raw[192..224].copy_from_slice(&nullifier.to_array());
    Bytes::from_array(env, &raw)
}

pub fn register_program_ok(
    client: &claim_registry::ClaimRegistryClient<'_>,
    owner: &Address,
    env: &Env,
    program_id: &BytesN<32>,
) {
    client.register_program(
        owner,
        program_id,
        &b(env, 2),
        &b(env, 3),
        &b(env, 4),
        &b(env, 5),
    );
}

pub fn register_researcher_ok(
    client: &claim_registry::ClaimRegistryClient<'_>,
    researcher: &Address,
    env: &Env,
) {
    client.register_researcher(researcher, &b(env, 6));
}
