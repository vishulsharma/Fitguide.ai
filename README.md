🏋️ Squat Counter (Browser + Local Server)

Real-time squat rep counting using your webcam, TensorFlow.js and MoveNet.
Everything runs locally in the browser — no cloud, no backend.

Quick start

Any static server works. From this folder:

```bash
# Option A — Python
python3 -m http.server 8000

# Option B — Node
npx serve -l 8000 .
```

Then open http://localhost:8000 (webcam requires `localhost` or HTTPS).

Try it without a camera

Open the page and drag the simulation slider at the bottom:
- 170° = standing, 90° = bottom of squat
- One full down → up cycle counts 1 rep

Controls

Button	Action	
Start	Begin webcam tracking	
Stop	Pause tracking	
Reset	Zero the rep counter	
Save Session	Store reps + duration to localStorage	

Tuning

Edit the `CONFIG` object at the top of `squat-counter.js`:

```js
const CONFIG = {
  TOP_ANGLE: 160,     // degrees — considered "standing"
  BOTTOM_ANGLE: 100,  // degrees — considered "squat bottom"
  DEBOUNCE_FRAMES: 5, // anti-jitter frames
  SMOOTHING: 5,       // moving-average window
  MIN_REP_DEPTH: 90,  // must go at least this deep to count
};
```

Files

File	Purpose	
`squat-counter.js`	Pure counting state machine (no DOM — unit-testable)	
`app.js`	Webcam, MoveNet, skeleton overlay, UI, history	
`index.html`	Page layout	
`style.css`	Styling	
`test.js`	Node test for the counting logic (`node test.js`)	

How counting works

1. MoveNet returns 17 body keypoints per frame.
2. Knee angle = angle at the knee between hip → knee → ankle.
3. State machine: `STANDING → DESCENDING → BOTTOM → (back to) STANDING` = 1 rep.
4. A rep only counts if depth reached ≤ `MIN_REP_DEPTH`, with frame debouncing
   to stop double-counts.

Next steps (hand-off ideas for Claude Code)

- Calibrate TOP/BOTTOM angles to the user's proportions on first rep
- Form feedback (knees caving in, torso lean) using hip-knee-ankle alignment
- Voice announcements every 10 reps
- Export history as CSV
- Phone support over LAN (serve on `0.0.0.0`, responsive layout)
