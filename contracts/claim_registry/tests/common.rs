use claim_registry::{ClaimRegistry, ClaimRegistryClient};
use soroban_sdk::{Address, BytesN, Env};

pub fn setup() -> (Env, Address) {
    let env = Env::default();
    let contract_id = env.register(ClaimRegistry, ());
    (env, contract_id)
}

pub fn client<'a>(env: &'a Env, contract_id: &'a Address) -> ClaimRegistryClient<'a> {
    ClaimRegistryClient::new(env, contract_id)
}

pub fn b(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}
