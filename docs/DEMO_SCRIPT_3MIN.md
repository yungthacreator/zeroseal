# ZeroSeal 3 Minute Demo Script

## Goal

Show a real ZeroSeal flow: approved public claim, private evidence kept local, Freighter approval on Stellar Testnet, confirmed receipt, and independent verification.

## Timeline

00:00-00:18
Open `https://zeroseal.vercel.app`.
Say: "Security researchers often need to prove a finding matters before it is safe to reveal the complete exploit."

00:18-00:35
Point to the hero.
Say: "ZeroSeal proves the approved claim and keeps the exploit private. The receipt exists only after confirmation on Stellar Testnet."

00:35-00:52
Click **Try ZeroSeal**.
Click **Load example**.
Show the prepared Immunefi, Example Vault Programme, ExampleVault.sol, `withdraw()`, Critical claim.

00:52-01:12
Move through **Report** and **Finding**.
Say: "This is reporting context only. ZeroSeal does not imply an integration or submit the private report to the platform."

01:12-01:32
Open **Private evidence**.
Say: "The private report, reproduction steps, PoC notes, private files, salt and private impact value stay local."

01:32-01:52
Click **Generate private seal**.
Say: "The seal is created in the browser. The sample starts unsealed, so this fingerprint appears only after my action."

01:52-02:08
Click **Approve public claim**.
Open **View public fields** and **View seal details**.
Say: "Only the approved public claim and seal identifiers move forward."

02:08-02:30
On **Sign and receipt**, click **Connect Freighter** if needed.
Confirm Freighter is on Stellar Testnet.
Click **Review transaction**.
Read the contract, method, wallet, seal and raw-evidence exclusion.
Click **Approve in Freighter** and approve in Freighter.

02:30-02:46
Wait for a real transaction hash and successful Stellar lookup.
Open **Open receipt page**.
Open **Open Stellar explorer**.
Show the transaction hash and ledger.

02:46-03:00
Open `/verify`.
Paste the real transaction hash, claim identifier or receipt identifier.
Click **Verify receipt**.
Close with: "Bug bounty platforms can use ZeroSeal as a private verification and public receipt layer before full exploit disclosure."

## Truth Line

The current circuit checks the programme's published threshold claim. It does not prove arbitrary exploit validity, and the demo is not ready to record unless a real transaction hash, SUCCESS status and ledger are shown.
