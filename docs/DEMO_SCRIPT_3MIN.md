# ZeroSeal 3 Minute Demo Script

## Goal

Show that ZeroSeal lets a security researcher create a verifiable public claim without publishing the private exploit.

## Script

1. Open `https://zeroseal.vercel.app`.
2. Say: "ZeroSeal proves the approved claim and keeps the exploit private."
3. Point to the three promises: private by default, public claim approved by you, receipt confirmed on Testnet.
4. Open **Try a sample**.
5. Click **Load example** for the prepared **Example Vault Threshold Claim**.
6. Walk through Report and Finding. Explain that Immunefi is reporting context only and ZeroSeal does not submit the private report there.
7. Open Private evidence. Point out that report text, reproduction steps, PoC notes, files and private impact value remain local.
8. Click **Generate private seal**. Say: "This seal is a unique fingerprint of the private evidence. It lets the researcher later show the evidence has not changed."
9. Click **Approve public claim**. Show the private versus public lists.
10. On desktop, connect Freighter on Stellar Testnet.
11. Click **Review Testnet action** and approve only after checking Freighter.
12. Wait for a real transaction hash.
13. Open the receipt page and the Stellar explorer link.
14. Open `/verify`, paste the transaction hash and verify the receipt.

## Truth Line

The current circuit proves that a private impact value satisfies the programme's published public threshold. It does not prove every possible exploit.
