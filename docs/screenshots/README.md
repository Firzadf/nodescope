# NodeScope screenshots

Captured 4 Nov 2026 from the live app at https://nodescope.vercel.app.
Desktop frames are 1280px wide. Mobile frames are 390px wide.
The Score and Fee Lab shots are from a real read-only run against the published Portaldot V3 testnet that day: a full diagnostic (Health Score 100/100, `nodescope.health-score.v2`) and one Fee Lab contract-deploy measurement.

## Current UI

| File | What it shows |
| --- | --- |
| `desktop-home.png` / `mobile-home.png` | Landing page |
| `desktop-score.png` / `mobile-score.png` | Score v2 in the app: the total, each component, and the next step |
| `desktop-status.png` / `mobile-status.png` | `/status`, the community page, including the badge |
| `desktop-fee-lab.png` / `mobile-fee-lab.png` | Fee Lab (`/app/fee-lab`): EVM cost beside native partialFee and storage deposit |
| `desktop-verify.png` / `mobile-verify.png` | `/verify`, local SHA-256 check and the optional on-chain anchor |

## Check-in set (22 Oct 2026)

The earlier dark-theme captures from the 22 Oct 2026 check-in are kept in [`check-in-2026-10-22/`](check-in-2026-10-22/). They show endpoint configuration, a health-check run, snapshot comparison, categorized findings, and report export. They predate Score v2, Fee Lab, and `/status`.
