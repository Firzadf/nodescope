# Pitch deck (public, judge-facing)

Source: `build_deck.py`. Output: `../public/pitch-deck.pdf`, served at
`/pitch-deck.pdf` and linked from the DoraHacks BUIDL page.

Regenerate after any verified fact on the deck changes:

```sh
pip install fpdf2
python3 deck/build_deck.py
```

The script embeds no internal status: it contains only public, verified
facts (registry, deploy tx/block, anchor hashes/txs/blocks, fee figures
from the anchored Fee Lab report, test counts). Internal drafts live
outside this repo and are never rendered here.
