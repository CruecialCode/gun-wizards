import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { roster } from './roster';
import { block, mat } from './world';
const loader = new GLTFLoader();
const cache = new Map<number, Promise<{ scene: T.Group; animations: T.AnimationClip[] }>>();
export class Character {
  group = new T.Group();
  mixer?: T.AnimationMixer;
  idle?: T.AnimationAction;
  run?: T.AnimationAction;
  model?: T.Object3D;
  ready = false;
  constructor(public hero: number) {
    // Loading silhouette is removed as soon as the authored character arrives.
    const coat = mat(roster[hero].coat);
    block(this.group, 0, 1.1, 0, 0.55, 0.8, 0.35, coat);
    const head = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), mat(0xd6b595));
    head.position.y = 1.7;
    this.group.add(head);
    if (!cache.has(hero))
      cache.set(
        hero,
        loader.loadAsync(
          `${import.meta.env.BASE_URL}assets/characters/${['rook', 'vesper', 'miso'][hero]}.glb`,
        ),
      );
    void cache
      .get(hero)!
      .then((gltf) => {
        this.group.clear();
        const model = clone(gltf.scene);
        this.model = model;
        const bounds = new T.Box3().setFromObject(model);
        const size = bounds.getSize(new T.Vector3());
        const s = 1.9 / size.y;
        model.scale.setScalar(s);
        model.position.y = -bounds.min.y * s;
        model.rotation.y = -Math.PI / 2;
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.group.add(model);
        this.mixer = new T.AnimationMixer(model);
        const clips = gltf.animations;
        const idle = clips.find((c) => /idle/i.test(c.name)) ?? clips[0],
          run = clips.find((c) => /run/i.test(c.name));
        if (idle) {
          this.idle = this.mixer.clipAction(idle);
          this.idle.play();
        }
        if (run) {
          this.run = this.mixer.clipAction(run);
          this.run.play();
          this.run.setEffectiveWeight(0);
        }
        this.ready = true;
      })
      .catch(() => {
        cache.delete(hero);
      });
  }
  update(dt: number, speed = 0) {
    this.mixer?.update(dt);
    if (this.idle && this.run) {
      const w = Math.min(1, speed / 5);
      this.idle.setEffectiveWeight(1 - w);
      this.run.setEffectiveWeight(w);
      this.run.timeScale = Math.max(0.7, speed / 7);
    }
  }
}
export async function loadWeapon(hero: number) {
  const g = await loader.loadAsync(
    `${import.meta.env.BASE_URL}assets/weapons/${['bad-omen-hero', 'dead-letter', 'lucky-cat'][hero]}.glb`,
  );
  const object = g.scene;
  object.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (hero === 0) {
    const normalized = new T.Group();
    object.rotation.set(0.38, Math.PI, 0);
    object.scale.setScalar(0.7);
    object.position.y = -0.15;
    normalized.add(object);
    return normalized;
  }
  return object;
}
