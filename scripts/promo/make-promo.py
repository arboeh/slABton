"""Record the slABton promo video (about 30 s) from the real card.

Usage (after `npm run build`; needs playwright and ffmpeg on PATH):
    python scripts/promo/make-promo.py

Renders scripts/promo/promo.html with docs/demo-app/slabton.js and the mock Home
Assistant, drives the handles with real mouse drags and writes
docs/assets/promo/slabton-promo.{mp4,webm,gif} plus a poster image.
"""

import functools
import http.server
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "assets" / "promo"
WIDTH, HEIGHT = 1280, 720
GIF_FILTER = (
    "fps=15,scale=800:-1:flags=lanczos,split[a][b];"
    "[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        """Silence per-request logging."""


def serve() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/scripts/promo/promo.html"


def box(page: Page, selector: str) -> Any:
    result = page.locator(selector).bounding_box()
    if result is None:
        raise RuntimeError(f"not visible: {selector}")
    return result


def drag(page: Page, scene: str, fraction: float, duration_ms: int = 600, card: int = 0) -> None:
    """Drag the handle of the `card`-th card in `scene` to `fraction` (0..1) of the bar in `duration_ms`."""
    handle = box(page, f"#{scene} .handle >> nth={card}")
    bar = box(page, f"#{scene} .bar >> nth={card}")
    start_x, y = handle["x"] + handle["width"] / 2, handle["y"] + handle["height"] / 2
    half = handle["width"] / 2
    target_x = bar["x"] + half + fraction * (bar["width"] - 2 * half)
    page.mouse.move(start_x, y)
    page.mouse.down()
    began = time.monotonic()
    while (progress := (time.monotonic() - began) * 1000 / duration_ms) < 1:
        eased = 1 - (1 - progress) ** 3  # ease-out; mouse calls pace the frames
        page.mouse.move(start_x + (target_x - start_x) * eased, y)
    page.mouse.move(target_x, y)
    page.mouse.up()


def timeline(page: Page) -> None:
    page.evaluate("show('intro')")
    page.wait_for_timeout(1200)

    page.evaluate("show('s-new')")  # stickshift: tap a point to jump straight to its state
    page.wait_for_timeout(900)
    for index in (2, 0, 1, 2, 0):
        page.locator("#s-new .sx-pt").nth(index).click()
        page.wait_for_timeout(900)
    page.wait_for_timeout(500)

    page.evaluate("show('s-state')")  # Auto -> On -> Off -> Idle
    page.wait_for_timeout(600)
    drag(page, "s-state", 0.67, 650)
    page.wait_for_timeout(350)
    drag(page, "s-state", 0.0, 800)
    page.wait_for_timeout(350)
    drag(page, "s-state", 1.0, 800)
    page.wait_for_timeout(450)

    page.evaluate("show('s-lock')")
    page.wait_for_timeout(600)
    drag(page, "s-lock", 1.0, 800)
    page.wait_for_timeout(700)
    drag(page, "s-lock", 0.0, 700)
    page.wait_for_timeout(300)

    page.evaluate("show('s-value')")
    page.wait_for_timeout(500)
    for value in (72, 81, 90, 98, 78, 55, 87):
        page.evaluate(
            "(v) => call('input_number', 'set_value', { value: v }, { entity_id: 'sensor.battery_soc' })", value
        )
        page.wait_for_timeout(190)
    page.wait_for_timeout(250)

    page.evaluate("show('s-scale')")  # scale on a state card and on a value card
    page.wait_for_timeout(700)
    drag(page, "s-scale", 0.67, 800, card=0)
    page.wait_for_timeout(300)
    for value in (35, 64, 92, 48):
        page.evaluate(
            "(v) => call('input_number', 'set_value', { value: v }, { entity_id: 'sensor.battery_soc' })", value
        )
        page.wait_for_timeout(450)
    drag(page, "s-scale", 0.0, 800, card=0)
    page.wait_for_timeout(500)

    page.evaluate("show('s-cover')")  # cover position by drag, switch and handle zone show the auto mode
    page.wait_for_timeout(700)
    drag(page, "s-cover", 0.25, 900)
    page.wait_for_timeout(500)
    drag(page, "s-cover", 1.0, 900)
    page.wait_for_timeout(600)

    page.evaluate("show('s-more')")
    page.wait_for_timeout(800)
    for _ in range(3):
        page.evaluate("call('counter', 'increment', {}, { entity_id: 'counter.guests' })")
        page.wait_for_timeout(280)
    page.wait_for_timeout(400)

    page.evaluate("show('outro')")
    page.wait_for_timeout(1300)


def ffmpeg(raw: pathlib.Path, *args: str, start: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", start, "-i", str(raw), *args], check=True)


def encode(raw: pathlib.Path, trim: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg(raw, "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "17", "-preset", "slow",
           "-movflags", "+faststart", "-an", str(OUT / "slabton-promo.mp4"), start=trim)
    ffmpeg(raw, "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-an", str(OUT / "slabton-promo.webm"), start=trim)
    ffmpeg(raw, "-vf", GIF_FILTER, str(OUT / "slabton-promo.gif"), start=trim)
    ffmpeg(raw, "-frames:v", "1", str(OUT / "slabton-promo-poster.png"), start=f"{float(trim) + 5.0:.2f}")


def main() -> None:
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")
    built = ROOT / "dist" / "slabton.js"
    if not built.exists():
        sys.exit("dist/slabton.js missing, run `npm run build` first")
    shutil.copyfile(built, ROOT / "docs" / "demo-app" / "slabton.js")
    server, url = serve()
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="slabton-promo-"))
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
            context = browser.new_context(
                viewport={"width": WIDTH, "height": HEIGHT}, record_video_dir=str(tmp),
                record_video_size={"width": WIDTH, "height": HEIGHT},
                locale="en-US", color_scheme="dark",
            )
            page = context.new_page()
            # The mock fetches icons.json next to the page; serve the demo's copy.
            page.route("**/icons.json", lambda route: route.fulfill(path=str(ROOT / "docs" / "demo-app" / "icons.json")))
            started = time.monotonic()
            page.goto(url)
            page.wait_for_selector("slabton-card", state="attached")
            page.wait_for_timeout(600)
            trim = f"{time.monotonic() - started - 0.1:.2f}"  # skip the blank load phase
            timeline(page)
            context.close()
            browser.close()
        encode(next(tmp.glob("*.webm")), trim)
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"wrote promo to {OUT}")


if __name__ == "__main__":
    main()
