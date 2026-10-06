/* Local-only passive capture of the supplied application's GPU upload inputs. */
(() => {
  const buffers = new Map(),
    textures = new Map(),
    shaders = [],
    pipelines = [];
  let nextId = 1,
    bytesHeld = 0,
    stopped = false,
    serial = 0;
  const pipelineIds = new WeakMap(),
    passes = new WeakMap();
  let framePasses = [],
    lastFrame = [],
    lastWorldPass = null;
  const retainedPasses = new Map();
  const cap = 256 * 1024 * 1024;
  const plain = (value) =>
    JSON.parse(JSON.stringify(value, (key, val) => (typeof val === 'bigint' ? String(val) : val)));
  const wrap = (proto, name, invoke) => {
    const original = proto?.[name];
    if (!original) return;
    proto[name] = function (...args) {
      return invoke.call(this, original, args);
    };
  };
  const sourceBytes = (data, offset = 0, size) => {
    const view = ArrayBuffer.isView(data),
      element = view ? data.BYTES_PER_ELEMENT || 1 : 1;
    const base = view ? data.byteOffset : 0,
      length = view ? data.byteLength : data.byteLength;
    const start = offset * element,
      count = size === undefined ? length - start : size * element;
    return new Uint8Array(view ? data.buffer : data, base + start, count);
  };
  const put = (record, offset, bytes) => {
    if (stopped || !record || offset + bytes.length > record.size || record.size > 64 * 1024 * 1024)
      return;
    if (!record.data) {
      if (bytesHeld + record.size > cap) return;
      record.data = new Uint8Array(record.size);
      bytesHeld += record.size;
    }
    record.data.set(bytes, offset);
    record.writes++;
    record.lastWrite = performance.now();
    record.ranges.push([offset, bytes.length]);
    if (record.ranges.length > 32) record.ranges.shift();
  };
  wrap(globalThis.GPUDevice?.prototype, 'createBuffer', function (original, args) {
    const result = original.apply(this, args),
      d = args[0];
    buffers.set(result, {
      id: nextId++,
      label: d.label || '',
      size: Number(d.size),
      usage: d.usage,
      mappedAtCreation: !!d.mappedAtCreation,
      writes: 0,
      ranges: [],
      mapped: [],
    });
    return result;
  });
  wrap(globalThis.GPUBuffer?.prototype, 'getMappedRange', function (original, args) {
    const result = original.apply(this, args),
      record = buffers.get(this);
    if (record) record.mapped.push({ offset: args[0] || 0, view: result });
    return result;
  });
  wrap(globalThis.GPUBuffer?.prototype, 'unmap', function (original, args) {
    const record = buffers.get(this);
    if (record) {
      for (const range of record.mapped) {
        try {
          put(record, range.offset, new Uint8Array(range.view));
        } catch (e) {
          console.warn('capture mapped', e);
        }
      }
      record.mapped = [];
    }
    return original.apply(this, args);
  });
  wrap(globalThis.GPUQueue?.prototype, 'writeBuffer', function (original, args) {
    const result = original.apply(this, args);
    try {
      put(buffers.get(args[0]), Number(args[1]), sourceBytes(args[2], args[3], args[4]));
    } catch (e) {
      console.warn('capture write', e);
    }
    return result;
  });
  wrap(globalThis.GPUDevice?.prototype, 'createTexture', function (original, args) {
    const result = original.apply(this, args);
    textures.set(result, { id: nextId++, descriptor: plain(args[0]), uploads: [] });
    return result;
  });
  wrap(globalThis.GPUQueue?.prototype, 'writeTexture', function (original, args) {
    const result = original.apply(this, args),
      record = textures.get(args[0].texture);
    if (record && record.uploads.length < 4 && !stopped) {
      const bytes = sourceBytes(args[1]);
      if (bytesHeld + bytes.length < cap) {
        record.uploads.push({
          data: bytes.slice(),
          layout: plain(args[2]),
          size: plain(args[3]),
          mipLevel: args[0].mipLevel || 0,
          origin: plain(args[0].origin || [0, 0, 0]),
        });
        bytesHeld += bytes.length;
      }
    }
    return result;
  });
  wrap(globalThis.GPUDevice?.prototype, 'createShaderModule', function (original, args) {
    shaders.push({ id: nextId++, label: args[0].label || '', code: args[0].code });
    return original.apply(this, args);
  });
  for (const method of ['createRenderPipeline', 'createRenderPipelineAsync'])
    wrap(globalThis.GPUDevice?.prototype, method, function (original, args) {
      const descriptor = plain(args[0]);
      descriptor.captureId = nextId++;
      pipelines.push(descriptor);
      const result = original.apply(this, args);
      if (result?.then) result.then((p) => pipelineIds.set(p, descriptor.captureId));
      else pipelineIds.set(result, descriptor.captureId);
      return result;
    });
  wrap(globalThis.GPUCommandEncoder?.prototype, 'beginRenderPass', function (original, args) {
    const result = original.apply(this, args);
    const record = {
      label: args[0].label || '',
      draws: [],
      vertices: {},
      index: null,
      pipeline: null,
    };
    passes.set(result, record);
    framePasses.push(record);
    if (record.label.includes('HDR world')) lastWorldPass = record;
    if (/world|weapon/i.test(record.label)) retainedPasses.set(record.label, record);
    return result;
  });
  wrap(globalThis.GPURenderPassEncoder?.prototype, 'setPipeline', function (original, args) {
    const p = passes.get(this);
    if (p) p.pipeline = pipelineIds.get(args[0]);
    return original.apply(this, args);
  });
  wrap(globalThis.GPURenderPassEncoder?.prototype, 'setVertexBuffer', function (original, args) {
    const p = passes.get(this);
    if (p)
      p.vertices[args[0]] = {
        buffer: buffers.get(args[1])?.id,
        offset: args[2] || 0,
        size: args[3],
      };
    return original.apply(this, args);
  });
  wrap(globalThis.GPURenderPassEncoder?.prototype, 'setIndexBuffer', function (original, args) {
    const p = passes.get(this);
    if (p)
      p.index = {
        buffer: buffers.get(args[0])?.id,
        format: args[1],
        offset: args[2] || 0,
        size: args[3],
      };
    return original.apply(this, args);
  });
  for (const method of ['drawIndexed', 'draw'])
    wrap(globalThis.GPURenderPassEncoder?.prototype, method, function (original, args) {
      const p = passes.get(this);
      if (p && p.draws.length < 2048)
        p.draws.push({
          method,
          args,
          pipeline: p.pipeline,
          vertices: plain(p.vertices),
          index: plain(p.index),
        });
      return original.apply(this, args);
    });
  wrap(globalThis.GPUQueue?.prototype, 'submit', function (original, args) {
    const result = original.apply(this, args);
    if (framePasses.length) {
      lastFrame = framePasses;
      framePasses = [];
    }
    return result;
  });
  const send = async (name, bytes, metadata) => {
    const response = await fetch('/capture?name=' + encodeURIComponent(name), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Capture-Metadata': encodeURIComponent(JSON.stringify(metadata)),
      },
      body: bytes,
    });
    if (!response.ok) throw new Error('capture save ' + response.status);
  };
  async function snapshot(reason = 'manual') {
    const tag = String(++serial).padStart(2, '0') + '-' + reason;
    const list = [],
      capturedPasses = plain([
        ...retainedPasses.values(),
        ...lastFrame.filter((p) => !retainedPasses.has(p.label)),
      ]);
    const frozenBuffers = [...buffers.values()]
      .filter((r) => r.data)
      .map((r) => ({ ...r, data: r.data.slice(), ranges: plain(r.ranges) }));
    for (const record of frozenBuffers)
      if (record.data) {
        const { data, mapped, ...metadata } = record;
        const name = `${tag}-buffer-${record.id}.bin`;
        await send(name, data.slice(), metadata);
        list.push({ name, ...metadata });
      }
    for (const record of textures.values())
      for (let i = 0; i < record.uploads.length; i++) {
        const { data, ...upload } = record.uploads[i];
        const name = `${tag}-texture-${record.id}-${i}.bin`;
        await send(name, data, { descriptor: record.descriptor, ...upload });
      }
    await send(
      `${tag}-manifest.json`,
      JSON.stringify({
        reason,
        at: performance.now(),
        bytesHeld,
        passes: capturedPasses,
        buffers: list,
        textures: [...textures.values()].map((r) => ({
          id: r.id,
          descriptor: r.descriptor,
          count: r.uploads.length,
        })),
        shaders,
        pipelines,
      }),
      {},
    );
    document.documentElement.dataset.gpuCapture = `saved ${tag}: ${list.length} buffers`;
    console.info('GPU CAPTURE SAVED', tag, list.length);
  }
  window.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.textContent = 'CAPTURE GPU';
    button.id = 'capture-gpu';
    button.style =
      'position:fixed;right:8px;top:8px;z-index:99999;padding:8px;background:#fff;color:#000';
    button.onclick = () => snapshot().catch(console.error);
    document.body.append(button);
  });
  globalThis.darkVeilObservation = {
    phase: null,
    health: null,
    ammo: null,
    limitations: ['Health and magazine count are not exposed by the inspected JS bridges.'],
  };
  let observationPending = false;
  setInterval(async () => {
    if (!new URLSearchParams(location.search).has('observe') || observationPending) return;
    const observation = { ...globalThis.darkVeilObservation, observedAt: performance.now() };
    const scene = [...buffers.values()].find(
      (b) => b.label === 'Scene lighting uniforms' && b.data,
    );
    if (scene) {
      const floats = new Float32Array(scene.data.buffer);
      observation.camera = {
        position: Array.from(floats.slice(64, 67)),
        inverseView: Array.from(floats.slice(48, 64)),
        viewProjection: Array.from(floats.slice(0, 16)),
      };
    }
    observation.worldDraws =
      lastWorldPass?.draws.map((d) => ({ method: d.method, args: d.args })) || [];
    // These are render telemetry, not screen-visible detections or health/AI state.
    observationPending = true;
    try {
      await send('observation.json', JSON.stringify(observation), {});
    } catch (e) {
      console.warn('observation save', e);
    } finally {
      observationPending = false;
    }
  }, 200);
  globalThis.captureGPU = snapshot;
  setTimeout(() => snapshot('auto').catch(console.error), 12000);
})();
