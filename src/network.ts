import { type DamageState } from '../shared/district';
import { DbConnection } from './module_bindings';
import type { Fighter, Input, GameEvent } from '../shared/simulation';
export type Arena = {
  id: string;
  phase: string;
  elapsed: number;
  radius: number;
  winner: string;
  round: number;
};
export class Network {
  damage: DamageState = {};
  conn?: DbConnection;
  id = '';
  players: Fighter[] = [];
  arena?: Arena;
  room = '';
  onEvent = (e: GameEvent) => {};
  onError = (message: string) => {};
  async login(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.conn?.disconnect();
        reject(
          new Error(
            'The multiplayer server is unavailable. Start SpacetimeDB or use offline practice.',
          ),
        );
      }, 8000);
      this.conn = DbConnection.builder()
        .withUri(import.meta.env.VITE_SPACETIME_URI ?? 'ws://127.0.0.1:3000')
        .withDatabaseName(import.meta.env.VITE_SPACETIME_DB ?? 'gun-wizards-local')
        .withToken(localStorage.getItem('gw.token') ?? undefined)
        .onConnect((c, id, token) => {
          this.id = id.toHexString();
          localStorage.setItem('gw.token', token);
          c.db.event.onInsert((_ctx, row) => {
            if (row.room === this.room) this.onEvent(JSON.parse(row.payload));
          });
          c.subscriptionBuilder()
            .onApplied(() => {
              clearTimeout(timer);
              resolve();
            })
            .onError((_ctx) => {
              clearTimeout(timer);
              reject(new Error('Could not subscribe to game state.'));
            })
            .subscribe([
              'SELECT * FROM player',
              'SELECT * FROM arena',
              'SELECT * FROM event',
              'SELECT * FROM district',
            ]);
        })
        .onConnectError((_ctx, e) => {
          clearTimeout(timer);
          reject(e);
        })
        .onDisconnect((_ctx, e) => {
          if (e) this.onError('Connection lost. Return to the roster and reconnect.');
        })
        .build();
    });
  }
  async join(name: string, hero: number, room: string) {
    if (!this.conn) throw new Error('Sign in first');
    this.room = room;
    await this.conn.reducers.join({ name, hero, room });
  }
  send(i: Input) {
    void this.conn?.reducers
      .control({ input: JSON.stringify(i) })
      .catch((e) => this.onError(String(e)));
  }
  sync() {
    if (!this.conn) return;
    this.players = Array.from(this.conn.db.player.iter())
      .filter((p) => p.room === this.room)
      .map((p) => JSON.parse(p.state));
    this.damage = Object.fromEntries(
      (this.conn.db.district.id.find(this.room)?.damage ?? []).map((d) => [d.id, d.amount]),
    );
    this.arena = Array.from(this.conn.db.arena.iter()).find((a) => a.id === this.room);
  }
  async leave() {
    await this.conn?.reducers.leave({});
    this.room = '';
    this.players = [];
    this.arena = undefined;
  }
  async start() {
    await this.conn?.reducers.startRound({});
  }
  logout() {
    this.conn?.disconnect();
    this.conn = undefined;
    localStorage.removeItem('gw.token');
  }
}
