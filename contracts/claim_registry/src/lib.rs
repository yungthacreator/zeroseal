#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u32)]
pub enum Error {
    ZeroIdentifier = 1,
    ResearcherCommitmentMismatch = 2,
    ClaimCommitmentAlreadyUsed = 3,
    NullifierAlreadyUsed = 4,
    ClaimNotFound = 5,
    ResearcherNotRegistered = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimReceipt {
    pub researcher: Address,
    pub researcher_commitment: BytesN<32>,
    pub claim_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub accepted_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct ResearcherRecord {
    commitment: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Researcher(Address),
    UsedClaimCommitment(BytesN<32>),
    UsedNullifier(BytesN<32>),
    Receipt(BytesN<32>),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimSubmitted {
    pub researcher: Address,
    pub researcher_commitment: BytesN<32>,
    pub claim_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
}

#[contract]
pub struct ClaimRegistry;

#[contractimpl]
impl ClaimRegistry {
    pub fn submit_claim(
        env: Env,
        researcher: Address,
        researcher_commitment: BytesN<32>,
        claim_commitment: BytesN<32>,
        nullifier: BytesN<32>,
    ) -> Result<ClaimReceipt, Error> {
        researcher.require_auth();
        ensure_nonzero_bytes(&researcher_commitment)?;
        ensure_nonzero_bytes(&claim_commitment)?;
        ensure_nonzero_bytes(&nullifier)?;

        let researcher_key = DataKey::Researcher(researcher.clone());
        match env
            .storage()
            .instance()
            .get::<_, ResearcherRecord>(&researcher_key)
        {
            Some(record) if record.commitment != researcher_commitment => {
                return Err(Error::ResearcherCommitmentMismatch);
            }
            Some(_) => {}
            None => {
                env.storage().instance().set(
                    &researcher_key,
                    &ResearcherRecord {
                        commitment: researcher_commitment.clone(),
                    },
                );
            }
        }

        let claim_key = DataKey::UsedClaimCommitment(claim_commitment.clone());
        if env.storage().instance().has(&claim_key) {
            return Err(Error::ClaimCommitmentAlreadyUsed);
        }

        let nullifier_key = DataKey::UsedNullifier(nullifier.clone());
        if env.storage().instance().has(&nullifier_key) {
            return Err(Error::NullifierAlreadyUsed);
        }

        let receipt = ClaimReceipt {
            researcher: researcher.clone(),
            researcher_commitment: researcher_commitment.clone(),
            claim_commitment: claim_commitment.clone(),
            nullifier: nullifier.clone(),
            accepted_ledger: env.ledger().sequence(),
        };

        env.storage().instance().set(&claim_key, &true);
        env.storage().instance().set(&nullifier_key, &true);
        env.storage()
            .instance()
            .set(&DataKey::Receipt(claim_commitment.clone()), &receipt);

        ClaimSubmitted {
            researcher,
            researcher_commitment,
            claim_commitment,
            nullifier,
        }
        .publish(&env);

        Ok(receipt)
    }

    pub fn get_claim(env: Env, claim_commitment: BytesN<32>) -> Result<ClaimReceipt, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Receipt(claim_commitment))
            .ok_or(Error::ClaimNotFound)
    }

    pub fn get_researcher_commitment(env: Env, researcher: Address) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get::<_, ResearcherRecord>(&DataKey::Researcher(researcher))
            .map(|record| record.commitment)
            .ok_or(Error::ResearcherNotRegistered)
    }

    pub fn is_claim_commitment_used(env: Env, claim_commitment: BytesN<32>) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::UsedClaimCommitment(claim_commitment))
    }

    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::UsedNullifier(nullifier))
    }
}

fn ensure_nonzero_bytes(value: &BytesN<32>) -> Result<(), Error> {
    if value.to_array().iter().all(|b| *b == 0) {
        return Err(Error::ZeroIdentifier);
    }
    Ok(())
}
