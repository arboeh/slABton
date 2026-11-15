"""Render card screenshots for the docs from preview/preview.html.

Usage (after `npm run build`; set CHROMIUM_PATH to reuse an installed Chromium):
    pip install -r requirements-screenshots.txt
    python scripts/docs-screenshots.py

Writes docs/assets/shots/<name>-light.png and <name>-dark.png.
The clock is frozen so the output is reproducible.
"""

import os
import pathlib
import sys

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "preview" / "preview.html"
OUT = ROOT / "docs" / "assets" / "shots"

# Frozen time: Berlin shows 12:10:30 on 2026-11-15.
FIXED_TIME = "2026-11-15T11:10:30Z"

# Output name -> label of the cell in preview.html.
SHOTS = {
    "state": "state, horizontal",
    "state-overhang": "state, handle overhang",
    "state-vertical": "state, vertical",
    "lock": "lock, swipe",
    "value": "value, thermometer",
    "value-scale": "scale labels, value (min / max)",
    "counter": "counter (tap +1, double tap -1)",
    "timer": "timer (tap pause/start, hold cancel)",
    "clock-digital": "clock (Berlin, seconds)",
    "clock-analog": "analog clock, 64 px, seconds, quarters",
    "bar-entity": "bar from another entity",
}

# Cells whose config is replaced for a cleaner picture (name -> config).
OVERRIDES = {
    "timer": {"entity": "timer.sauna", "name": "Sauna", "timer": {"info": "{state}"}},
}

HIDE_LABELS_CSS = ".cell small { display: none !important; } .cell { box-shadow: none !important; }"


def capture(page: Page, theme: str) -> None:
    for name, label in SHOTS.items():
        cell = page.locator(".cell", has=page.locator("small", has_text=label)).first
        if cell.count() == 0:
            sys.exit(f"cell not found: {label!r}")
        override = OVERRIDES.get(name)
        if override is not None:
            cell.locator("slabton-card").evaluate(
                "(el, cfg) => el.setConfig({ type: 'custom:slabton-card', ...cfg })", override
            )
            page.wait_for_timeout(150)
        cell.screenshot(path=str(OUT / f"{name}-{theme}.png"))


def main() -> None:
    if not (ROOT / "dist" / "slabton.js").exists():
        sys.exit("dist/slabton.js missing, run `npm run build` first")
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        # Optional: CHROMIUM_PATH points at an existing chrome executable (skips `playwright install`).
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        context = browser.new_context(
            viewport={"width": 600, "height": 900},
            device_scale_factor=2,
            reduced_motion="reduce",
            locale="en-US",
            timezone_id="UTC",
        )
        page = context.new_page()
        page.clock.set_fixed_time(FIXED_TIME)
        page.goto(PREVIEW.as_uri())
        page.add_style_tag(content=HIDE_LABELS_CSS)
        page.wait_for_selector("slabton-card")
        page.wait_for_timeout(500)
        capture(page, "light")
        page.click("#theme")
        page.wait_for_timeout(200)
        capture(page, "dark")
        browser.close()
    print(f"wrote {len(SHOTS) * 2} images to {OUT}")


if __name__ == "__main__":
    main()
