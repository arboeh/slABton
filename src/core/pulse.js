/*
 * Pulse tracking for the timer mode: remembers the previous timer sample and
 * decides when the bar pulses (a timer ran out), for how long, and when a tap
 * or a restart ends the pulse. No DOM and no clock of its own: the caller
 * passes `now` and the new sample.
 */

import { detectExpiry } from "./modes/timer.js";

export class Pulse {
  constructor() {
    this.reset();
  }

  /** Forget everything (new config, card removed). */
  reset() {
    this._previous = null; // last timing sample
    this._firedFor = null; // end time that already pulsed
    this.until = 0; // end of the running pulse in ms, Infinity until a tap, 0 = none
  }

  /** True while the bar pulses. */
  get active() {
    return this.until > 0;
  }

  /**
   * Feed the new timer sample taken at `now`; starts or ends the pulse.
   * `options` is `{ pulse, pulse_seconds }` of the timer config.
   */
  advance(current, now, { pulse, pulse_seconds: seconds }) {
    if (this.active && now >= this.until) this.until = 0;
    // Each end time pulses once, even when Home Assistant reports the end late.
    const previousEnd = this._previous?.finishesAt ?? null;
    if (pulse && !this.active && previousEnd !== this._firedFor && detectExpiry(this._previous, current, now)) {
      this._firedFor = previousEnd;
      this.until = seconds > 0 ? now + seconds * 1000 : Infinity;
    } else if (current?.active && (current.finishesAt == null || current.upcoming)) {
      this.until = 0; // the timer runs again
    }
    this._previous = current;
  }

  /** A tap ends the pulse. Returns true when a pulse was running. */
  dismiss() {
    if (!this.active) return false;
    this.until = 0;
    this._previous = null;
    return true;
  }
}
