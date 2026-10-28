#!/usr/bin/env python3
"""Build the public NodeScope pitch deck (public/pitch-deck.pdf).

The deck is judge-facing: English, visual, one idea per slide, no internal
status notes. Every number on it is a verified fact, not a claim:

- registry, deploy tx/block, and the three anchor hashes/txs/blocks come
  from deployments/portaldot-v3.json (see docs/EVIDENCE.md);
- the fee figures come from the anchored Fee Lab report
  (evidence/reports/fee-2026-10-27.json): EVM 124.098 tPOT, native
  all-in 122.191 tPOT, all-in ratio 1.0156, fee-only ratio 803.68;
- test counts come from the suite itself (520 tests, 76 files).

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

# Brand palette, matching the app (src/index.css): PAPER is the printed lab
# report, GRAPHITE the live readout band, one calibration-orange signal.
PAPER_THEME = dict(
    INK=(241, 237, 228),      # page background (paper)
    PANEL=(234, 229, 218),
    LINE=(205, 198, 184),
    ACCENT=(178, 60, 5),      # signal-ink on paper, AA contrast
    TEXT=(18, 18, 16),
    MUTED=(86, 80, 70),
    FAINT=(140, 132, 118),
    SIGNAL=(255, 91, 20),
)
GRAPHITE_THEME = dict(
    INK=(18, 18, 16),
    PANEL=(28, 27, 24),
    LINE=(58, 55, 49),
    ACCENT=(255, 138, 76),
    TEXT=(241, 237, 228),
    MUTED=(176, 168, 154),
    FAINT=(120, 113, 101),
    SIGNAL=(255, 91, 20),
)
INK = PANEL = LINE = ACCENT = TEXT = MUTED = FAINT = SIGNAL = (0, 0, 0)


def use_theme(theme: dict) -> None:
    globals().update(theme)


use_theme(PAPER_THEME)

FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONTS = {
    ("sans", ""): "Geist-Regular.ttf",
    ("sans", "B"): "Geist-SemiBold.ttf",
    ("mono", ""): "GeistMono-Regular.ttf",
    ("mono", "B"): "GeistMono-Medium.ttf",
    ("serif", ""): "InstrumentSerif-Regular.ttf",
    ("serif", "I"): "InstrumentSerif-Italic.ttf",
}


def pick_fonts(pdf: FPDF) -> dict[str, str]:
    """Register the app's own typefaces: Geist, Geist Mono, Instrument Serif."""
    for (family, style), file in FONTS.items():
        pdf.add_font(family, style, str(FONT_DIR / file))
    return {"sans": "sans", "mono": "mono", "serif": "serif"}


class Deck(FPDF):
    def __init__(self) -> None:
        super().__init__(unit="pt", format=(W, H))
        self.set_auto_page_break(auto=False)
        self.font_families = pick_fonts(self)
        self.slide_no = 0
        self.set_title("NodeScope - Portaldot Hacker House 2026")
        self.set_author("Firza Duta Fauzan")

    # -- primitives -----------------------------------------------------
    def new_slide(self, dark: bool = False) -> None:
        use_theme(GRAPHITE_THEME if dark else PAPER_THEME)
        self.add_page()
        self.slide_no += 1
        self.set_fill_color(*INK)
        self.rect(0, 0, W, H, style="F")
        # Calibration frame: corner ticks, like the app's report cards.
        self.set_draw_color(*LINE)
        self.set_line_width(0.8)
        t, m = 14, 22
        for x, y, dx, dy in ((m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)):
            self.line(x, y, x + dx * t, y)
            self.line(x, y, x, y + dy * t)
        # Running head
        self.set_font("mono", "", 8.5)
        self.set_text_color(*FAINT)
        self.set_xy(W - MARGIN - 300, 30)
        self.cell(300, 10, "NODESCOPE  /  PORTALDOT V3  /  CHAIN 420420777", align="R")

    def set_font(self, family: str, style: str = "", size: float = 0) -> None:
        tag = self.font_families.get(family, family)
        if (tag, style) not in FONTS and style == "B" and tag == "serif":
            style = ""
        super().set_font(tag, style, size)

    def kicker(self, text: str) -> None:
        self.set_fill_color(*SIGNAL)
        self.rect(MARGIN, 49, 7, 7, style="F")
        self.set_font("mono", "B", 10)
        self.set_text_color(*ACCENT)
        self.set_xy(MARGIN + 16, 46)
        self.cell(0, 13, text.upper())

    def headline(self, text: str, size: float = 40) -> float:
        # Instrument Serif, left-aligned (never justified). Returns the y below
        # the last line so content can follow the headline's real height.
        self.set_font("serif", "", size)
        self.set_text_color(*TEXT)
        self.set_xy(MARGIN, 72)
        self.multi_cell(W - 2 * MARGIN, size * 1.08, text, align="L")
        return self.get_y()

    def body(self, text: str, y: float, size: float = 15, color=None) -> None:
        self.set_font("sans", "", size)
        self.set_text_color(*(color or MUTED))
        self.set_xy(MARGIN, y)
        self.multi_cell(W - 2 * MARGIN, size + 7, text, align="L")

    def slide_footer(self, criterion: str) -> None:
        self.set_draw_color(*LINE)
        self.set_line_width(0.6)
        self.line(MARGIN, H - 48, W - MARGIN, H - 48)
        self.set_font("mono", "", 8.5)
        self.set_text_color(*FAINT)
        self.set_xy(MARGIN, H - 40)
        self.cell(0, 12, f"NODESCOPE  ·  {criterion.upper()}")
        self.set_xy(W - MARGIN - 80, H - 40)
        self.cell(80, 12, f"{self.slide_no:02d} / 10", align="R")

    def panel(self, x: float, y: float, w: float, h: float) -> None:
        self.set_fill_color(*PANEL)
        self.set_draw_color(*LINE)
        self.set_line_width(0.6)
        self.rect(x, y, w, h, style="DF")
        # signal tick on the top-left corner
        self.set_draw_color(*SIGNAL)
        self.set_line_width(1.6)
        self.line(x, y, x + 18, y)
        self.line(x, y, x, y + 18)
        self.set_line_width(0.6)

    def chip(self, x: float, y: float, text: str) -> float:
        self.set_font("mono", "B", 11)
        tw = self.get_string_width(text) + 28
        self.set_draw_color(*ACCENT)
        self.set_fill_color(*INK)
        self.set_line_width(0.8)
        self.rect(x, y, tw, 28, style="DF")
        self.set_text_color(*ACCENT)
        self.set_xy(x, y + 8)
        self.cell(tw, 12, text, align="C")
        return x + tw + 12

    def mono_line(self, x: float, y: float, label: str, value: str) -> None:
        self.set_font("mono", "", 9)
        self.set_text_color(*FAINT)
        self.set_xy(x, y)
        self.cell(120, 13, label.upper())
        self.set_font("mono", "", 9.5)
        self.set_text_color(*TEXT)
        self.set_xy(x + 120, y)
        self.cell(0, 13, value)

    def reticle(self, cx: float, cy: float, r: float, ink=None) -> None:
        """The NodeScope mark: ring, dashed inner ring, crosshair ticks, needle."""
        ink = ink or TEXT
        u = r / 26.0
        self.set_draw_color(*ink)
        self.set_line_width(2.5 * u)
        self.circle(cx, cy, 26 * u, style="D") if hasattr(self, "circle") else self.ellipse(cx - 26 * u, cy - 26 * u, 52 * u, 52 * u)
        self.set_line_width(1.5 * u)
        import math
        n = int(2 * math.pi * 15 / 5)
        for i in range(n):
            a0 = i * 5 / 15
            a1 = (i * 5 + 2) / 15
            self.line(cx + 15 * u * math.cos(a0), cy + 15 * u * math.sin(a0),
                      cx + 15 * u * math.cos(a1), cy + 15 * u * math.sin(a1))
        self.set_line_width(2.5 * u)
        for x1, y1, x2, y2 in ((0, -30, 0, -20), (0, 20, 0, 30), (-30, 0, -20, 0), (20, 0, 30, 0)):
            self.line(cx + x1 * u, cy + y1 * u, cx + x2 * u, cy + y2 * u)
        self.set_draw_color(*SIGNAL)
        self.line(cx, cy, cx + 13 * u, cy - 13 * u)
        self.set_fill_color(*SIGNAL)
        self.ellipse(cx + 13 * u - 4 * u, cy - 13 * u - 4 * u, 8 * u, 8 * u, style="F")
        self.set_fill_color(*ink)
        self.ellipse(cx - 3.5 * u, cy - 3.5 * u, 7 * u, 7 * u, style="F")
        self.set_line_width(0.6)


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
    d.new_slide(dark=True)
    d.reticle(W - 230, 250, 150)
    d.set_fill_color(*SIGNAL)
    d.rect(MARGIN, 83, 7, 7, style="F")
    d.set_font("mono", "B", 10)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN + 16, 80)
    d.cell(0, 13, "PORTALDOT HACKER HOUSE 2026  ·  NODE OPERATIONS AND TOOLING")
    d.set_font("serif", "", 104)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN - 4, 112)
    d.cell(0, 110, "NodeScope")
    d.set_font("serif", "I", 34)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN, 226)
    d.cell(0, 40, "Node truth suite for Portaldot V3")
    d.set_font("sans", "", 16)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, 276)
    d.cell(0, 22, "Two pillars. One evidence discipline.")
    x = MARGIN
    for chip in ("HEALTH", "FEES", "EVIDENCE"):
        x = d.chip(x, 318, chip)
    d.set_draw_color(*LINE)
    d.line(MARGIN, 404, W - MARGIN, 404)
    d.set_font("mono", "", 10)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN, 416)
    d.cell(0, 14, "nodescope.vercel.app   ·   github.com/Firzadf/nodescope")
    d.set_xy(MARGIN, 436)
    d.cell(0, 14, "dorahacks.io/build/50146   ·   demo  youtu.be/14aZxVTCrz0")


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
    d.multi_cell(360, 22, "Health Score 0-100 with every point explained. "
           "Watch & Discord/Slack alerts. Reports verified by SHA-256.", align="L")
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
    d.cell(0, 22, "Nothing polls unless you start Watch. Every score point "
           "explained. No simulated data.")
    d.slide_footer("Innovation  ·  Technical Feasibility")


def slide_demo(d: Deck) -> None:
    d.new_slide()
    d.kicker("Demo flow · 60 seconds")
    top = d.headline("From endpoint to verified report in five steps.")
    steps = [
        ("01", "Open /app. The testnet endpoint is already filled in."),
        ("02", "Run full diagnostic: connect, health check, capability discovery, "
               "Substrate probe, snapshot, combined verdict."),
        ("03", "Read the verdict and Health Score: a stalled head reads DEGRADED "
               "even when every RPC answers, with the lost points named."),
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
    d.new_slide(dark=True)
    d.kicker("Fees finding · Measured 27 Oct 2026 · Contract deploy")
    top = d.headline("The headline says 804x. The bill says 1.016x.")
    ny = max(160, top + 18)
    d.panel(MARGIN, ny, 400, 150)
    d.panel(MARGIN + 448, ny, 400, 150)
    d.set_font("serif", "", 84)
    d.set_text_color(*MUTED)
    d.set_xy(MARGIN + 24, ny + 14)
    d.cell(360, 88, "804x")
    d.set_font("mono", "", 10)
    d.set_text_color(*FAINT)
    d.set_xy(MARGIN + 26, ny + 110)
    d.cell(360, 14, "FEE-ONLY  ·  THE HEADLINE")
    d.set_font("serif", "", 84)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN + 472, ny + 14)
    d.cell(360, 88, "1.016x")
    d.set_font("mono", "", 10)
    d.set_text_color(*ACCENT)
    d.set_xy(MARGIN + 474, ny + 110)
    d.cell(360, 14, "ALL-IN  ·  WHAT YOU PAY")
    d.set_font("mono", "", 11)
    d.set_text_color(*TEXT)
    d.set_xy(MARGIN, ny + 170)
    d.cell(0, 16, "EVM deploy 124.098 tPOT   ·   Native all-in 122.191 tPOT   ·   within 2%")
    d.body("Most of the gap is a 122.037 tPOT storage deposit on the native side. "
           "A deposit is a hold, not a burned fee: it is refundable when storage "
           "is freed. The EVM figure already folds it in.", ny + 198, size=14)
    d.set_font("mono", "", 9)
    d.set_text_color(*FAINT)
    d.set_xy(MARGIN, H - 66)
    d.cell(0, 12, "tPOT IS A TESTNET TOKEN WITH NO MARKET PRICE.")
    d.slide_footer("Innovation")


def slide_tech(d: Deck) -> None:
    d.new_slide()
    d.kicker("Engineering")
    top = d.headline("Built to be rechecked, not to be believed.")
    items = [
        ("520 tests across 76 files", "Vitest, run on every push."),
        ("5/5 Foundry contract tests", "The attestation contract, tested in isolation."),
        ("CI on Ubuntu and Windows", "Node on both; Foundry on Ubuntu."),
        ("CLI and GitHub Action", "check and fees without the browser; a pre-deploy "
         "cost gate teams can run."),
        ("Deterministic comparison", "Same inputs, same diff. Reports verified by SHA-256."),
        ("Read-only by design", "No wallet, no signing. Watch runs only when you start it."),
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
        ("Hosted 24/7 monitoring",
         "Watch & alerts already run in the browser and CLI; hosted, when demand exists."),
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
