import { blankInput, type Input } from '../shared/simulation';
export class Controls {
  keys = new Set<string>();
  pressed = new Set<string>();
  yaw = 0;
  pitch = 0;
  fire = false;
  firePressed = false;
  ads = false;
  enabled = false;
  fallback = false;
  onCaptureError = (message: string) => {};
  seq = 0;
  pad = false;
  settings = {
    sensitivity: 1,
    vertical: 1,
    ads: 0.6,
    deadzone: 0.15,
    vibration: 0.35,
    motion: 1,
    volume: 0.55,
    music: 0.3,
  };
  lastButtons: boolean[] = [];
  constructor(public canvas: HTMLCanvasElement) {
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem('gw.settings') ?? '{}'));
    } catch {}
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.matches('input,textarea,select')) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.enabled && ['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) this.clear();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || (document.pointerLockElement !== canvas && !(this.fallback && this.ads)))
        return;
      const s = 0.002 * this.settings.sensitivity * (this.ads ? this.settings.ads : 1);
      this.yaw -= e.movementX * s;
      this.pitch = Math.max(
        -1.4,
        Math.min(1.4, this.pitch - e.movementY * s * this.settings.vertical),
      );
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas && !this.fallback) {
        void this.capture();
        return;
      }
      if (e.button === 0) {
        this.fire = true;
        this.firePressed = true;
      }
      if (e.button === 2) this.ads = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  async capture() {
    try {
      await this.canvas.requestPointerLock();
    } catch {
      this.fallback = true;
      this.onCaptureError(
        'Mouse capture is unavailable here. Hold right mouse to look, or use arrow keys. Left click / Enter fires.',
      );
    }
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.fire = false;
    this.firePressed = false;
    this.ads = false;
  }
  take(code: string) {
    return this.pressed.delete(code);
  }
  sample(dt: number): Input {
    const i = blankInput();
    i.seq = ++this.seq;
    i.yaw = this.yaw;
    i.pitch = this.pitch;
    if (!this.enabled) return i;
    const k = this.keys;
    i.mx = Number(k.has('KeyD')) - Number(k.has('KeyA'));
    i.mz = Number(k.has('KeyW')) - Number(k.has('KeyS'));
    i.jump = this.take('Space');
    i.sprint = k.has('ShiftLeft');
    i.crouch = k.has('ControlLeft') || k.has('KeyC');
    i.dash = this.take('KeyQ');
    const keyboardFire = this.take('Enter');
    i.fire = this.fire || this.firePressed || k.has('Enter') || keyboardFire;
    this.firePressed = false;
    this.yaw += (Number(k.has('ArrowLeft')) - Number(k.has('ArrowRight'))) * dt * 1.8;
    this.pitch = Math.max(
      -1.4,
      Math.min(
        1.4,
        this.pitch + (Number(k.has('ArrowUp')) - Number(k.has('ArrowDown'))) * dt * 1.3,
      ),
    );
    i.reload = this.take('KeyR');
    i.melee = this.take('KeyE');
    i.guard = k.has('KeyF');
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
    this.pad = !!pad;
    if (pad) {
      const dz = (v: number) =>
        Math.abs(v) < this.settings.deadzone
          ? 0
          : (Math.sign(v) * (Math.abs(v) - this.settings.deadzone)) / (1 - this.settings.deadzone);
      const edge = (n: number) => pad.buttons[n]?.pressed && !this.lastButtons[n];
      i.mx = dz(pad.axes[0]);
      i.mz = -dz(pad.axes[1]);
      this.ads = pad.buttons[6]?.pressed;
      const sens = dt * 2.8 * this.settings.sensitivity * (this.ads ? this.settings.ads : 1);
      this.yaw -= dz(pad.axes[2]) * sens;
      this.pitch = Math.max(
        -1.4,
        Math.min(1.4, this.pitch - dz(pad.axes[3]) * sens * this.settings.vertical),
      );
      i.jump = !!edge(0);
      i.crouch = pad.buttons[1]?.pressed;
      i.reload = !!edge(2);
      i.sprint = pad.buttons[10]?.pressed;
      i.dash = !!edge(4);
      i.fire = pad.buttons[7]?.pressed;
      i.melee = !!edge(5);
      i.guard = pad.buttons[11]?.pressed;
      if (edge(3)) this.pressed.add('KeyV');
      this.lastButtons = pad.buttons.map((b) => b.pressed);
    }
    i.yaw = this.yaw;
    i.pitch = this.pitch;
    return i;
  }
  rumble() {
    const p = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
    if (p?.vibrationActuator)
      void p.vibrationActuator
        .playEffect('dual-rumble', {
          duration: 65,
          strongMagnitude: this.settings.vibration,
          weakMagnitude: this.settings.vibration * 0.5,
        })
        .catch(() => {});
  }
}
