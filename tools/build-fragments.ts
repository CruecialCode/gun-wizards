/** Bake fracture geometry once; combat never runs Voronoi on its render thread. */
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { DestructibleMesh, FractureOptions } from '@dgreenheck/three-pinata';
import { writeFileSync, mkdirSync } from 'node:fs';
const material = new MeshBasicMaterial();
const mesh = new DestructibleMesh(new BoxGeometry(1, 1, 1), material, material);
const fragments = mesh.fracture(
  new FractureOptions({
    fractureMethod: 'voronoi',
    fragmentCount: 12,
    seed: 71,
    voronoiOptions: { mode: '3D' },
  }),
);
const data = fragments.map((f) => {
  f.updateMatrixWorld(true);
  const g = f.geometry.clone().applyMatrix4(f.matrixWorld);
  const result = {
    position: Array.from(g.getAttribute('position').array),
    normal: Array.from(g.getAttribute('normal').array),
    index: g.index ? Array.from(g.index.array) : null,
  };
  g.dispose();
  f.geometry.dispose();
  return result;
});
mkdirSync('public/assets/world', { recursive: true });
writeFileSync('public/assets/world/fragments.json', JSON.stringify(data));
mesh.geometry.dispose();
material.dispose();
console.log(`Baked ${data.length} fracture pieces`);
