import { zoneAt } from '../shared/district';
import './style.css';
import { Game } from './game';
import { roster } from './roster';
const ui = document.querySelector<HTMLElement>('#ui')!;
const game = new Game(document.querySelector<HTMLCanvasElement>('#game')!);
let name = localStorage.getItem('gw.name') ?? '',
  online = false,
  mode: 'practice' | 'online' = 'practice',
  room = 'last-call',
  screen = 'login',
  paused = false;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function toast(message: string) {
  document.querySelector('.toast')?.remove();
  const e = document.createElement('div');
  e.className = 'toast';
  e.textContent = message;
  ui.append(e);
  setTimeout(() => e.remove(), 5000);
}
game.onError = toast;
game.controls.onCaptureError = toast;
function login() {
  screen = 'login';
  ui.innerHTML = `<section class="screen login" style="background-image:linear-gradient(90deg,rgba(16,17,27,.94) 0%,rgba(16,17,27,.45) 30%,transparent 65%),none"><div class="login-inner"><div class="eyebrow">A little magic. A lot of nerve.</div><h1 class="wordmark">GUN<br>WIZARDS<small>LAST CALL / FIRST PLAYABLE</small></h1><p class="lede">Good guns. Bad company.<br>Welcome to the edge of the world.</p><form id="login-form"><label for="callsign">YOUR CALLSIGN</label><input id="callsign" maxlength="20" required autocomplete="nickname" placeholder="What do they call you?" value="${esc(name)}"><button class="primary" type="submit">SIGN IN & ENTER <span>↗</span></button></form><button class="quiet" id="offline">Offline practice</button><p class="fineprint">A guest identity is saved on this browser.<br>No email. No password. Just a callsign.</p><p class="error" id="login-error" role="status"></p></div><div class="edition">EST. SOMEWHERE AFTER THE END OF THE WORLD</div><div class="art-credit">GUN WIZARDS / VOL. 001</div></section>`;
  document.querySelector('#login-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    name = (document.querySelector('#callsign') as HTMLInputElement).value.trim();
    if (!name) return;
    localStorage.setItem('gw.name', name);
    const btn = document.querySelector<HTMLButtonElement>('.primary')!;
    btn.disabled = true;
    btn.textContent = 'CONNECTING…';
    try {
      await game.net.login();
      online = true;
      rosterScreen();
    } catch (e) {
      document.querySelector('#login-error')!.textContent =
        e instanceof Error ? e.message : String(e);
      btn.disabled = false;
      btn.textContent = 'TRY SIGN IN AGAIN';
    }
  });
  document.querySelector('#offline')!.addEventListener('click', () => {
    game.audio.unlock();
    name = (document.querySelector('#callsign') as HTMLInputElement).value.trim() || 'Traveler';
    online = false;
    rosterScreen();
  });
}
function rosterScreen() {
  screen = 'roster';
  const h = roster[game.hero];
  ui.innerHTML = `<section class="screen roster"><header class="topbar"><div class="brand-small">GUN WIZARDS <span style="font-size:12px;color:#d6b47a;margin-left:18px;letter-spacing:.15em">LAST CALL</span></div><div class="top-actions"><span><i class="dot"></i>${online ? 'CONNECTED' : 'OFFLINE PRACTICE'}</span><button class="quiet" id="settings">SETTINGS</button><button class="quiet" id="logout">SIGN OUT</button></div></header><div class="hero-copy"><div class="eyebrow">0${game.hero + 1} / ${h.title}</div><h1>${h.name}</h1><p>${h.story}</p><blockquote>${h.quote}</blockquote><div class="weapon-label"><div class="eyebrow">SIGNATURE SIDEARM</div><strong>${h.gun}</strong><span>${h.gunDetail}</span></div></div><div class="roster-note">THE LAST CALL CREW / CHOOSE YOUR TROUBLE</div><div class="roster-bottom"><div><div class="eyebrow" style="margin-bottom:13px">PICK YOUR WIZARD</div><div class="cards">${roster.map((r, n) => `<button class="hero-card" data-hero="${n}" aria-pressed="${game.hero === n}" style="--hero:${r.color}"><small>0${n + 1} / WIZARD</small><strong>${r.name}</strong></button>`).join('')}</div></div><div class="play-panel"><div class="mode-tabs"><button data-mode="practice" aria-pressed="${mode === 'practice'}">EXPLORE LAST CALL</button><button data-mode="online" aria-pressed="${mode === 'online'}">BATTLE ROYALE</button></div>${mode === 'online' ? `<label class="eyebrow" for="room">ROOM CODE</label><input class="room" id="room" maxlength="24" value="${esc(room)}" aria-label="Room code">` : `<div style="font-size:12px;color:#c3c7b7">Explore the district. Break cover. Find your rhythm.</div>`}<button class="primary" id="play">${mode === 'online' ? 'JOIN THE SHOWDOWN' : 'TAKE THE STAGE'} ↗</button></div></div></section>`;
  ui.querySelectorAll<HTMLButtonElement>('[data-hero]').forEach(
    (b) =>
      (b.onclick = () => {
        game.audio.unlock();
        game.audio.play('select');
        void game.select(Number(b.dataset.hero));
        rosterScreen();
      }),
  );
  ui.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode as typeof mode;
        rosterScreen();
      }),
  );
  document.querySelector('#settings')!.addEventListener('click', settings);
  document.querySelector('#logout')!.addEventListener('click', () => {
    game.net.logout();
    online = false;
    login();
  });
  document.querySelector('#play')!.addEventListener('click', async () => {
    room = (document.querySelector('#room') as HTMLInputElement)?.value.trim() || room;
    const b = document.querySelector<HTMLButtonElement>('#play')!;
    b.disabled = true;
    b.textContent = 'GETTING READY…';
    try {
      await game.enter(mode, name, room);
      screen = 'game';
      hud();
    } catch (e) {
      toast(String(e));
      b.disabled = false;
      b.textContent = 'TRY AGAIN';
    }
  });
}
function hud() {
  ui.innerHTML = `<section class="hud"><div class="hud-top"><div>${mode === 'practice' ? 'EXPLORE LAST CALL' : 'LAST CALL / ' + esc(room)}<strong id="match-status">Find your rhythm.</strong></div><div id="stats"></div></div><button class="menu-trigger" id="menu">ESC / SETTINGS</button><div class="crosshair" id="crosshair"></div><div class="hud-bottom"><div><div class="player-name">${esc(name)} / ${roster[game.hero].name}</div><div class="hp"><i id="health"></i></div><div class="hud-label" id="dash">QUICKSTEP READY</div></div><div><div class="ammo" id="ammo">08 <small>/ 08</small></div><div class="hud-label">${roster[game.hero].gun} / PRACTICE ROUNDS</div></div></div><div class="hints">WASD MOVE · SHIFT SPRINT · SPACE JUMP · C SLIDE · Q DODGE · E STRIKE · F GUARD · R RELOAD · V INSPECT</div></section><div class="notice" id="notice"></div>`;
  document.querySelector('#menu')!.addEventListener('click', settings);
  updateHud();
}
function updateHud() {
  if (screen !== 'game') return;
  const p = game.player,
    a = game.net.arena;
  const canvas = game.controls.canvas;
  canvas.dataset.position = JSON.stringify({ x: p.x, y: p.y, z: p.z, yaw: p.yaw });
  canvas.dataset.render = JSON.stringify({
    calls: game.renderer.info.render.calls,
    triangles: game.renderer.info.render.triangles,
    geometries: game.renderer.info.memory.geometries,
    textures: game.renderer.info.memory.textures,
    fps: Math.round(game.fps),
  });
  canvas.dataset.damage = JSON.stringify(game.damage);
  document.querySelector('#health')?.setAttribute('style', `width:${p.hp}%`);
  const ammo = document.querySelector('#ammo');
  if (ammo)
    ammo.innerHTML = `${p.reload > 0 ? '↻' : String(p.ammo).padStart(2, '0')} <small>/ 08</small>`;
  const dash = document.querySelector('#dash');
  if (dash)
    dash.textContent = p.dashCd > 0 ? `QUICKSTEP / ${p.dashCd.toFixed(1)}s` : 'QUICKSTEP READY';
  document.querySelector('#crosshair')?.classList.toggle('hit', game.time - game.hitAt < 0.13);
  const stats = document.querySelector('#stats');
  if (stats)
    stats.textContent = `${Math.round(game.fps)} FPS / ${game.renderer.info.render.calls} DRAWS / ${p.hits} HITS${p.combo > 1 ? ' / ' + p.combo + ' CHAIN' : ''}`;
  const status = document.querySelector('#match-status');
  if (status)
    status.textContent =
      mode === 'practice'
        ? zoneAt(p.x, p.y, p.z)
        : a?.phase === 'playing'
          ? `${game.net.players.filter((p) => p.alive).length} LEFT / RING ${Math.round(a.radius)}m`
          : a?.phase === 'finished'
            ? `${a.winner} takes the last round.`
            : `${game.net.players.length}/8 WIZARDS IN THE ROOM`;
  const notice = document.querySelector<HTMLElement>('#notice');
  if (!notice || paused) return;
  let content = '';
  if (mode === 'online' && a?.phase === 'finished')
    content = `<h2>${esc(a.winner)} WINS</h2><p>The tab is settled. For now.</p><button class="primary" data-action="start">PLAY ANOTHER ROUND</button>`;
  else if (mode === 'online' && !p.alive)
    content = '<h2>DOWN, NOT FORGOTTEN.</h2><p>Watch the remaining wizards settle this.</p>';
  else if (mode === 'online' && a?.phase === 'waiting')
    content = `<h2>THE LAST CALL / ${esc(room)}</h2><p>Share this room code. Two to eight wizards. Last one standing wins.</p>${game.net.players.length > 1 ? '<button class="primary" data-action="start">START SHOWDOWN</button>' : '<p>Waiting for another wizard…</p>'}`;
  else if (
    document.pointerLockElement !== game.controls.canvas &&
    !game.controls.pad &&
    !game.controls.fallback
  )
    content =
      '<h2>YOUR MOVE, WIZARD.</h2><p>Click to capture your mouse. Esc releases it.<br>Controller: move / aim sticks · RT fire · LT aim · LB dodge · RB strike</p><button class="primary" data-action="capture">LET’S DANCE</button>';
  if (notice.dataset.content !== content) {
    notice.dataset.content = content;
    notice.innerHTML = content;
    notice.style.display = content ? 'block' : 'none';
    notice.querySelector('[data-action="capture"]')?.addEventListener('click', () => {
      game.audio.unlock();
      void game.controls.capture();
    });
    notice
      .querySelector('[data-action="start"]')
      ?.addEventListener('click', () => void game.net.start().catch((e) => toast(String(e))));
  }
}
game.onUpdate = updateHud;
function settings() {
  if (paused) return;
  paused = true;
  game.controls.enabled = false;
  game.controls.clear();
  document.exitPointerLock();
  const overlay = document.createElement('section');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="Game settings"><h2>MAKE IT FEEL RIGHT.</h2>${Object.entries(
    {
      sensitivity: 'Look sensitivity',
      vertical: 'Vertical sensitivity',
      ads: 'ADS sensitivity',
      deadzone: 'Stick deadzone',
      vibration: 'Controller vibration',
      motion: 'Camera motion',
      volume: 'Master volume',
      music: 'Music volume',
    },
  )
    .map(
      ([key, label]) =>
        `<label class="setting">${label}<input type="range" data-setting="${key}" min="${['sensitivity', 'vertical', 'ads'].includes(key) ? '.2' : '0'}" max="${['sensitivity', 'vertical'].includes(key) ? '2' : '1'}" step=".05" value="${game.controls.settings[key as keyof typeof game.controls.settings]}"></label>`,
    )
    .join(
      '',
    )}<p class="fineprint">WASD · mouse / standard Xbox & Switch Pro mapping.<br>R reload · V inspect · T reset practice · F guard.<br>Practice pauses here; online matches keep running.</p><div class="actions"><button class="primary" id="resume">BACK</button>${screen === 'game' ? '<button class="quiet" id="exit">LEAVE MATCH</button>' : ''}</div></div>`;
  ui.append(overlay);
  overlay.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(
    (el) =>
      (el.oninput = () => {
        game.controls.settings[el.dataset.setting as keyof typeof game.controls.settings] = Number(
          el.value,
        );
        localStorage.setItem('gw.settings', JSON.stringify(game.controls.settings));
        if (game.audio.master) game.audio.master.gain.value = game.controls.settings.volume;
        game.audio.music?.setVolume(game.controls.settings.music);
      }),
  );
  overlay.querySelector('#resume')!.addEventListener('click', () => {
    overlay.remove();
    paused = false;
    game.controls.enabled = screen === 'game';
  });
  overlay.querySelector('#exit')?.addEventListener('click', async () => {
    await game.exit();
    paused = false;
    rosterScreen();
  });
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && screen === 'game' && !paused) settings();
});
if (matchMedia('(prefers-reduced-motion: reduce)').matches) game.controls.settings.motion = 0;
login();
