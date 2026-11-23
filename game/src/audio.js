// WebAudio synth effects only — no audio files, no network.
// One job only: make the game's sounds.
let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
}

function audioContext() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short oscillator blip with an exponential decay envelope. */
function blip(freq, dur, type, gain, when = 0, slideTo = null) {
  const ac = audioContext();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const t = ac.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    // Sound is garnish: a failed blip never breaks the game.
  }
}

/** A filtered noise burst (thuds, snaps, shimmer). */
function noiseBurst(dur, gain, filterFreq) {
  const ac = audioContext();
  if (!ac) return;
  try {
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = ac.createGain();
    amp.gain.value = gain;
    src.connect(filter);
    filter.connect(amp);
    amp.connect(ac.destination);
    src.start();
  } catch {
    // See blip: sound never breaks the game.
  }
}

export function playCardSnap() {
  noiseBurst(0.08, 0.5, 3200);
  blip(520, 0.07, 'triangle', 0.18, 0, 340);
}

export function playCoinChime() {
  blip(1320, 0.12, 'sine', 0.22);
  blip(1760, 0.18, 'sine', 0.2, 0.07);
}

export function playBlockShimmer() {
  blip(440, 0.16, 'sine', 0.16, 0, 660);
  blip(660, 0.2, 'sine', 0.12, 0.06, 880);
}

export function playDamageThud() {
  noiseBurst(0.16, 0.6, 500);
  blip(110, 0.18, 'sawtooth', 0.25, 0, 55);
}

export function playAlarmSting() {
  blip(880, 0.12, 'square', 0.14);
  blip(660, 0.12, 'square', 0.14, 0.13);
  blip(880, 0.18, 'square', 0.14, 0.26);
}

export function playSurgeFanfare() {
  blip(523, 0.1, 'triangle', 0.2);
  blip(659, 0.1, 'triangle', 0.2, 0.08);
  blip(784, 0.22, 'triangle', 0.22, 0.16);
}

export function playWinFanfare() {
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  notes.forEach((freq, i) => blip(freq, 0.22, 'triangle', 0.22, i * 0.11));
  blip(2093, 0.5, 'sine', 0.12, 0.8);
}

export function playLoseSting() {
  blip(392, 0.25, 'sawtooth', 0.16, 0, 311);
  blip(311, 0.3, 'sawtooth', 0.16, 0.24, 233);
  blip(233, 0.55, 'sawtooth', 0.16, 0.5, 175);
}

export function playDrawWhoosh() {
  noiseBurst(0.12, 0.25, 1800);
}
