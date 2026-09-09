const els = {
  video: document.getElementById('video'),
  canvas: document.getElementById('overlay'),
  reps: document.getElementById('repCount'),
  angle: document.getElementById('angleReadout'),
  depthBar: document.getElementById('depthFill'),
  flash: document.getElementById('flash'),
  repBadge: document.getElementById('repBadge'),
  status: document.getElementById('status'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  simSlider: document.getElementById('simSlider'),
  simValue: document.getElementById('simValue'),
  historyList: document.getElementById('historyList'),
  chartCanvas: document.getElementById('chart'),
  timer: document.getElementById('timer'),
  saveBtn: document.getElementById('saveBtn')
};

const cameraToggleBtn = document.getElementById('cameraToggleBtn');

const counter = new SquatCounter(CONFIG);
let detector = null;
let running = false;
let rafId = null;
let sessionStart = null;
let timerInterval = null;
let useFrontCamera = true;

const SKELETON = [
  ['left_hip','left_knee'], ['left_knee','left_ankle'],
  ['right_hip','right_knee'], ['right_knee','right_ankle'],
  ['left_shoulder','left_hip'], ['right_shoulder','right_hip'],
  ['left_shoulder','right_shoulder'], ['left_hip','right_hip'],
];

/* ---------------- Camera ---------------- */
async function setupCamera(front = true) {
  els.status.textContent = 'Requesting camera…';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: front ? 'user' : 'environment' }, audio: false,
  });
  els.video.srcObject = stream;
  await new Promise(res => els.video.onloadedmetadata = res);
  els.video.play();
  els.canvas.width = els.video.videoWidth;
  els.canvas.height = els.video.videoHeight;
  els.status.textContent = 'Camera ready.';
}

async function loadModel() {
  els.status.textContent = 'Loading MoveNet model…';
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_FULL,
  });
  els.status.textContent = 'Model ready.';
}

/* ---------------- Angle math ---------------- */
function angle(a, b, c) { // angle at b, in degrees
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180 / Math.PI;
}

function keypointMap(pose) {
  const m = {};
  for (const kp of pose.keypoints) m[kp.name] = kp;
  return m;
}

/* ---------------- Main loop ---------------- */
async function loop() {
  if (!running) return;
  const poses = await detector.estimatePoses(els.video);
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

  if (poses.length === 0 || poses[0].score < 0.3) {
    els.status.textContent = 'No person detected…';
  } else {
    els.status.textContent = 'Tracking…';
    const kps = keypointMap(poses[0]);
    drawSkeleton(ctx, kps);
    const need = ['left_hip','left_knee','left_ankle','right_hip','right_knee','right_ankle'];
    if (need.every(n => kps[n] && kps[n].score > 0.3)) {
      const lKnee = angle(kps.left_hip, kps.left_knee, kps.left_ankle);
      const rKnee = angle(kps.right_hip, kps.right_knee, kps.right_ankle);
      handleResult(counter.update(lKnee, rKnee));
    }
  }
  rafId = requestAnimationFrame(loop);
}

function drawSkeleton(ctx, kps) {
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  for (const [a, b] of SKELETON) {
    if (kps[a]?.score > 0.3 && kps[b]?.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(kps[a].x, kps[a].y);
      ctx.lineTo(kps[b].x, kps[b].y);
      ctx.stroke();
    }
  }
  for (const kp of Object.values(kps)) {
    if (kp.score > 0.3) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ---------------- UI feedback ---------------- */
function handleResult(res) {
  els.angle.textContent = Math.round(res.angle) + '°';
  els.depthBar.style.width = (res.depth * 100) + '%';
  if (res.repCounted) {
    els.reps.textContent = counter.reps;
    els.flash.classList.remove('go');
    void els.flash.offsetWidth; // restart animation
    els.flash.classList.add('go');
    els.repBadge.classList.remove('pop');
    void els.repBadge.offsetWidth;
    els.repBadge.classList.add('pop');
    beep();
  }
}

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.1);
  } catch (_) {}
}

/* ---------------- Timer ---------------- */
function startTimer() {
  sessionStart = Date.now();
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    els.timer.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 500);
}
function stopTimer() { clearInterval(timerInterval); }

/* ---------------- Simulation mode (no camera needed) ---------------- */
els.simSlider.addEventListener('input', () => {
  if (running) return; // only in sim mode
  const v = parseFloat(els.simSlider.value);
  els.simValue.textContent = v + '°';
  handleResult(counter.update(v, v));
});

/* ---------------- Controls ---------------- */
els.startBtn.addEventListener('click', async () => {
  if (running) {
    running = false;
    cancelAnimationFrame(rafId);
    stopTimer();
    els.startBtn.textContent = 'Start';
    return;
  }
  try {
    if (!detector) {
      await setupCamera(useFrontCamera);
      await loadModel();
    }
    running = true;
    els.startBtn.textContent = 'Stop';
    startTimer();
    loop();
  } catch (err) {
    els.status.textContent = 'Error: ' + err.message + ' (check camera permission / use localhost)';
  }
});

els.resetBtn.addEventListener('click', () => {
  counter.reset();
  els.reps.textContent = '0';
  els.depthBar.style.width = '0%';
});

els.saveBtn.addEventListener('click', () => {
  const sessions = loadHistory();
  sessions.push({
    date: new Date().toISOString(),
    reps: counter.reps,
    seconds: sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0,
  });
  localStorage.setItem('squatSessions', JSON.stringify(sessions));
  renderHistory();
});

cameraToggleBtn.addEventListener('click', () => {
  useFrontCamera = !useFrontCamera;
  // If currently running, restart camera with new facing mode
  if (running) {
    // stop and start
    running = false;
    cancelAnimationFrame(rafId);
    stopTimer();
    els.startBtn.textContent = 'Start';
    // Note: actual restart will happen when user presses Start again.
    // For immediate restart, we could reinitialize, but keep simple.
    els.status.textContent = `Camera will switch to ${useFrontCamera ? 'front' : 'back'} on next start.`;
  } else {
    els.status.textContent = `Camera set to ${useFrontCamera ? 'front' : 'back'}`;
  }
});

/* ---------------- History ---------------- */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('squatSessions')) || []; }
  catch (_) { return []; }
}

function renderHistory() {
  const sessions = loadHistory();
  els.historyList.innerHTML = sessions.length
    ? sessions.map(s =>
        `<li>${new Date(s.date).toLocaleString()} — ${s.reps} reps, ${Math.floor(s.seconds/60)}m${s.seconds%60}s</li>`
      ).reverse().join('')
    : '<li>No sessions yet.</li>';
  drawChart(sessions);
}

function drawChart(sessions) {
  const ctx = els.chartCanvas.getContext('2d');
  const W = els.chartCanvas.width, H = els.chartCanvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!sessions.length) return;
  const max = Math.max(...sessions.map(s => s.reps), 1);
  const bw = W / sessions.length;
  ctx.fillStyle = '#22c55e';
  sessions.forEach((s, i) => {
    const h = (s.reps / max) * (H - 20);
    ctx.fillRect(i * bw + 4, H - h, bw - 8, h);
  });
}

renderHistory();