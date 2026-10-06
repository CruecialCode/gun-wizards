/** Offline feasibility measurement, not a gameplay performance benchmark. */
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { DestructibleMesh, FractureOptions } from '@dgreenheck/three-pinata';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';

const material = new MeshStandardMaterial();
function fracture(mode: '3D' | '2.5D', count: number, seed: number) {
  // A watertight, low-complexity proxy. Production meshes need their own validation.
  const mesh = new DestructibleMesh(new BoxGeometry(3, 2, .2), material, material);
  const start = performance.now();
  const fragments = mesh.fracture(new FractureOptions({
    fractureMethod: 'voronoi', fragmentCount: count, seed,
    voronoiOptions: { mode, projectionAxis: 'z' },
  }));
  const ms = performance.now() - start;
  let triangles = 0;
  const hash = createHash('sha256');
  for (const fragment of fragments) {
    const geometry = fragment.geometry;
    const position = geometry.getAttribute('position');
    if (!Array.from(position.array).every(Number.isFinite)) throw Error('Non-finite geometry');
    triangles += (geometry.index?.count ?? position.count) / 3;
    hash.update(JSON.stringify(Array.from(position.array)));
    hash.update(JSON.stringify(geometry.index ? Array.from(geometry.index.array) : []));
    hash.update(JSON.stringify(fragment.matrix.elements));
    geometry.dispose();
  }
  mesh.geometry.dispose();
  return { ms, fragments: fragments.length, triangles, hash: hash.digest('hex') };
}
const results = [];
for (const mode of ['2.5D', '3D'] as const) {
  for (const requestedFragments of [12, 24, 48]) {
    fracture(mode, requestedFragments, 42); // warmup
    const samples = Array.from({length: 8}, () => fracture(mode, requestedFragments, 42));
    const sorted = samples.map(s => s.ms).sort((a,b) => a-b);
    const deterministic = samples.every(s => s.hash === samples[0].hash);
    if (!deterministic) throw Error('Same-runtime seeded geometry differed');
    results.push({mode, requestedFragments, actualFragments: samples[0].fragments,
      triangles: samples[0].triangles, medianMs: +sorted[4].toFixed(2), maxMs: +sorted[7].toFixed(2), sameRuntimeRepeatable: deterministic});
  }
}
material.dispose();
const report = { measuredAt: new Date().toISOString(), library: '@dgreenheck/three-pinata 2.0.1',
  cpu: cpus()[0]?.model, runtime: process.version, samplesPerCase: 8,
  limitations: ['Node CPU only; no rendering, physics, networking or mobile measurement.',
    'Simple watertight box, not a detailed building.', 'Same-process repeatability does not prove cross-platform determinism.'], results };
writeFileSync('docs/qa/fracture-benchmark.json', JSON.stringify(report, null, 2)+'\n');
console.table(results);
