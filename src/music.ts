/** Original Last Call score: a sixteen-bar minor-jazz form, synthesized locally.
 * No external samples or melodies. A look-ahead clock schedules on the audio timeline.
 */
export class JazzScore {
  gain: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private next = 0;
  private beat = 0;
  private combat = false;
  private noise: AudioBuffer;
  constructor(
    private ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.2;
    this.gain.connect(destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const a = this.noise.getChannelData(0);
    let seed = 771;
    for (let i = 0; i < a.length; i++) {
      seed = (seed * 16807) % 2147483647;
      a[i] = (seed / 2147483647) * 2 - 1;
    }
  }
  start() {
    if (this.timer) return;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 35);
  }
  setCombat(value: boolean) {
    this.combat = value;
  }
  setVolume(value: number) {
    this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.12);
  }
  private note(
    midi: number,
    time: number,
    duration: number,
    volume: number,
    voice: 'bass' | 'keys' | 'brass',
  ) {
    const c = this.ctx,
      g = c.createGain(),
      filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice === 'bass' ? 800 : voice === 'brass' ? 1800 : 2800, time);
    filter.frequency.exponentialRampToValueAtTime(voice === 'bass' ? 180 : 650, time + duration);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    filter.connect(g);
    g.connect(this.gain);
    const hz = 440 * 2 ** ((midi - 69) / 12);
    for (const [multiple, amplitude] of voice === 'keys'
      ? [
          [1, 1],
          [2, 0.3],
          [3, 0.12],
          [7, 0.025],
        ]
      : voice === 'bass'
        ? [
            [1, 1],
            [2, 0.25],
          ]
        : [
            [1, 1],
            [2, 0.3],
            [3, 0.13],
          ]) {
      const o = c.createOscillator(),
        v = c.createGain();
      o.type = voice === 'brass' ? 'triangle' : 'sine';
      o.frequency.value = hz * multiple;
      v.gain.value = amplitude;
      o.connect(v);
      v.connect(filter);
      o.start(time);
      o.stop(time + duration + 0.02);
      o.onended = () => {
        o.disconnect();
        v.disconnect();
      };
    }
    setTimeout(
      () => {
        g.disconnect();
        filter.disconnect();
      },
      Math.max(0, (time + duration - c.currentTime) * 1000) + 100,
    );
  }
  private brush(time: number, accent = false) {
    const s = this.ctx.createBufferSource(),
      f = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain();
    s.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = accent ? 1400 : 6500;
    g.gain.setValueAtTime(accent ? 0.11 : 0.045, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.14 : 0.05));
    s.connect(f);
    f.connect(g);
    g.connect(this.gain);
    s.start(time);
    s.stop(time + 0.18);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  private schedule() {
    const c = this.ctx;
    if (c.state !== 'running') return;
    if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.05;
    const roots = [38, 38, 43, 43, 36, 36, 45, 45, 38, 41, 43, 44, 38, 45, 38, 45];
    const chords = [
      [53, 57, 60, 64],
      [53, 57, 60, 64],
      [53, 59, 62, 65],
      [53, 59, 62, 65],
      [52, 55, 59, 62],
      [52, 55, 59, 62],
      [55, 61, 64, 67],
      [55, 61, 64, 67],
    ];
    const melody = [69, 72, 74, 0, 76, 74, 72, 69, 67, 69, 65, 0, 64, 67, 69, 0];
    while (this.next < c.currentTime + 0.18) {
      const eighth = this.beat % 8,
        bar = Math.floor(this.beat / 8) % 16,
        quarter = 60 / (this.combat ? 138 : 96),
        swing = eighth % 2 === 0 ? 1.3 : 0.7;
      const t = this.next;
      if (eighth % 2 === 0) {
        const walking = [0, 7, 10, 9][eighth / 2];
        this.note(roots[bar] + walking, t, quarter * 0.8, 0.2, 'bass');
      }
      this.brush(t, eighth === 2 || eighth === 6);
      if (eighth === 1 || eighth === 6)
        for (const n of chords[bar % 8]) this.note(n, t, quarter * 0.72, 0.035, 'keys');
      if (bar % 4 < 2 && eighth % 2 === 0) {
        const n = melody[(bar % 4) * 4 + eighth / 2];
        if (n) this.note(n, t, quarter * 0.67, 0.075, 'brass');
      }
      this.next += quarter * 0.5 * swing;
      this.beat++;
    }
  }
}
