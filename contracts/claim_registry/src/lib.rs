#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Bytes, BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidPublicInputLength = 2,
    ZeroIdentifier = 3,
    ProgramAlreadyExists = 4,
    ProgramNotFound = 5,
    ResearcherAlreadyRegistered = 6,
    ResearcherNotRegistered = 7,
    SnapshotMismatch = 8,
    ImpactRuleMismatch = 9,
    MinimumLossMismatch = 10,
    StateCommitmentMismatch = 11,
    ResearcherCommitmentMismatch = 12,
    ZeroNullifier = 13,
    NullifierAlreadyUsed = 14,
    VerifierRejected = 15,
    ClaimNotFound = 16,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimReceipt {
    pub program_id: BytesN<32>,
    pub researcher: Address,
    pub snapshot_id: BytesN<32>,
    pub impact_rule_id: BytesN<32>,
    pub minimum_loss: BytesN<32>,
    pub state_commitment: BytesN<32>,
    pub researcher_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub accepted_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgramConfig {
    pub owner: Address,
    pub program_id: BytesN<32>,
    pub snapshot_id: BytesN<32>,
    pub impact_rule_id: BytesN<32>,
    pub minimum_loss: BytesN<32>,
    pub state_commitment: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DecodedClaim {
    pub program_id: BytesN<32>,
    pub snapshot_id: BytesN<32>,
    pub impact_rule_id: BytesN<32>,
    pub minimum_loss: BytesN<32>,
    pub state_commitment: BytesN<32>,
    pub researcher_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct ResearcherRecord {
    commitment: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Verifier,
    Program(BytesN<32>),
    Researcher(Address),
    UsedNullifier(BytesN<32>),
    Receipt(BytesN<32>),
}

#[contractclient(name = "VerifierClient")]
pub trait Verifier {
    fn verify_proof(env: Env, public_inputs: Bytes, proof_bytes: Bytes);
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimAccepted {
    pub program_id: BytesN<32>,
    pub researcher: Address,
    pub snapshot_id: BytesN<32>,
    pub impact_rule_id: BytesN<32>,
    pub minimum_loss: BytesN<32>,
    pub state_commitment: BytesN<32>,
    pub researcher_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub accepted_ledger: u32,
}

#[contract]
pub struct ClaimRegistry;

#[contractimpl]
impl ClaimRegistry {
    pub fn __constructor(env: Env, verifier: Address) {
        if env.storage().instance().has(&DataKey::Verifier) {
            panic_with_error(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Verifier, &verifier);
    }

    pub fn verifier(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Verifier)
            .expect("verifier not initialized")
    }

    pub fn register_program(
        env: Env,
        owner: Address,
        program_id: BytesN<32>,
        snapshot_id: BytesN<32>,
        impact_rule_id: BytesN<32>,
        minimum_loss: BytesN<32>,
        state_commitment: BytesN<32>,
    ) -> Result<(), Error> {
        owner.require_auth();
        ensure_nonzero_bytes(&env, &program_id)?;
        ensure_nonzero_bytes(&env, &snapshot_id)?;
        ensure_nonzero_bytes(&env, &impact_rule_id)?;
        ensure_nonzero_bytes(&env, &minimum_loss)?;
        ensure_nonzero_bytes(&env, &state_commitment)?;

        let key = DataKey::Program(program_id.clone());
        if env.storage().instance().has(&key) {
            return Err(Error::ProgramAlreadyExists);
        }

        env.storage().instance().set(
            &key,
            &ProgramConfig {
                owner,
                program_id,
                snapshot_id,
                impact_rule_id,
                minimum_loss,
                state_commitment,
            },
        );
        Ok(())
    }

    pub fn get_program(env: Env, program_id: BytesN<32>) -> Result<ProgramConfig, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Program(program_id))
            .ok_or(Error::ProgramNotFound)
    }

    pub fn register_researcher(
        env: Env,
        researcher: Address,
        researcher_commitment: BytesN<32>,
    ) -> Result<(), Error> {
        researcher.require_auth();
        ensure_nonzero_bytes(&env, &researcher_commitment)?;

        let key = DataKey::Researcher(researcher.clone());
        if env.storage().instance().has(&key) {
            return Err(Error::ResearcherAlreadyRegistered);
        }

        env.storage().instance().set(
            &key,
            &ResearcherRecord {
                commitment: researcher_commitment,
            },
        );
        Ok(())
    }

    pub fn get_researcher_commitment(env: Env, researcher: Address) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get::<_, ResearcherRecord>(&DataKey::Researcher(researcher))
            .map(|record| record.commitment)
            .ok_or(Error::ResearcherNotRegistered)
    }

    pub fn decode_public_inputs(env: Env, public_inputs: Bytes) -> Result<DecodedClaim, Error> {
        if public_inputs.len() != 224 {
            return Err(Error::InvalidPublicInputLength);
        }

        Ok(DecodedClaim {
            program_id: decode_field(&env, &public_inputs, 0),
            snapshot_id: decode_field(&env, &public_inputs, 32),
            impact_rule_id: decode_field(&env, &public_inputs, 64),
            minimum_loss: decode_field(&env, &public_inputs, 96),
            state_commitment: decode_field(&env, &public_inputs, 128),
            researcher_commitment: decode_field(&env, &public_inputs, 160),
            nullifier: decode_field(&env, &public_inputs, 192),
        })
    }

    pub fn submit_claim(
        env: Env,
        researcher: Address,
        public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<ClaimReceipt, Error> {
        researcher.require_auth();

        let decoded = Self::decode_public_inputs(env.clone(), public_inputs.clone())?;
        if decoded.nullifier.to_array().iter().all(|b| *b == 0) {
            return Err(Error::ZeroNullifier);
        }

        let program = Self::get_program(env.clone(), decoded.program_id.clone())?;
        if program.snapshot_id != decoded.snapshot_id {
            return Err(Error::SnapshotMismatch);
        }
        if program.impact_rule_id != decoded.impact_rule_id {
            return Err(Error::ImpactRuleMismatch);
        }
        if program.minimum_loss != decoded.minimum_loss {
            return Err(Error::MinimumLossMismatch);
        }
        if program.state_commitment != decoded.state_commitment {
            return Err(Error::StateCommitmentMismatch);
        }

        let researcher_commitment =
            Self::get_researcher_commitment(env.clone(), researcher.clone())?;
        if researcher_commitment != decoded.researcher_commitment {
            return Err(Error::ResearcherCommitmentMismatch);
        }

        let nullifier_key = DataKey::UsedNullifier(decoded.nullifier.clone());
        if env.storage().instance().has(&nullifier_key) {
            return Err(Error::NullifierAlreadyUsed);
        }

        let verifier = VerifierClient::new(&env, &Self::verifier(env.clone()));
        match verifier.try_verify_proof(&public_inputs, &proof_bytes) {
            Ok(Ok(())) => {}
            _ => return Err(Error::VerifierRejected),
        }

        let receipt = ClaimReceipt {
            program_id: decoded.program_id,
            researcher,
            snapshot_id: decoded.snapshot_id,
            impact_rule_id: decoded.impact_rule_id,
            minimum_loss: decoded.minimum_loss,
            state_commitment: decoded.state_commitment,
            researcher_commitment,
            nullifier: decoded.nullifier.clone(),
            accepted_ledger: env.ledger().sequence(),
        };

        env.storage().instance().set(&nullifier_key, &true);
        env.storage()
            .instance()
            .set(&DataKey::Receipt(receipt.nullifier.clone()), &receipt);
        ClaimAccepted {
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
        .publish(&env);

        Ok(receipt)
    }

    pub fn get_claim(env: Env, nullifier: BytesN<32>) -> Result<ClaimReceipt, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Receipt(nullifier))
            .ok_or(Error::ClaimNotFound)
    }

    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::UsedNullifier(nullifier))
    }
}

fn decode_field(env: &Env, bytes: &Bytes, offset: u32) -> BytesN<32> {
    let mut raw = [0u8; 32];
    bytes.slice(offset..offset + 32).copy_into_slice(&mut raw);
    BytesN::from_array(env, &raw)
}

fn ensure_nonzero_bytes(_env: &Env, value: &BytesN<32>) -> Result<(), Error> {
    if value.to_array().iter().all(|b| *b == 0) {
        return Err(Error::ZeroIdentifier);
    }
    Ok(())
}

fn panic_with_error(env: &Env, error: Error) -> ! {
    env.panic_with_error(error)
}
