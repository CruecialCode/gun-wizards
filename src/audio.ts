import { JazzScore } from './music';
/** Small original synthesized palette; audio only starts following a user gesture. */
export class AudioEngine {
  music?: JazzScore;
  ctx?: AudioContext;
  master?: GainNode;
  volume = 0.55;
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.music = new JazzScore(this.ctx, this.master);
      this.music.start();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void this.ctx?.suspend();
        else void this.ctx?.resume();
      });
    }
    void this.ctx.resume();
  }
  play(kind: string, pan = 0) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const now = c.currentTime;
    const specs: Record<string, [number, number, number]> = {
      break: [95, 0.45, 0.4],
      chip: [1100, 0.05, 0.12],
      shot: [130, 0.15, 0.45],
      hit: [740, 0.08, 0.16],
      dash: [220, 0.18, 0.1],
      jump: [330, 0.1, 0.08],
      land: [75, 0.14, 0.15],
      reload: [420, 0.07, 0.09],
      step: [90, 0.05, 0.07],
      melee: [150, 0.19, 0.2],
      parry: [1200, 0.2, 0.19],
      empty: [1700, 0.03, 0.04],
      select: [550, 0.08, 0.06],
    };
    const [hz, dur, vol] = specs[kind] ?? specs.hit;
    const gain = c.createGain(),
      panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    gain.connect(panner);
    panner.connect(this.master);
    const osc = c.createOscillator();
    osc.type = kind === 'parry' ? 'sine' : kind === 'shot' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(hz, now);
    osc.frequency.exponentialRampToValueAtTime(hz * 0.3, now + dur);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + dur);
    if (['shot', 'dash', 'land', 'step', 'melee', 'break', 'chip'].includes(kind)) {
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate),
        data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const noise = c.createBufferSource();
      noise.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'shot' ? 4500 : 900;
      noise.connect(filter);
      filter.connect(gain);
      noise.start(now);
    }
  }
}
