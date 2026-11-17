"""Render card screenshots for the docs from the demo page (docs/demo-app).

Usage (after `npm run build`; set CHROMIUM_PATH to reuse an installed Chromium):
    pip install -r requirements-screenshots.txt
    python scripts/docs-screenshots.py

Writes docs/assets/shots/<name>-light.png and <name>-dark.png.
The clock is frozen so the output is reproducible. The demo page supplies the
mock Home Assistant entities and real MDI icons.
"""

import functools
import http.server
import os
import pathlib
import shutil
import sys
import threading
from typing import Any

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO = ROOT / "docs" / "demo-app"
OUT = ROOT / "docs" / "assets" / "shots"

# Frozen time: Berlin shows 12:10:30 on 2026-11-15.
FIXED_TIME = "2026-11-15T11:10:30Z"
STAGE_WIDTH_PX = 560

HEATING = "input_select.heating_mode"
STATES_WITH_ICONS = [
    {"value": "Off", "icon": "mdi:power"},
    {"value": "Auto", "icon": "mdi:calendar-clock"},
    {"value": "On", "icon": "mdi:fire"},
    {"value": "Idle", "icon": "mdi:sleep"},
]
BERLIN_ANALOG = {"display": "analog", "time_zone": "Europe/Berlin", "seconds": True, "face": {"numbers": "quarters"}}

# Output name -> card config (type is added automatically).
SHOTS: dict[str, dict[str, Any]] = {
    # State and switches
    "state": {"entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "states": STATES_WITH_ICONS},
    "state-overhang": {"entity": HEATING, "name": "Overhang", "handle_overhang": True, "handle_shape": "oval", "states": STATES_WITH_ICONS},
    "state-vertical": {"entity": HEATING, "name": "Vertical", "orientation": "vertical", "length": 180, "states": STATES_WITH_ICONS},
    "switches": {
        "entity": HEATING,
        "states": STATES_WITH_ICONS,
        "switches": {
            "start": {"icon": "mdi:power", "tap_action": {"action": "none"}},
            "mid": {"icon": "mdi:cog", "tap_action": {"action": "none"}},
            "end": {"icon": "mdi:fire", "tap_action": {"action": "none"}},
        },
    },
    # Lock, value, counter
    "lock": {"entity": "lock.front_door", "name": "Front door", "mode": "lock"},
    "value": {"entity": "sensor.living_room_temperature", "mode": "value", "preset": "thermometer", "name": "Living room"},
    "value-scale": {"entity": "sensor.battery_soc", "mode": "value", "preset": "soc", "name": "Battery", "scale": {"ticks": 10, "labels": True}},
    "counter": {"entity": "counter.guests", "name": "Guests", "bar_text": "{value} of 10", "counter": {"max": 10}},
    # Timer
    "timer": {"entity": "timer.sauna", "name": "Sauna", "timer": {"info": "{state}"}},
    "timer-paused": {"entity": "timer.tea", "name": "Tea", "timer": {"info": "{state}"}},
    "timer-date": {
        "entity": "input_datetime.festival", "mode": "timer", "name": "Festival",
        "timer": {"info": "{remaining_text} to go", "span": 7},
    },
    "timer-vertical": {"entity": "timer.sauna", "name": "Sauna", "orientation": "vertical", "length": 200, "timer": {"info": "{remaining}"}},
    # Clock
    "clock-digital": {"mode": "clock", "name": "Berlin", "clock": {"time_zone": "Europe/Berlin", "hour_format": 24, "seconds": True}},
    "clock-analog": {"mode": "clock", "name": "Berlin", "thickness": 56, "handle_size": 64, "clock": BERLIN_ANALOG},
    "clock-large": {
        "mode": "clock", "name": "New York", "thickness": 40, "handle_size": 112,
        "clock": {"display": "analog", "time_zone": "America/New_York", "hour_format": 12, "seconds": True, "face": {"numbers": "all"}},
    },
    "clock-colors": {
        "mode": "clock", "name": "Colors", "thickness": 56, "handle_size": 72,
        "fill_color": "#ff9800", "bar_color": "#37474f", "handle_color": "#fff8e1",
        "styles": {"dial-color": "#ff6f00", "hands-color": "#263238", "second-hand-color": "#d32f2f"},
        "clock": BERLIN_ANALOG,
    },
    # Bar value, colors, header, text
    "bar-entity": {
        "entity": "timer.sauna", "name": "Sauna", "bar_text": "{value}",
        "bar": {"entity": "sensor.living_room_temperature", "min": 0, "max": 40, "unit": "°C", "decimals": 1},
    },
    "colors": {
        "entity": "sensor.battery_soc", "mode": "value", "preset": "soc", "name": "Battery",
        "bar_color": "#263238", "fill_color": "#4caf50", "handle_color": "#e8f5e9", "text_color": "#1b5e20",
        "scale": {"ticks": 10},
    },
    "colors-warm": {
        "entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "states": STATES_WITH_ICONS,
        "bar_color": "#4e342e", "fill_color": "#ff7043", "handle_color": "#fff3e0", "handle_shape": "square",
    },
    "state-color": {
        "entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "bar_state_color": True,
        "states": [
            {"value": "Off", "icon": "mdi:power", "color": "blue"},
            {"value": "Auto", "icon": "mdi:calendar-clock", "color": "green"},
            {"value": "On", "icon": "mdi:fire", "color": "red"},
            {"value": "Idle", "icon": "mdi:sleep", "color": "orange"},
        ],
    },
    "header-icon-right": {"entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "header_icon_position": "right", "states": STATES_WITH_ICONS},
    "header-bottom": {"entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "header_position": "bottom", "states": STATES_WITH_ICONS},
    "header-text": {
        "entity": HEATING, "name": "Heating", "icon": "mdi:radiator", "states": STATES_WITH_ICONS,
        "text": {"header": {"font_size": 18, "color": "#ff9800", "icon_color": "#2196f3"}},
    },
    "text-appearance": {
        "entity": "timer.tea", "name": "Tea", "icon": "mdi:timer-outline", "bar_text": "{state}",
        "thickness": 56, "handle_size": 52,
        "text": {
            "header": {"font_size": 16, "color": "#ff9800", "icon_color": "#2196f3"},
            "bar": {"font_size": 14},
            "button": {"font_size": 15},
        },
    },
}

STAGE_CSS = (
    f"#stage {{ width: {STAGE_WIDTH_PX}px; border: 0 !important; min-height: 0 !important; }}"
    " body { background: transparent !important; }"
)

RENDER_JS = """
(config) => {
  const stage = document.getElementById("stage");
  stage.replaceChildren();
  const card = document.createElement("slabton-card");
  card.setConfig({ type: "custom:slabton-card", ...config });
  card.hass = window.SLABTON_MOCK.hass;
  stage.appendChild(card);
}
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        """Silence per-request logging."""


def serve_demo() -> tuple[http.server.ThreadingHTTPServer, str]:
    """Serve docs/demo-app on a free local port (fetch() of icons.json needs http)."""
    handler = functools.partial(QuietHandler, directory=str(DEMO))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/index.html"


def capture(page: Page, theme: str) -> None:
    for name, config in SHOTS.items():
        page.evaluate(RENDER_JS, config)
        page.wait_for_timeout(250)
        page.locator("#stage").screenshot(path=str(OUT / f"{name}-{theme}.png"))


def main() -> None:
    built = ROOT / "dist" / "slabton.js"
    if not built.exists():
        sys.exit("dist/slabton.js missing, run `npm run build` first")
    shutil.copyfile(built, DEMO / "slabton.js")
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True, exist_ok=True)
    server, url = serve_demo()
    try:
        with sync_playwright() as p:
            # Optional: CHROMIUM_PATH points at an existing chrome executable (skips `playwright install`).
            browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
            context = browser.new_context(
                viewport={"width": 700, "height": 900},
                device_scale_factor=2,
                reduced_motion="reduce",
                locale="en-US",
                timezone_id="UTC",
                color_scheme="light",
            )
            page = context.new_page()
            page.clock.set_fixed_time(FIXED_TIME)
            page.goto(url)
            page.add_style_tag(content=STAGE_CSS)
            page.wait_for_selector("slabton-card")
            capture(page, "light")
            page.click("#theme")
            page.wait_for_timeout(200)
            capture(page, "dark")
            browser.close()
    finally:
        server.shutdown()
    print(f"wrote {len(SHOTS) * 2} images to {OUT}")


if __name__ == "__main__":
    main()
