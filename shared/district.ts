/** Last Call's collision and destructible layout. Render and server share these volumes. */
export interface Solid {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y: number;
  hp?: number;
  material?: 'wood' | 'ceramic' | 'glass';
}
export type DamageState = Record<string, number>;
const box = (id: string, x: number, z: number, w: number, d: number, h: number, y = 0): Solid => ({
  id,
  x,
  z,
  w,
  d,
  h,
  y,
});
export const STREET_COVER: Solid[] = [
  { ...box('crate-a', -9, -6, 5, 2, 1.2), hp: 54, material: 'wood' },
  { ...box('crate-b', 9, 6, 5, 2, 1.2), hp: 54, material: 'wood' },
  { ...box('screen-a', 0, -12, 7, 0.35, 2.4), hp: 72, material: 'ceramic' },
  { ...box('screen-b', 0, 12, 7, 0.35, 2.4), hp: 72, material: 'ceramic' },
  box('kiosk-a', -17, 7, 4, 5, 3),
  box('kiosk-b', 17, -7, 4, 5, 3),
  { ...box('pot-a', -6, 5, 2, 2, 0.65), hp: 18, material: 'ceramic' },
  { ...box('pot-b', 6, -5, 2, 2, 0.65), hp: 18, material: 'ceramic' },
];
export const DISTRICT: Solid[] = [...STREET_COVER];
// Arcaded buildings. Ground-floor portals and rear passages are actual empty space.
for (const side of [-1, 1]) {
  const x = side * 25;
  DISTRICT.push(box(`back-${side}`, side * 32, 0, 0.5, 62, 14));
  DISTRICT.push(box(`roof-${side}`, x, 0, 14, 62, 0.4, 5.6));
  for (const z of [-31, 31]) DISTRICT.push(box(`end-${side}-${z}`, x, z, 14, 0.5, 5.6));
  for (let n = 0; n < 6; n++) {
    const z = -25 + n * 10;
    DISTRICT.push(box(`upper-${side}-${n}`, side * 27.5, z, 9, 9.8, 7 + (n % 3) * 2, 6));
    DISTRICT.push(box(`furniture-counter-${side}-${n}`, side * 30.8, z, 1.5, 5.2, 2.55));
    for (const offset of [-2, 2])
      DISTRICT.push(
        box(`furniture-table-${side}-${n}-${offset}`, side * 24, z + offset, 2.1, 2.1, 1.31),
      );
    DISTRICT.push(box(`pier-${side}-${n}`, side * 18, z, 1.1, 1.1, 5.6));
  }
  // Shop front walls alternate with four-meter-wide entrances.
  for (let n = 0; n < 5; n++)
    DISTRICT.push(box(`front-${side}-${n}`, side * 18, -20 + n * 10, 0.45, 6, 4.7));
  // Two rooms per arcade separated by a breachable timber partition.
  DISTRICT.push({ ...box(`partition-${side}`, x, 0, 13, 0.24, 3.5), hp: 54, material: 'wood' });
  // Stairs at the south end of the street lead to the roof. 20 x .3m risers.
  for (let n = 0; n < 20; n++)
    DISTRICT.push(box(`stair-${side}-${n}`, side * 15, 28 - n * 0.65, 3, 0.65, (n + 1) * 0.3));
  // Bridge from stair landing to roof.
  DISTRICT.push(box(`landing-${side}`, side * 17, 15, 3.5, 3, 0.4, 5.6));
}
export const BREAKABLES = DISTRICT.filter((b) => b.hp !== undefined);
export function activeSolids(damage: DamageState = {}): Solid[] {
  return DISTRICT.filter((b) => b.hp === undefined || (damage[b.id] ?? 0) < b.hp);
}
export function zoneAt(x: number, y: number, z: number) {
  if (y > 5) return 'THE SERVICE ROOFS';
  if (x < -18) return z < 0 ? 'CROW & ANVIL / GUNSMITH' : 'THE VELVET SPOON';
  if (x > 18) return z < 0 ? 'COURIER PASSAGE' : 'THE LAST CALL / BACKSTAGE';
  return z < -20 ? 'TRAM CONCOURSE' : 'LAST CALL / RAIN STREET';
}

export const SPAWNS = [
  [-8, 24],
  [8, -24],
  [8, 24],
  [-8, -24],
  [-8, 0],
  [8, 0],
  [0, 30],
  [0, -30],
] as const;
