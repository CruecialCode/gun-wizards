import { type DamageState } from '../shared/district';
import * as T from 'three';
import { createWorld, block, mat } from './world';
import { Character, loadWeapon } from './characters';
import { Controls } from './input';
import { AudioEngine } from './audio';
import { Network } from './network';
import {
  fighter,
  blankInput,
  step,
  resolveAttack,
  DT,
  type Fighter,
  type GameEvent,
  type Input,
} from '../shared/simulation';
import { roster } from './roster';
export class Game {
  menuLight = new T.PointLight(0xffdbc5, 28, 15, 2);
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(78, innerWidth / innerHeight, 0.04, 250);
  world;
  controls: Controls;
  audio = new AudioEngine();
  net = new Network();
  player = fighter('local', 'Traveler');
  mode: 'menu' | 'practice' | 'online' = 'menu';
  hero = 0;
  preview?: Character;
  previewGun?: T.Object3D;
  weapon = new T.Group();
  gun?: T.Object3D;
  leftHand?: T.Object3D;
  magazine?: T.Object3D;
  magY = 0;
  damage: DamageState = {};
  lastRound = 0;
  lastServerSeq = -1;
  enemies: Fighter[] = [];
  avatars = new Map<string, Character>();
  effects: { mesh: T.Object3D; life: number; max: number }[] = [];
  events: GameEvent[] = [];
  onUpdate = () => {};
  onError = (s: string) => {};
  acc = 0;
  netAcc = 0;
  pending = blankInput();
  time = 0;
  recoil = 0;
  ads = 0;
  inspect = 0;
  stepDistance = 0;
  fps = 60;
  frames: number[] = [];
  hitAt = -99;
  running = true;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.world = createWorld(this.scene);
    this.controls = new Controls(canvas);
    this.scene.add(this.camera);
    this.menuLight.position.set(2, 5, 5);
    this.scene.add(this.menuLight);
    this.camera.add(this.weapon);
    const weaponFill = new T.PointLight(0xffe3c4, 1.5, 2, 2);
    weaponFill.position.set(0.1, 0.2, 0.05);
    this.camera.add(weaponFill);
    this.weapon.visible = false;
    this.weapon.scale.setScalar(0.55);
    this.net.onEvent = (e) => this.feedback(e, true);
    this.net.onError = (e) => this.onError(e);
    window.addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
    void this.select(0);
    let previous = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  async select(hero: number) {
    this.hero = hero;
    this.preview && this.scene.remove(this.preview.group);
    this.preview = new Character(hero);
    this.preview.group.position.set(0, 0, 0);
    this.preview.group.scale.setScalar(2.5);
    this.scene.add(this.preview.group);
    if (this.previewGun) this.scene.remove(this.previewGun);
    try {
      const g = await loadWeapon(hero);
      if (this.hero !== hero) return;
      this.previewGun = g;
      g.scale.setScalar(2);
      g.position.set(2.8, 1.3, 0.5);
      g.rotation.set(0.1, -0.5, -0.25);
      this.scene.add(g);
    } catch (e) {
      console.error('Weapon load failed', e);
    }
  }
  async equip() {
    this.weapon.clear();
    const g = await loadWeapon(this.hero);
    g.scale.setScalar(1.3);
    g.rotation.y = Math.PI - 0.12;
    this.gun = g;
    this.weapon.add(g);
    this.magazine = g.getObjectByName('Magazine');
    this.magY = this.magazine?.position.y ?? 0;
    const sleeve = mat(roster[this.hero].coat),
      glove = mat(0x29232b),
      cuff = mat(0xd7c5a3);
    const rounded = (
      parent: T.Object3D,
      x: number,
      y: number,
      z: number,
      r: number,
      length: number,
      m: T.Material,
    ) => {
      const mesh = new T.Mesh(new T.CapsuleGeometry(r, length, 5, 10), m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = Math.PI / 2;
      parent.add(mesh);
      return mesh;
    };
    const arm = rounded(this.weapon, 0.055, -0.34, 0.52, 0.088, 0.47, sleeve);
    arm.rotation.x = 1.3;
    rounded(this.weapon, 0.025, -0.26, 0.245, 0.083, 0.1, cuff);
    const palm = rounded(this.weapon, 0.018, -0.205, 0.16, 0.067, 0.075, glove);
    palm.rotation.z = -0.18;
    for (let n = 0; n < 4; n++) {
      const finger = rounded(this.weapon, -0.047, -0.12 - n * 0.038, 0.145, 0.018, 0.07, glove);
      finger.rotation.y = 0.55;
    }
    rounded(this.weapon, 0.064, -0.14, 0.17, 0.024, 0.085, glove).rotation.z = 0.6;
    this.leftHand = new T.Group();
    this.leftHand.position.set(-0.15, -0.29, 0.4);
    this.weapon.add(this.leftHand);
    rounded(this.leftHand, 0, -0.02, 0.03, 0.08, 0.38, sleeve);
    rounded(this.leftHand, 0.045, 0.055, -0.17, 0.063, 0.07, glove);
  }

  async enter(mode: 'practice' | 'online', name: string, room: string) {
    this.audio.unlock();
    if (mode === 'online') {
      if (!this.net.conn) await this.net.login();
      await this.net.join(name, this.hero, room);
      this.net.sync();
    }
    this.player = fighter(mode === 'online' ? this.net.id : 'local', name, this.hero, 10, 20);
    this.controls.yaw = 0;
    this.controls.pitch = 0;
    this.controls.clear();
    this.menuLight.visible = false;
    this.damage = {};
    this.lastRound = 0;
    this.lastServerSeq = -1;
    this.world.syncDamage({}, false);
    this.mode = mode;
    this.controls.enabled = true;
    this.preview && (this.preview.group.visible = false);
    if (this.previewGun) this.previewGun.visible = false;
    await this.equip();
    this.weapon.visible = true;
    this.time = 0;
    this.enemies =
      mode === 'practice'
        ? [
            fighter('dummy', 'Practice construct', 2, 10, 5),
            fighter('dummy2', 'Sparring construct', 1, -8, -2),
          ]
        : [];
    this.acc = 0;
    this.netAcc = 0;
    this.pending = blankInput();
  }
  async exit() {
    this.menuLight.visible = true;
    this.mode = 'menu';
    this.controls.enabled = false;
    this.controls.clear();
    document.exitPointerLock();
    this.weapon.visible = false;
    await this.net.leave();
    for (const a of this.avatars.values()) this.scene.remove(a.group);
    this.avatars.clear();
    if (this.preview) this.preview.group.visible = true;
    if (this.previewGun) this.previewGun.visible = true;
  }
  reset() {
    this.damage = {};
    this.world.syncDamage({}, false);
    this.player = fighter('local', this.player.name, this.hero, 10, 20);
    this.controls.yaw = 0;
    this.controls.pitch = 0;
    this.enemies = [
      fighter('dummy', 'Practice construct', 2, 10, 5),
      fighter('dummy2', 'Sparring construct', 1, -8, -2),
    ];
    this.time = 0;
  }
  feedback(e: GameEvent, remote = false) {
    if (
      remote &&
      e.actor === this.player.id &&
      ['shot', 'dash', 'jump', 'land', 'reload', 'melee'].includes(e.type)
    )
      return;
    this.events.push(e);
    if (e.type === 'break' || e.type === 'chip') this.audio.play(e.type);
    if (this.events.length > 200) this.events.shift();
    if (e.actor === this.player.id || e.target === this.player.id) this.audio.play(e.type);
    if (e.type === 'shot') {
      if (e.actor === this.player.id) {
        this.recoil = 1;
        this.controls.rumble();
      }
      const actor =
        e.actor === this.player.id ? this.player : this.net.players.find((p) => p.id === e.actor);
      if (actor) {
        const from = new T.Vector3(actor.x, actor.y + 1.5, actor.z),
          to = from
            .clone()
            .add(
              new T.Vector3(
                -Math.sin(actor.yaw) * Math.cos(actor.pitch),
                Math.sin(actor.pitch),
                -Math.cos(actor.yaw) * Math.cos(actor.pitch),
              ).multiplyScalar(50),
            );
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints([from, to]),
          new T.LineBasicMaterial({ color: 0xffdf93, transparent: true, opacity: 0.7 }),
        );
        this.scene.add(line);
        this.effects.push({ mesh: line, life: 0.055, max: 0.055 });
      }
    }
    if (e.type === 'hit' || e.type === 'parry') {
      if (e.actor === this.player.id) this.hitAt = this.time;
      const burst = new T.Mesh(
        new T.IcosahedronGeometry(0.18, 0),
        new T.MeshBasicMaterial({
          color: e.type === 'parry' ? 0x92dedb : 0xffdda0,
          wireframe: true,
        }),
      );
      burst.position.set(e.x, e.y, e.z);
      this.scene.add(burst);
      this.effects.push({ mesh: burst, life: 0.2, max: 0.2 });
    }
  }
  update(dt: number) {
    this.time += dt;
    this.frames.push(dt * 1000);
    if (this.frames.length > 240) this.frames.shift();
    this.fps = 1 / (this.frames.reduce((a, b) => a + b, 0) / this.frames.length / 1000);
    this.world.update(this.time, dt);
    this.audio.music?.setCombat(this.mode !== 'menu' && this.time - this.hitAt < 5);
    this.audio.music?.setVolume(this.controls.settings.music);
    if (this.mode === 'practice' && !this.controls.enabled) {
      this.onUpdate();
      return;
    }
    if (this.mode === 'menu') {
      this.camera.position.set(5.8, 3.3, 8);
      this.camera.lookAt(0.7, 2.5, 0);
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
      this.preview?.update(dt);
      if (this.preview) this.preview.group.rotation.y = 0.2 + Math.sin(this.time * 0.3) * 0.12;
      if (this.previewGun) this.previewGun.rotation.y += dt * 0.25;
      this.onUpdate();
      return;
    }
    const i = this.controls.sample(dt);
    if (this.controls.take('KeyV')) this.inspect = 1.5;
    if (this.controls.take('KeyT') && this.mode === 'practice') this.reset();
    this.pending = {
      ...i,
      fire: this.pending.fire || i.fire,
      jump: this.pending.jump || i.jump,
      dash: this.pending.dash || i.dash,
      reload: this.pending.reload || i.reload,
      melee: this.pending.melee || i.melee,
    };
    this.acc += dt;
    let first = true;
    while (this.acc >= DT) {
      const input = {
        ...i,
        fire: first ? this.pending.fire : i.fire,
        jump: first ? this.pending.jump : false,
        dash: first ? this.pending.dash : false,
        reload: first ? this.pending.reload : false,
        melee: first ? this.pending.melee : false,
      };
      const ev = step(this.player, input, DT, this.damage);
      for (const e of ev) {
        this.feedback(e);
        if (this.mode === 'practice' && (e.type === 'shot' || e.type === 'melee')) {
          for (const hit of resolveAttack(
            this.player,
            this.enemies,
            e.type,
            this.time,
            this.damage,
          ))
            this.feedback(hit);
        }
      }
      if (this.mode === 'practice')
        for (const q of this.enemies) {
          if (!q.alive) {
            q.hp = 100;
            q.alive = true;
          }
          q.y = Math.max(0, q.y + q.vy * DT);
          q.vy -= 25 * DT;
          q.x += q.vx * DT;
          q.z += q.vz * DT;
          q.vx *= 0.88;
          q.vz *= 0.88;
        }
      this.acc -= DT;
      first = false;
    }
    if (this.mode === 'online') {
      this.netAcc += dt;
      if (this.netAcc >= DT) {
        this.net.send(this.pending);
        this.netAcc %= DT;
        this.pending = blankInput();
      }
      this.net.sync();
      this.damage = this.net.damage;
      const authoritative = this.net.players.find((p) => p.id === this.net.id);
      if (authoritative) {
        if (this.net.arena?.round !== this.lastRound) {
          this.lastRound = this.net.arena?.round ?? 0;
          this.player = { ...authoritative };
          this.controls.yaw = authoritative.yaw;
          this.controls.pitch = authoritative.pitch;
        }
        const err = Math.hypot(authoritative.x - this.player.x, authoritative.z - this.player.z);
        if (err > 3) {
          this.player.x = authoritative.x;
          this.player.z = authoritative.z;
          this.player.y = authoritative.y;
        }
        this.player.hp = authoritative.hp;
        this.player.alive = authoritative.alive;
        this.player.hits = authoritative.hits;
        this.player.combo = authoritative.combo;
        // Server resource correction only on a newly acknowledged input, never every render frame.
        if (authoritative.seq !== this.lastServerSeq) {
          this.lastServerSeq = authoritative.seq;
          this.player.ammo = authoritative.ammo;
          this.player.reload = authoritative.reload;
        }
      }
    } else if (!first) this.pending = blankInput();
    this.world.syncDamage(this.damage);
    const targets =
      this.mode === 'online'
        ? this.net.players.filter((p) => p.id !== this.player.id)
        : this.enemies;
    for (const q of targets) {
      let avatar = this.avatars.get(q.id);
      if (!avatar) {
        avatar = new Character(q.hero);
        this.avatars.set(q.id, avatar);
        this.scene.add(avatar.group);
      }
      avatar.group.visible = q.alive;
      avatar.group.position.lerp(new T.Vector3(q.x, q.y, q.z), 1 - Math.exp(-18 * dt));
      avatar.group.rotation.y = q.yaw;
      avatar.update(dt, Math.hypot(q.vx, q.vz));
    }
    for (const [id, a] of this.avatars)
      if (!targets.some((p) => p.id === id)) {
        this.scene.remove(a.group);
        this.avatars.delete(id);
      }
    const p = this.player;
    const crouch = i.crouch || p.slideTime > 0;
    const targetY = p.y + (crouch ? 1.04 : 1.62);
    this.camera.position.set(
      p.x,
      T.MathUtils.lerp(this.camera.position.y, targetY, 1 - Math.exp(-25 * dt)),
      p.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.controls.pitch, this.controls.yaw, 0);
    const motion = this.controls.settings.motion;
    this.ads = T.MathUtils.damp(this.ads, this.controls.ads ? 1 : 0, 18, dt);
    this.camera.fov = T.MathUtils.damp(
      this.camera.fov,
      78 - this.ads * 13 + (i.sprint ? 4 : 0) * motion,
      9,
      dt,
    );
    this.camera.updateProjectionMatrix();
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.inspect = Math.max(0, this.inspect - dt);
    const speed = Math.hypot(p.vx, p.vz),
      bob = Math.sin(this.time * speed * 1.2) * 0.009 * motion * (1 - this.ads);
    this.weapon.position.set(
      0.23 * (1 - this.ads),
      -0.23 - this.ads * 0.015 + bob,
      -0.78 + this.recoil * 0.035,
    );
    this.weapon.rotation.set(
      this.recoil * 0.17 + (p.reload > 0 ? Math.sin((p.reload / 1.15) * Math.PI) * 0.5 : 0),
      this.inspect > 0 ? Math.sin((this.inspect / 1.5) * Math.PI) * 0.75 : 0,
      (i.sprint ? -0.16 : 0) + (p.reload > 0 ? -0.5 : 0),
    );
    if (this.magazine)
      this.magazine.position.y =
        this.magY - (p.reload > 0 ? Math.sin((p.reload / 1.15) * Math.PI) * 0.25 : 0);
    if (this.leftHand)
      this.leftHand.position.y =
        -0.29 - (p.reload > 0 ? Math.sin((p.reload / 1.15) * Math.PI) * 0.22 : 0);
    this.weapon.visible = p.alive;
    this.stepDistance += speed * dt;
    if (this.stepDistance > 2.6 && p.grounded) {
      this.stepDistance = 0;
      this.audio.play('step');
    }
    const a = this.net.arena;
    this.world.ring.visible = this.mode === 'online' && a?.phase === 'playing';
    if (a) this.world.ring.scale.set(a.radius, 1, a.radius);
    for (let n = this.effects.length - 1; n >= 0; n--) {
      const e = this.effects[n];
      e.life -= dt;
      if (e.mesh instanceof T.Mesh) e.mesh.scale.setScalar(1 + (1 - e.life / e.max) * 3);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        if (e.mesh instanceof T.Mesh || e.mesh instanceof T.Line) {
          e.mesh.geometry.dispose();
          (e.mesh.material as T.Material).dispose();
        }
        this.effects.splice(n, 1);
      }
    }
    this.onUpdate();
  }
}
