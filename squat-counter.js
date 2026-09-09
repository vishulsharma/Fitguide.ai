const CONFIG = {
  TOP_ANGLE: 160,     // knee angle considered "standing" (deg)
  BOTTOM_ANGLE: 100,  // knee angle considered "bottom of squat" (deg)
  DEBOUNCE_FRAMES: 5, // frames below/above threshold before state flips (anti-jitter)
  SMOOTHING: 5,       // simple moving-average window for knee angles
  MIN_REP_DEPTH: 90,  // deepest angle seen must go below this or the cycle is discarded
};

const State = Object.freeze({
  STANDING: 'STANDING',
  DESCENDING: 'DESCENDING',
  BOTTOM: 'BOTTOM',
  ASCENDING: 'ASCENDING',
});

class SquatCounter {
  constructor(cfg = CONFIG) {
    this.cfg = cfg;
    this.reset();
    this._bufL = [];
    this._bufR = [];
  }

  reset() {
    this.reps = 0;
    this.state = State.STANDING;
    this.depth = 0;           // 0..1, how deep into the squat we are
    this.minAngleThisRep = 180;
    this._framesBelow = 0;    // consecutive frames below BOTTOM_ANGLE
    this._framesAbove = 0;    // consecutive frames near TOP_ANGLE
    this.lastRepAt = null;
  }

  /** Simple moving average */
  _smooth(buf, v) {
    buf.push(v);
    if (buf.length > this.cfg.SMOOTHING) buf.shift();
    return buf.reduce((a, b) => a + b, 0) / buf.length;
  }

  /**
   * Feed one frame of knee angles (degrees).
   * @returns {object} {repCounted:boolean, angle:number, state:string, depth:number}
   */
  update(leftKneeAngle, rightKneeAngle) {
    const angle = this._smooth(this._bufL, leftKneeAngle);
    const angleR = this._smooth(this._bufR, rightKneeAngle);
    // Use the more-bent (smaller-angle) side — stricter and more realistic
    const knee = Math.min(angle, angleR);

    // Depth meter: 0 at top angle, 1 at/below bottom angle
    const span = this.cfg.TOP_ANGLE - this.cfg.BOTTOM_ANGLE;
    this.depth = Math.max(0, Math.min(1, (this.cfg.TOP_ANGLE - knee) / span));
    this.minAngleThisRep = Math.min(this.minAngleThisRep, knee);

    let repCounted = false;
    switch (this.state) {
      case State.STANDING:
        if (knee < this.cfg.TOP_ANGLE - 10) {
          this.state = State.DESCENDING;
          this.minAngleThisRep = knee;
        }
        break;

      case State.DESCENDING:
        if (knee <= this.cfg.BOTTOM_ANGLE) {
          if (++this._framesBelow >= this.cfg.DEBOUNCE_FRAMES) {
            this.state = State.BOTTOM;
            this._framesBelow = 0;
          }
        } else {
          this._framesBelow = 0;
          if (knee >= this.cfg.TOP_ANGLE) this.state = State.STANDING; // never got deep enough
        }
        break;

      case State.BOTTOM:
        if (knee >= this.cfg.TOP_ANGLE) {
          if (++this._framesAbove >= this.cfg.DEBOUNCE_FRAMES) {
            this._framesAbove = 0;
            // Only count if we truly hit depth
            if (this.minAngleThisRep <= this.cfg.MIN_REP_DEPTH) {
              this.reps++;
              repCounted = true;
              this.lastRepAt = Date.now();
            }
            this.minAngleThisRep = 180;
            this.state = State.STANDING;
          }
        } else {
          this._framesAbove = 0;
        }
        break;
    }

    return { repCounted, angle: knee, state: this.state, depth: this.depth };
  }
}

// Export for browser + Node (tests)
if (typeof module !== 'undefined') module.exports = { SquatCounter, CONFIG, State };