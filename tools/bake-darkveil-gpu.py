#!/usr/bin/env python3
"""Bake a captured Dark Veil world draw into local reference mesh (requires NumPy).
Reads only captured GPU input bytes. Does not infer collision/animation semantics.
"""
import argparse, json, hashlib
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('manifest',type=Path)
p.add_argument('--weapon-only',action='store_true',help='Bake held weapon in camera-local coordinates without touching world or skeleton')
p.add_argument('--out',type=Path,default=Path('rust/web/reference-assets'))
p.add_argument('--static-only',action='store_true',default=True,help='Keep only Active arena geometry (default)')
p.add_argument('--include-actors',action='store_false',dest='static_only',help='Also bake frozen captured actors into world.bin')
a=p.parse_args(); root=a.manifest.parent; manifest=json.loads(a.manifest.read_text());a.out.mkdir(parents=True,exist_ok=True)
records={b['id']:b for b in manifest['buffers']}; pipelines={v['captureId']:v for v in manifest['pipelines']}
def data(i):return (root/records[i]['name']).read_bytes()
if a.weapon_only:
 weapon_pass=next((v for v in manifest['passes'] if v['label']=='First person weapon'),None)
 if not weapon_pass or not weapon_pass['draws']:raise SystemExit('No held weapon draw captured')
 uniform_record=next(b for b in manifest['buffers'] if b['label']=='Scene lighting uniforms')
 uniform=np.frombuffer(data(uniform_record['id']),dtype='<f4');inverse_view=uniform[48:64].reshape(4,4).T;view=np.linalg.inv(inverse_view)
 chunks=[];parts=[];cursor=0
 for draw in weapon_pass['draws']:
  if draw['method']!='drawIndexed':continue
  count,ninstance,first,base,firstinstance=draw['args'];vb=draw['vertices']['0'];ib=draw['vertices']['1'];ix=draw['index']
  layout=pipelines[draw['pipeline']]['vertex']['buffers']
  if [v['arrayStride'] for v in layout]!=[56,132]:raise SystemExit('Unexpected weapon layout')
  indices=np.frombuffer(data(ix['buffer']),dtype='<u4' if ix['format']=='uint32' else '<u2',offset=ix.get('offset',0))[first:first+count].astype(np.int64)+base
  vertices=np.frombuffer(data(vb['buffer']),dtype='<f4',offset=vb.get('offset',0)).reshape(-1,14)[indices]
  instances=np.frombuffer(data(ib['buffer']),dtype='<f4',offset=ib.get('offset',0)).reshape(-1,33)
  for i in range(firstinstance,firstinstance+ninstance):
   inst=instances[i];model=inst[:16].reshape(4,4).T;transform=view@model
   xyz=vertices[:,:3]@transform[:3,:3].T+transform[:3,3]
   nm=transform[:3,:3]/np.maximum(np.sum(transform[:3,:3]**2,axis=0),.0001);normals=vertices[:,3:6]@nm.T;normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8)
   packed=np.column_stack([xyz,normals,vertices[:,8:11]*inst[16:19],np.full(len(vertices),10),vertices[:,6:8]]).astype('<f4');chunks.append(packed)
   parts.append(dict(vertex_start=cursor,vertex_count=len(packed),source_first_index=first,source_base_vertex=base,captured_instance=i,world_model=inst[:16].tolist(),camera_local_model=transform.T.flatten().tolist(),params=inst[20:24].tolist(),element_glow=inst[24:28].tolist(),tier_glow=inst[28:32].tolist(),finish=float(inst[32])));cursor+=len(packed)
 weapon=np.concatenate(chunks);(a.out/'weapon.bin').write_bytes(weapon.tobytes());metadata=dict(vertex_stride=48,vertex_count=len(weapon),bounds=[weapon[:,:3].min(axis=0).tolist(),weapon[:,:3].max(axis=0).tolist()],parts=parts,captured_camera=uniform[64:68].tolist(),inverse_view=uniform[48:64].tolist(),view_projection=uniform[:16].tolist(),coordinate_system='Camera-local: +X right, +Y up, forward -Z. Transform by current camera inverse-view once; no extra translation needed.',limitations=['Captured idle pose; reconstruct recoil/reload independently.','Material finish/glow parameters recorded separately; flat vertex material10 only implements atlas-lit base.'])
 (a.out/'weapon.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata,indent=2));raise SystemExit(0)
passes=[v for v in manifest['passes'] if 'HDR world' in v['label']]
if not passes:raise SystemExit('No HDR world pass captured; reload instrumented site and capture during gameplay.')
chunks=[]; objects=[]; colliders=[]
for draw_number,draw in enumerate(passes[-1]['draws']):
 if draw['method']!='drawIndexed' or '1' not in draw['vertices']:continue
 pipe=pipelines[draw['pipeline']];layouts=pipe['vertex']['buffers']; stride=layouts[0]['arrayStride'];istride=layouts[1]['arrayStride']
 if stride!=56 or istride!=132:raise SystemExit(f'Unexpected vertex/instance stride {stride}/{istride}')
 count,ninstance,first,base,first_instance=draw['args'];vbind=draw['vertices']['0'];ibind=draw['vertices']['1'];indexbind=draw['index']
 index_type='<u4' if indexbind['format']=='uint32' else '<u2';indices=np.frombuffer(data(indexbind['buffer']),dtype=index_type,offset=indexbind['offset'])
 indices=indices[first:first+count].astype(np.int64)+base
 vertices=np.frombuffer(data(vbind['buffer']),dtype='<f4',offset=vbind['offset']).reshape(-1,14)[indices]
 instances=np.frombuffer(data(ibind['buffer']),dtype='<f4',offset=ibind['offset']).reshape(-1,33)
 for instance_index in range(first_instance,first_instance+ninstance):
  inst=instances[instance_index];matrix=inst[:16].reshape(4,4).T
  xyz=vertices[:,:3]@matrix[:3,:3].T+matrix[:3,3]
  normal_matrix=matrix[:3,:3]/np.maximum(np.sum(matrix[:3,:3]**2,axis=0),.0001)
  normals=vertices[:,3:6]@normal_matrix.T;normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8)
  color=vertices[:,8:11]*inst[16:19];material=np.where((vertices[:,11]>5.5)&(vertices[:,11]<6.5),11.,10.)
  packed=np.column_stack([xyz,normals,color,material,vertices[:,6:8]]).astype('<f4')
  # Geometry is static rest pose: wind and skeletal transform snapshots are not animation.
  chunks.append(packed)
  low=xyz.min(axis=0);high=xyz.max(axis=0)
  obj=dict(draw=draw_number,instance=instance_index,source_label=records[vbind['buffer']]['label'],vertex_start=sum(len(c) for c in chunks[:-1]),vertex_count=len(packed),vertex_buffer=vbind['buffer'],index_buffer=indexbind['buffer'],first_index=first,index_count=count,bounds=[low.tolist(),high.tolist()],tint=inst[16:20].tolist(),params=inst[20:24].tolist(),matrix=inst[:16].tolist())
  objects.append(obj)
  # Only return compact cuboid candidates, explicitly not authoritative collision.
  tiles=np.floor(vertices[:,6:8]*4).astype(int);stone=np.all(tiles[:,0]+tiles[:,1]*4==0)
  extent=high-low
  if stone and count<=72 and extent[1]>.8 and max(extent[0],extent[2])>.4:
   colliders.append(dict(center=((low+high)/2).tolist(),half_extents=(extent/2).tolist(),source_instance=instance_index))
if not chunks:raise SystemExit('No compatible indexed instanced geometry draws')
# Extract the first ordinary skeleton using the first body instance as its anchor.
actor_pairs=[(obj,chunk) for obj,chunk in zip(objects,chunks) if obj['source_label']=='Modular geometry vertices']
if actor_pairs:
 root_obj=actor_pairs[0][0]; root_pos=np.array(root_obj['matrix'][12:15],dtype=np.float32)
 selected=[(o,c.copy()) for o,c in actor_pairs if np.linalg.norm(np.array(o['matrix'][12:15])[[0,2]]-root_pos[[0,2]])<1.3]
 if selected:
  minimum_y=min(float(c[:,1].min()) for o,c in selected); origin=np.array([root_pos[0],minimum_y,root_pos[2]],dtype=np.float32)
  parts=[];skel_chunks=[];cursor=0
  labels={0:'torso',4314:'head',7632:'upper_arm',8046:'thigh',31728:'eye',61476:'forearm',62550:'shin',216366:'held_weapon'}
  for obj,chunk in selected:
   chunk[:,:3]-=origin;center=np.array(obj['matrix'][12:15])-origin
   parts.append(dict(part=len(parts),name=labels.get(obj['first_index'],'unknown'),vertex_start=cursor,vertex_count=len(chunk),pivot=center.tolist(),captured_matrix=obj['matrix'],source_instance=obj['instance'],source_first_index=obj['first_index']))
   cursor+=len(chunk);skel_chunks.append(chunk)
  skeleton=np.concatenate(skel_chunks);(a.out/'skeleton.bin').write_bytes(skeleton.astype('<f4').tobytes())
  (a.out/'skeleton.json').write_text(json.dumps(dict(vertex_stride=48,vertex_count=len(skeleton),captured_origin=origin.tolist(),captured_body_root=root_pos.tolist(),bounds=[skeleton[:,:3].min(axis=0).tolist(),skeleton[:,:3].max(axis=0).tolist()],parts=parts,limitations=['Captured pose normalized to its lowest foot vertex; runtime must supply fresh limb animation.','Part names and pivots inferred from mesh ranges and transforms, not recovered animation source.']),indent=2)+'\n')
if a.static_only:
 pairs=[(o,c) for o,c in zip(objects,chunks) if o['source_label']=='Active arena vertices'];objects=[o for o,c in pairs];chunks=[c for o,c in pairs]
world=np.concatenate(chunks);(a.out/'world.bin').write_bytes(world.tobytes())
atlas=next(t for t in manifest['textures'] if t['descriptor'].get('label')=='Hand-authored procedural material atlas')
tag=a.manifest.name.removesuffix('-manifest.json');name=f"{tag}-texture-{atlas['id']}-0.bin";metadata=json.loads((root/(name+'.meta.json')).read_text());raw=(root/name).read_bytes();dims=atlas['descriptor']['size'];width,height=dims['width'],dims['height'];row=metadata['layout'].get('bytesPerRow',width*4);offset=metadata['layout'].get('offset',0)
rgba=b''.join(raw[offset+y*row:offset+y*row+width*4] for y in range(height));(a.out/'atlas.rgba').write_bytes(rgba);(a.out/'atlas.json').write_text(json.dumps(dict(width=width,height=height,format='rgba8unorm-srgb'),indent=2)+'\n')
u=next(b for b in manifest['buffers'] if b['label']=='Scene lighting uniforms');uniform=np.frombuffer(data(u['id']),dtype='<f4')
names=['camera_time','viewport','sun_direction','sun_color','ambient','fog_color_density','fog_params','sky_zenith_radius','sky_params','weather','weather_params','weather_lightning']
scene={name:uniform[64+i*4:68+i*4].tolist() for i,name in enumerate(names)}
scene['inverse_view']=uniform[48:64].tolist();scene['view_projection']=uniform[:16].tolist();scene['lights']=[dict(position_radius=uniform[112+i*12:116+i*12].tolist(),color_intensity=uniform[116+i*12:120+i*12].tolist(),shadow_slot=uniform[120+i*12:124+i*12].tolist()) for i in range(48) if uniform[115+i*12]>0]
scene.update(source_manifest=str(a.manifest),source_sha256=hashlib.sha256(a.manifest.read_bytes()).hexdigest(),vertex_count=len(world),vertex_stride=48,triangle_count=len(world)//3,bounds=[world[:,:3].min(axis=0).tolist(),world[:,:3].max(axis=0).tolist()],atlas=dict(width=width,height=height),objects=objects,collider_candidates=colliders,limitations=['Baked geometry uses rest-pose wind; animated actors remain frozen in their captured instance transforms.','Collision candidates are conservative AABBs, not recovered physics data.','This mesh does not implement the original shader lighting, shadows, particles or postprocessing.'])
(a.out/'world.json').write_text(json.dumps(scene,indent=2)+'\n')
print(json.dumps({k:scene[k] for k in ['vertex_count','triangle_count','bounds','camera_time','atlas']},indent=2));print('objects',len(objects),'lights',len(scene['lights']),'collider candidates',len(colliders))
