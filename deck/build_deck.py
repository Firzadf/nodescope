#!/usr/bin/env python3
"""Build the public NodeScope pitch deck (public/pitch-deck.pdf).

The deck is judge-facing: English, visual, one idea per slide, no internal
status notes. Every number on it is a verified fact, not a claim:

- registry, deploy tx/block, and the three anchor hashes/txs/blocks come
  from deployments/portaldot-v3.json (see docs/EVIDENCE.md);
- the fee figures come from the anchored Fee Lab report
  (evidence/reports/fee-2026-10-27.json): EVM 124.098 tPOT, native
  all-in 122.191 tPOT, all-in ratio 1.0156, fee-only ratio 803.68;
- test counts come from the suite itself (467 tests, 67 files).

Regenerate with:  python3 deck/build_deck.py
Requires fpdf2 (pip install fpdf2). DejaVu fonts are used when present
on the system; the script falls back to the built-in core fonts.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "pitch-deck.pdf"

try:
    from fpdf import FPDF
except ImportError:
    print("fpdf2 is required: pip install fpdf2", file=sys.stderr)
    raise

# Page: 16:9 slides, 960 x 540 pt.
W, H = 960.0, 540.0
MARGIN = 56.0

INK = (6, 11, 29)
PANEL = (14, 23, 48)
LINE = (30, 42, 68)
ACCENT = (125, 180, 255)
TEXT = (230, 237, 247)
MUTED = (138, 154, 181)
FAINT = (100, 116, 139)

DEJAVU_DIR = "/usr/share/fonts/truetype/dejavu"
FONT_CANDIDATES = {
    "sans": ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"],
    "mono": ["DejaVuSansMono.ttf", "DejaVuSansMono-Bold.ttf"],
}


def pick_fonts(pdf: FPDF) -> dict[str, str]:
    """Register DejaVu when available, else use core fonts."""
    names = {"sans": "helvetica", "mono": "courier"}
    for family, files in FONT_CANDIDATES.items():
        regular, bold = (os.path.join(DEJAVU_DIR, f) for f in files)
        if os.path.exists(regular) and os.path.exists(bold):
            tag = "dejavu" if family == "sans" else "dejavumono"
            pdf.add_font(tag, "", regular)
            pdf.add_font(tag, "B", bold)
            names[family] = tag
    return names


class Deck(FPDF):
    def __init__(self) -> None:
        super().__init__(unit="pt", format=(W, H))
        self.set_auto_page_break(auto=False)
        self.font_families = pick_fonts(self)
        self.slide_no = 0

    # -- primitives -----------------------------------------------------
    def new_slide(self) -> None:
        self.add_page()
        self.slide_no += 1
        self.set_fill_color(*INK)
        self.rect(0, 0, W, H, style="F")

    def set_font(self, family: str, style: str, size: float) -> None:
        # Accept both our logical names ("sans"/"mono") and the registered
        # font tags fpdf2 itself passes back on add_page ("dejavu", ...).
        tag = self.font_families.get(family, family)
        super().set_font(tag, style, size)

    def kicker(self, text: str) -> None:
        self.set_font("sans", "B", 11)
        self.set_text_color(*ACCENT)
        self.set_xy(MARGIN, 44)
        self.cell(0, 14, text.upper())

    def headline(self, text: str, size: float = 34) -> float:
        # Left-aligned, never justified: fpdf2's multi_cell defaults to
        # justified, which stretches inter-word spacing on wrapped lines.
        # Returns the y below the last headline line, so content below can
        # start after the headline's real height instead of a fixed y.
        self.set_font("sans", "B", size)
        self.set_text_color(*TEXT)
        self.set_xy(MARGIN, 70)
        self.multi_cell(W - 2 * MARGIN, size + 8, text, align="L")
        return self.get_y()

    def body(self, text: str, y: float, size: float = 15, color=MUTED) -> None:
        self.set_font("sans", "", size)
        self.set_text_color(*color)
        self.set_xy(MARGIN, y)
        self.multi_cell(W - 2 * MARGIN, size + 7, text, align="L")

    def slide_footer(self, criterion: str) -> None:
        self.set_font("sans", "", 10)
        self.set_text_color(*FAINT)
        self.set_xy(MARGIN, H - 36)
        self.cell(0, 12, f"NodeScope  ·  {criterion}  ·  {self.slide_no}/10")

    def panel(self, x: float, y: float, w: float, h: float) -> None:
        self.set_fill_color(*PANEL)
        self.set_draw_color(*LINE)
        self.rect(x, y, w, h, style="DF")

    def chip(self, x: float, y: float, text: str) -> float:
        self.set_font("sans", "B", 13)
        tw = self.get_string_width(text) + 28
        self.set_draw_color(*ACCENT)
        self.set_fill_color(*INK)
        self.rect(x, y, tw, 30, style="DF")
        self.set_text_color(*ACCENT)
        self.set_xy(x, y + 8)
        self.cell(tw, 14, text, align="C")
        return x + tw + 14

    def mono_line(self, x: float, y: float, label: str, value: str) -> None:
        self.set_font("sans", "B", 11)
        self.set_text_color(*MUTED)
        self.set_xy(x, y)
        self.cell(120, 13, label)
        self.set_font("mono", "", 9)
        self.set_text_color(*TEXT)
        self.set_xy(x + 120, y)
        self.cell(0, 13, value)


# -- facts (verified; see module docstring) ------------------------------
REGISTRY = "0xd48da7eff3264bdd51a86b873da9ff6997aae99c"
DEPLOY_TX = "0x1c2a055523a4cf8b73d771df4d3c54d21392a85f86a14a4d68213bf6db5f4904"
ANCHORS = [
    ("Health #1", "0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4",
     "0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476", 216341),
    ("Fees", "0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464",
     "0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9", 216343),
    ("Health #2", "0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b",
     "0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913", 216346),
]


def slide_title(d: Deck) -> None:
    d.new_slide()
    d.set_font("sans", "B", 11)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN, 64)
    d.cell(0, 14, "PORTALDOT HACKER HOUSE 2026  ·  TRACK: NODE OPERATIONS AND TOOLING")
    d.set_font("sans", "B", 92)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN, 108)
    d.cell(0, 95, "NodeScope")
    d.set_font("sans", "", 30)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN, 214)
    d.cell(0, 36, "Node truth suite for Portaldot V3")
    d.set_font("sans", "", 17)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, 262)
    d.cell(0, 22, "Two pillars. One evidence discipline.")
    x = MARGIN
    for chip in ("HEALTH", "FEES"):
        x = d.chip(x, 310, chip)
    d.set_font("sans", "", 13)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, 400)
    d.cell(0, 18, "nodescope.vercel.app  ·  github.com/Firzadf/nodescope")
    d.set_xy(MARGIN, 424)
    d.cell(0, 18, "dorahacks.io/build/50146  ·  Demo video: youtu.be/TyTudF3MUaI")


def slide_problem(d: Deck) -> None:
    d.new_slide()
    d.kicker("Problem")
    top = d.headline("A node can answer once. That proves almost nothing.")
    py = max(150, top + 16)
    d.panel(MARGIN, py, 408, 210)
    d.set_font("sans", "B", 18)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 24, py + 22)
    d.cell(0, 22, "Health over time")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 24, py + 52)
    d.multi_cell(360, 22, "An operator can see a node respond, but cannot "
           "prove it stayed healthy, or what changed since the last check.",
           align="L")
    d.panel(MARGIN + 440, py, 408, 210)
    d.set_font("sans", "B", 18)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 464, py + 22)
    d.cell(0, 22, "One operation, two prices")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 464, py + 52)
    d.multi_cell(360, 22, "The same operation is priced on the EVM surface "
           "and on the native surface, and headline fee numbers hide the "
           "difference.", align="L")
    d.slide_footer("Innovation")


def slide_solution(d: Deck) -> None:
    d.new_slide()
    d.kicker("Solution")
    top = d.headline("One build, two pillars, one evidence discipline.")
    py = max(150, top + 16)
    d.panel(MARGIN, py, 408, 170)
    d.set_font("sans", "B", 18)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 24, py + 20)
    d.cell(0, 22, "Health")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 24, py + 50)
    d.multi_cell(360, 22, "Timestamped snapshots. Deterministic before/after "
           "comparison. Reports verified by SHA-256.", align="L")
    d.panel(MARGIN + 440, py, 408, 170)
    d.set_font("sans", "B", 18)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 464, py + 20)
    d.cell(0, 22, "Fees")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 464, py + 50)
    d.multi_cell(360, 22, "One operation priced on EVM and native, side by "
           "side. Fee-only and all-in shown as they are.", align="L")
    d.set_font("sans", "B", 16)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN, py + 190)
    d.cell(0, 22, "No background polling. No black-box score. "
           "No simulated data shown as live.")
    d.slide_footer("Innovation  ·  Technical Feasibility")


def slide_demo(d: Deck) -> None:
    d.new_slide()
    d.kicker("Demo flow · 60 seconds")
    top = d.headline("From endpoint to verified report in five steps.")
    steps = [
        ("01", "Open /app. The testnet endpoint is already filled in."),
        ("02", "Run full diagnostic: connect, health check, capability discovery, "
               "Substrate probe, snapshot, combined verdict."),
        ("03", "Read the verdict bar: overall verdict, checks passed, WSS status, "
               "latency, last-checked time."),
        ("04", "Compare two snapshots: new and resolved findings, block delta, "
               "latency trend."),
        ("05", "Export the report and verify it at /verify. No account. No wallet."),
    ]
    y = max(150, top + 16)
    for num, text in steps:
        d.set_font("sans", "B", 15)
        d.set_text_color(*ACCENT)
        d.set_xy(MARGIN, y)
        d.cell(36, 20, num)
        d.set_font("sans", "", 15)
        d.set_text_color(*TEXT)
        d.set_xy(MARGIN + 44, y)
        d.multi_cell(W - 2 * MARGIN - 44, 21, text, align="L")
        y += 62
    d.slide_footer("Technical Feasibility")


def slide_evidence(d: Deck) -> None:
    d.new_slide()
    d.kicker("On-chain evidence · Portaldot V3 testnet · Chain 420420777")
    top = d.headline("Three reports anchored. Anyone can recheck them.", size=30)
    py = max(138, top + 16)
    d.panel(MARGIN, py, W - 2 * MARGIN, 68)
    d.mono_line(MARGIN + 20, py + 14, "Registry", REGISTRY)
    d.mono_line(MARGIN + 20, py + 38, "Deploy tx", DEPLOY_TX)
    d.set_font("sans", "", 12)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 20, py + 54)
    d.cell(0, 14, "Ownerless contract  ·  Deploy block 216268")
    y = py + 82
    for label, h, tx, block in ANCHORS:
        d.panel(MARGIN, y, W - 2 * MARGIN, 64)
        d.set_font("sans", "B", 14)
        d.set_text_color(*ACCENT)
        d.set_xy(MARGIN + 20, y + 10)
        d.cell(110, 18, label)
        d.set_font("sans", "", 12)
        d.set_text_color(*MUTED)
        d.set_xy(MARGIN + 130, y + 12)
        d.cell(0, 14, f"Anchor block {block}")
        d.mono_line(MARGIN + 20, y + 32, "Report", h)
        d.mono_line(MARGIN + 20, y + 48, "Tx", tx)
        y += 76
    d.set_font("sans", "", 13)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, y + 2)
    d.cell(0, 18, "Check any anchor at nodescope.vercel.app/verify")
    d.slide_footer("Technical Feasibility")


def slide_fees(d: Deck) -> None:
    d.new_slide()
    d.kicker("Fees finding · Measured 27 Oct 2026 · Contract deploy")
    top = d.headline("The headline says 804x. The bill says 1.016x.")
    ny = max(160, top + 16)
    d.set_font("sans", "B", 70)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, ny)
    d.cell(300, 70, "804x")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, ny + 70)
    d.cell(300, 20, "fee-only")
    d.set_font("sans", "B", 70)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN + 330, ny)
    d.cell(300, 70, "1.016x")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 330, ny + 70)
    d.cell(300, 20, "all-in")
    d.set_font("sans", "", 15)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN, ny + 118)
    d.cell(0, 21, "EVM deploy: 124.098 tPOT  ·  Native all-in: 122.191 tPOT  ·  Within 2%")
    d.body("Most of the gap is a 122.037 tPOT storage deposit on the native side. "
           "A deposit is a hold, not a burned fee: it is refundable when storage "
           "is freed. The EVM figure already folds it in.", ny + 160, size=15)
    d.set_font("sans", "", 12)
    d.set_text_color(*FAINT)
    d.set_xy(MARGIN, ny + 270)
    d.cell(0, 16, "tPOT is a testnet token with no market price.")
    d.slide_footer("Innovation")


def slide_tech(d: Deck) -> None:
    d.new_slide()
    d.kicker("Engineering")
    top = d.headline("Built to be rechecked, not to be believed.")
    items = [
        ("467 tests across 67 files", "Vitest, run on every push."),
        ("5/5 Foundry contract tests", "The attestation contract, tested in isolation."),
        ("CI on Ubuntu and Windows", "Node on both; Foundry on Ubuntu."),
        ("CLI and GitHub Action", "check and fees without the browser; a pre-deploy "
         "cost gate teams can run."),
        ("Deterministic comparison", "Same inputs, same diff. Reports verified by SHA-256."),
        ("Read-only by design", "No wallet, no signing, no background polling."),
    ]
    y = max(150, top + 16)
    for title, text in items:
        d.set_font("sans", "B", 15)
        d.set_text_color(*TEXT)
        d.set_xy(MARGIN, y)
        d.cell(0, 20, title)
        d.set_font("sans", "", 14)
        d.set_text_color(*MUTED)
        d.set_xy(MARGIN + 330, y)
        d.multi_cell(W - 2 * MARGIN - 330, 20, text, align="L")
        y += 52
    d.slide_footer("Technical Feasibility")


def slide_ecosystem(d: Deck) -> None:
    d.new_slide()
    d.kicker("Ecosystem contribution")
    top = d.headline("Findings the ecosystem can use, not just a demo.")
    items = [
        "Six measured findings for Portaldot, documented with reproduction steps: "
        "fee model, deposit semantics, dry-run limits, WSS connect, unavailable equivalents.",
        "A GitHub Action any team can run as a pre-deploy cost gate.",
        "An evidence standard: anchored reports anyone can recompute from the repo.",
        "Adoption outreach prepared. No team results claimed yet.",
    ]
    y = max(150, top + 16)
    for text in items:
        d.set_font("sans", "", 15)
        d.set_text_color(*TEXT)
        d.set_xy(MARGIN, y)
        d.multi_cell(W - 2 * MARGIN, 21, "·  " + text, align="L")
        y += 76
    d.slide_footer("Ecosystem Contribution")


def slide_business(d: Deck) -> None:
    d.new_slide()
    d.kicker("Business model")
    d.headline("Free to use. Paid when it runs for you.")
    d.panel(MARGIN, 150, 408, 170)
    d.set_font("sans", "B", 17)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 24, 170)
    d.cell(0, 22, "Free, open source (MIT)")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 24, 200)
    d.multi_cell(360, 22, "The app, Fee Lab, CLI, GitHub Action, and the "
           "attestation registry.", align="L")
    d.panel(MARGIN + 440, 150, 408, 170)
    d.set_font("sans", "B", 17)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN + 464, 170)
    d.cell(0, 22, "Paid, when there is demand")
    d.set_font("sans", "", 15)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 464, 200)
    d.multi_cell(360, 22, "Hosted monitoring with alerts for node operators. "
           "A managed pre-deploy cost gate with history for teams and CI.",
           align="L")
    d.set_font("sans", "", 15)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN, 340)
    d.multi_cell(W - 2 * MARGIN, 21,
                 "Targets: Portaldot builders, node operators, wallets and dApps "
                 "that need EVM vs native routing.", align="L")
    d.set_font("sans", "", 14)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, 400)
    d.multi_cell(W - 2 * MARGIN, 20,
                 "Sizing, honestly: no total market claimed. Only verified "
                 "counts are used.", align="L")
    d.slide_footer("Business Potential")


def slide_roadmap_team(d: Deck) -> None:
    d.new_slide()
    d.kicker("Roadmap · Team")
    d.headline("What happens next.")
    steps = [
        ("Hosted monitoring and alerts",
         "For node operators, when demand exists."),
        ("Pre-deploy cost gate in CI",
         "The GitHub Action as a check teams run before deploying."),
        ("Mainnet check",
         "The mainnet profile becomes a live check when a public mainnet EVM "
         "RPC is verified."),
        ("GitHub Action on Marketplace",
         "Publish the action so any team can add it in one step."),
    ]
    y = 150
    for title, text in steps:
        d.set_font("sans", "B", 15)
        d.set_text_color(*TEXT)
        d.set_xy(MARGIN, y)
        d.cell(280, 20, title)
        d.set_font("sans", "", 15)
        d.set_text_color(*MUTED)
        d.set_xy(MARGIN + 290, y)
        d.multi_cell(W - 2 * MARGIN - 290, 21, text, align="L")
        y += 52
    d.set_font("sans", "B", 15)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN, 380)
    d.cell(0, 20, "Team: Firza Duta Fauzan, solo builder.")
    d.set_font("sans", "B", 16)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN, 420)
    d.cell(0, 22, "Verify it yourself: nodescope.vercel.app/verify")
    d.slide_footer("Business Potential  ·  Ecosystem Contribution")


def build() -> None:
    d = Deck()
    slide_title(d)
    slide_problem(d)
    slide_solution(d)
    slide_demo(d)
    slide_evidence(d)
    slide_fees(d)
    slide_tech(d)
    slide_ecosystem(d)
    slide_business(d)
    slide_roadmap_team(d)
    assert d.slide_no == 10, f"expected 10 slides, got {d.slide_no}"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    d.output(str(OUT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, 10 slides)")


if __name__ == "__main__":
    build()
