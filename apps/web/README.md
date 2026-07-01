# ZeroSeal Web

Next.js frontend for the ZeroSeal Testnet product experience.

The web app supports:

- Public homepage and product explanation.
- Claim preparation and public field review.
- Freighter-backed Stellar Testnet claim stamping on desktop.
- Secure desktop continuation for mobile browsers where extension approval is unavailable.
- Public receipt pages.
- Receipt verification by receipt ID, claim ID or transaction hash.

Production builds must set `NEXT_PUBLIC_ZEROSEAL_API_URL` to the public API origin. Localhost API fallback is only for local development.
