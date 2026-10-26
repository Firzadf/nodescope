# Adoption outreach

A short message the user can send to 3–5 other Portaldot teams, asking
them to try Fee Lab / the CLI on their own contracts. Send it as-is;
do not attach any result that is not real.

## The message (copy-paste)

> Hi — quick ask, 2 minutes, no wallet needed.
>
> We built NodeScope Fee Lab: it prices the same deploy on both Portaldot
> surfaces (EVM gas vs native fee + storage deposit, all-in) so you can
> see the real cost before you deploy. Try it on your own contract:
>
> 1. Open https://nodescope.vercel.app/app/fee-lab
> 2. Pick "Contract deploy" → "Custom bytecode", paste your creation
>    bytecode (or upload your solc artifact JSON), add constructor args
>    if you have any, and press "Estimate on both surfaces".
> 3. Or from CI: `npx nodescope fees --artifact out/YourContract.sol/YourContract.json`
>    (repo: https://github.com/Firzadf/nodescope, see `cli/README.md`).
>
> Nothing signs, nothing is sent, nothing is stored — both legs are
> dry-run estimates. If you try it, I would love one line back: your
> contract size, the EVM number, the native all-in number, and whether
> the recommendation matched what you expected. Happy to return the favor
> on your tool.

## What counts as a result

A result is a team's own words and numbers, sent back by that team: the
contract they priced, the two measured costs, and one sentence of
reaction. Anything else — a paraphrase, a rounded guess, a "they loved
it" — is not a result and must not be written into the README.

## Results received (waiting)

| Team | Contract priced | EVM | Native all-in | Their words |
| --- | --- | --- | --- | --- |
| _Waiting for the first teams._ | | | | |

This table is filled only when a team actually replies. Until then it
stays empty, and the README says so.
