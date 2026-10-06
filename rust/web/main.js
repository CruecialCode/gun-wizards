const $ = (id) => document.getElementById(id);
const canvas = $('world');
let game, phase = 'menu', weapon = 0, online = false, socket, playerId = 1;
let yaw = 0, pitch = 0, lastTime = performance.now(), lastSend = 0, paused = false, rightDrag = false;
let volume = Number(localStorage.getItem('veil.volume') ?? .45), sensitivity = Number(localStorage.getItem('veil.sensitivity') ?? 1);
let fpsFrames = 0, fpsTime = performance.now();
let snapshot = {}, previousHealth = 100, previousAmmo = 8, audio;
const held = new Set(), pressed = new Set();
const music = new Audio('./reference-assets/blackpowder.mp3');
music.loop = true; music.volume = volume * .32;
const names = ['WORN HANDGUN', 'WORN DOUBLE BARREL', 'WORN BONE WAND'];
$('volume').value = volume; $('sensitivity').value = sensitivity;
async function startTitleSkull() {
  const old = $('menu-skull');
  const skull = document.createElement('canvas'); skull.id = 'menu-skull'; skull.setAttribute('aria-hidden', 'true'); old.replaceWith(skull);
  try { const { startSkull } = await import('./reference-assets/menu-skull.js'); if (!$('menu').hidden) await startSkull(skull, $('menu')); } catch {}
}
function show(name) { for (const id of ['menu', 'hand', 'hud']) $(id).hidden = id !== name; if (name === 'menu') startTitleSkull(); }
function fail(message) { $('error-text').textContent = message; $('error').hidden = false; }
function sound(kind) {
  if (kind === 'enter') music.play().catch(() => {});
  if (!volume) return;
  audio ??= new AudioContext(); audio.resume();
  const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  oscillator.type = kind === 'shot' ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(kind === 'shot' ? 165 : 75, now);
  oscillator.frequency.exponentialRampToValueAtTime(35, now + .12);
  gain.gain.setValueAtTime(volume * (kind === 'shot' ? .13 : .07), now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .18);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(now + .2);
}
function capture() { try { const promise = canvas.requestPointerLock?.(); promise?.catch?.(() => {}); } catch {} }
function input() {
  let mx = Number(held.has('KeyD')) - Number(held.has('KeyA'));
  let mz = Number(held.has('KeyW')) - Number(held.has('KeyS'));
  const length = Math.hypot(mx, mz); if (length > 1) { mx /= length; mz /= length; }
  return { mx, mz, yaw, pitch, fire: held.has('Mouse0') || pressed.has('Mouse0') || held.has('Enter') || pressed.has('Enter'), melee: pressed.has('KeyF'), spell: pressed.has('KeyQ'), dodge: pressed.has('ShiftLeft') || pressed.has('ShiftRight'), jump: pressed.has('Space'), reload: pressed.has('KeyR') };
}
function updateHUD(state) {
  snapshot = state;
  const players = state.players || state.fighters || [];
  const me = players.find?.((p) => String(p.id) === String(playerId)) || state.player || players[0] || state;
  const hp = Math.max(0, Math.round(me.hp ?? me.health ?? 100));
  const ammo = me.ammo ?? 8;
  $('hp').textContent = hp; $('mana').value = me.mana ?? me.essence ?? 100; $('stamina').value = me.stamina ?? 100;
  $('ammo').replaceChildren(document.createTextNode(`${ammo} `), Object.assign(document.createElement('small'), { textContent: `/ ${[12, 6, 18][me.weapon ?? weapon]}` }));
  $('wave').textContent = `WAVE ${state.wave ?? 1}`;
  const living = Array.isArray(state.enemies) ? state.enemies.filter((e) => (e.hp ?? e.health ?? 1) > 0).length : state.remaining ?? 0;
  $('remaining').textContent = `${living} souls remain`;
  $('score').textContent = `${me.kills ?? state.kills ?? state.score ?? 0} SOULS`;
  $('gold').textContent = `${me.gold ?? state.gold ?? 0} GOLD`;
  $('reload-hint').textContent = (me.reload ?? me.reload_timer ?? ((me.cooldown ?? 0) > .8 ? me.cooldown : 0)) > 0 ? 'RELOADING…' : 'R · RELOAD';
  if (hp < previousHealth) { sound('hit'); document.body.classList.add('hit'); setTimeout(() => document.body.classList.remove('hit'), 150); }
  if (ammo < previousAmmo) { sound('shot'); document.body.classList.add('firing'); setTimeout(() => document.body.classList.remove('firing'), 80); }
  previousHealth = hp; previousAmmo = ammo;
  canvas.dataset.state = JSON.stringify({ phase: state.phase, wave: state.wave, hp, ammo, enemies: living, online, playerId, position: me.position ?? me.pos });
  if (state.render) canvas.dataset.render = JSON.stringify(state.render);
  const end = state.phase === 'shop' || state.phase === 'defeat' || state.phase === 'dead' || state.phase === 'game_over' || state.phase === 'victory';
  if (phase === 'play' && end && !$('round').open) {
    document.exitPointerLock?.();
    const dead = state.phase === 'defeat' || state.phase === 'dead' || state.phase === 'game_over';
    $('round-title').textContent = dead ? 'The Veil Claims You' : state.phase === 'victory' ? 'Dawn Breaks' : 'The Veil Relents';
    $('round-copy').textContent = dead ? 'Your hunt ends here. Take another hand and try again.' : 'A brief respite. Restore your strength before the next hunt.';
    $('next').hidden = dead; $('round').showModal();
  }
}
function resize() { const dpr = Math.min(devicePixelRatio, 1.5); const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); canvas.width = w; canvas.height = h; game?.resize(w, h); }
function frame(now) {
  fpsFrames++; if (now - fpsTime >= 1000) { canvas.dataset.fps = String(Math.round(fpsFrames * 1000 / (now - fpsTime))); fpsFrames = 0; fpsTime = now; }
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  if (game && !paused) {
    if (phase === 'play') { yaw -= (Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'))) * dt * 1.8; pitch = Math.max(-1.3, Math.min(1.3, pitch + (Number(held.has('ArrowUp')) - Number(held.has('ArrowDown'))) * dt * 1.4)); }
    const i = phase === 'play' && !$('round').open ? input() : { mx: 0, mz: 0, yaw, pitch, fire: false, melee: false, spell: false, dodge: false, jump: false, reload: false };
    try {
      const result = game.frame(dt, i.mx, i.mz, i.yaw, i.pitch, i.fire, i.melee, i.spell, i.dodge, i.jump, i.reload);
      if (!online && phase === 'play' && result) updateHUD(typeof result === 'string' ? JSON.parse(result) : result);
      if (online && socket?.readyState === WebSocket.OPEN && now - lastSend >= 50) { socket.send(JSON.stringify({ type: 'input', ...i })); lastSend = now; pressed.clear(); }
      if (!online) pressed.clear();
    } catch (error) { paused = true; fail(`The renderer stopped: ${error.message || error}`); }
  }
  requestAnimationFrame(frame);
}
$('enter').onclick = () => { phase = 'hand'; show('hand'); };
$('back').onclick = () => { phase = 'menu'; show('menu'); };
for (const card of document.querySelectorAll('.card')) card.onclick = () => {
  weapon = Number(card.dataset.weapon);
  for (const c of document.querySelectorAll('.card')) { const selected = c === card; c.classList.toggle('selected', selected); c.setAttribute('aria-pressed', selected); }
};
for (const mode of ['solo', 'coop']) $(mode).onclick = () => { online = mode === 'coop'; for (const id of ['solo', 'coop']) { $(id).classList.toggle('active', id === mode); $(id).setAttribute('aria-pressed', id === mode); } $('room-label').hidden = !online; };
function enterGame() { phase = 'play'; paused = false; held.clear(); pressed.clear(); yaw = pitch = 0; previousHealth = 100; previousAmmo = 999; game.set_mode(1); $('weapon-name').textContent = names[weapon]; show('hud'); capture(); }
$('begin').onclick = async () => {
  sound('enter'); $('connection').textContent = ''; $('begin').disabled = true;
  if (!online) { playerId = 1; game.set_player(1); game.set_online(false); game.start(weapon); enterGame(); $('begin').disabled = false; return; }
  try {
    const room = $('room').value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'blackpine';
    const ws = new URL('./ws', location.href); ws.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; ws.searchParams.set('room', room);
    socket = new WebSocket(ws); $('connection').textContent = 'Opening the shared hunt…';
    socket.onopen = () => { socket.send(JSON.stringify({ type: 'start', weapon })); };
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === 'welcome') { playerId = message.id; game.set_player(playerId); game.set_online(true); enterGame(); $('begin').disabled = false; }
      if (message.type === 'snapshot') { const state = message.snapshot ?? message; game.set_snapshot(JSON.stringify(state)); updateHUD(state); }
    };
    socket.onerror = () => { $('connection').textContent = 'Cannot reach the co-op server. Start the Rust server or choose Solo hunt.'; $('begin').disabled = false; };
    socket.onclose = () => { if (phase === 'play' && online) { pause(); $('settings-title').textContent = 'Connection lost'; } $('begin').disabled = false; };
  } catch (error) { $('connection').textContent = error.message; $('begin').disabled = false; }
};
function pause() { if ($('settings').open) return; paused = true; held.clear(); pressed.clear(); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', mx: 0, mz: 0, yaw, pitch, fire: false, melee: false, spell: false, dodge: false, jump: false, reload: false })); document.exitPointerLock?.(); $('settings-title').textContent = phase === 'play' ? 'Paused' : 'Options'; $('resume').textContent = phase === 'play' ? 'Resume the hunt' : 'Return'; $('leave').hidden = phase !== 'play'; $('settings').showModal(); }
function resume() { $('settings').close(); paused = false; lastTime = performance.now(); if (phase === 'play') capture(); }
function leave() { phase = 'menu'; socket?.close(); socket = null; paused = false; game.set_online(false); game.set_mode(0); music.pause(); $('settings').close(); $('round').close(); document.exitPointerLock?.(); held.clear(); pressed.clear(); show('menu'); }
$('options').onclick = pause; $('pause-button').onclick = pause; $('resume').onclick = resume; $('leave').onclick = leave; $('return-menu').onclick = leave;
$('settings').addEventListener('cancel', (e) => { e.preventDefault(); resume(); });
$('round').addEventListener('cancel', (e) => e.preventDefault());
$('next').onclick = () => { if (online) socket?.send(JSON.stringify({ type: 'next' })); else game.next_round(); $('round').close(); capture(); };
$('volume').oninput = () => { volume = Number($('volume').value); music.volume = volume * .32; localStorage.setItem('veil.volume', volume); };
$('sensitivity').oninput = () => { sensitivity = Number($('sensitivity').value); localStorage.setItem('veil.sensitivity', sensitivity); };
addEventListener('keydown', (event) => { if (event.target instanceof HTMLInputElement) return; if (event.code === 'Escape') { if (phase === 'play' && !$('settings').open && !$('round').open) pause(); return; } if (phase !== 'play' || paused || $('round').open) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.code)) event.preventDefault(); if (!held.has(event.code)) pressed.add(event.code); held.add(event.code); });
addEventListener('keyup', (event) => held.delete(event.code));
canvas.addEventListener('pointerdown', (event) => { if (phase !== 'play' || paused) return; if (event.button === 0) { held.add('Mouse0'); pressed.add('Mouse0'); capture(); } if (event.button === 2) rightDrag = true; });
addEventListener('pointerup', (event) => { if (event.button === 0) held.delete('Mouse0'); if (event.button === 2) rightDrag = false; });
addEventListener('pointermove', (event) => { if (phase !== 'play' || paused || !(document.pointerLockElement === canvas || rightDrag)) return; yaw -= event.movementX * .002 * sensitivity; pitch = Math.max(-1.3, Math.min(1.3, pitch - event.movementY * .002 * sensitivity)); });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
addEventListener('blur', () => { held.clear(); pressed.clear(); rightDrag = false; if (phase === 'play') pause(); });
addEventListener('resize', resize);
async function boot() {
  try {
    if (!navigator.gpu) throw new Error('This browser does not expose WebGPU. Open this page in a current Chrome, Edge, or Safari with WebGPU support.');
    const { default: init, create_game } = await import('./pkg/veil.js');
    await init(); resize(); game = await create_game('world'); resize(); game.set_mode(0);
    const worldResponse = await fetch('./reference-assets/world.json');
    if (worldResponse.ok) {
      $('loading').textContent = 'Restoring Blackpine…';
      const metadata = await worldResponse.json();
      const [vertices, atlas, atlasInfo, skeleton, skeletonInfo] = await Promise.all([
        fetch('./reference-assets/world.bin').then(r => r.arrayBuffer()),
        fetch('./reference-assets/atlas.rgba').then(r => r.arrayBuffer()),
        fetch('./reference-assets/atlas.json').then(r => r.json()),
        fetch('./reference-assets/skeleton.bin').then(r => r.arrayBuffer()),
        fetch('./reference-assets/skeleton.json').then(r => r.json()),
      ]);
      game.load_reference(new Uint8Array(vertices), new Uint8Array(atlas), atlasInfo.width, atlasInfo.height, JSON.stringify(metadata));
      game.load_skeleton(new Uint8Array(skeleton), JSON.stringify(skeletonInfo));
      const weapon = await fetch('./reference-assets/weapon.bin');
      if (weapon.ok) game.load_weapon(new Uint8Array(await weapon.arrayBuffer()));
    }
    $('loading').textContent = ''; $('enter').disabled = false; requestAnimationFrame(frame);
  } catch (error) { $('loading').textContent = 'Unable to start'; fail(error.message || String(error)); }
}
startTitleSkull();
boot();
