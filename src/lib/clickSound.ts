/**
 * Lightweight click sound using Web Audio API.
 * No external files needed — generates a subtle 'tick' programmatically.
 */
let audioCtx: AudioContext | null = null;

export function playClickSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 1800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.06);
  } catch {
    // silent fail — audio not critical
  }
}
