"""Convert validated Tripo anatomical FBX clips to one GLB per character."""
import bpy, os, glob, json
OUT=os.path.abspath('public/assets/characters');os.makedirs(OUT,exist_ok=True)
report={}
for hero in ['rook','vesper','miso']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 arm=None;clips=[]
 for kind in ['idle','run','jump']:
  paths=glob.glob(f'.local/tripo/{hero}/{kind}/*-model.fbx')
  if not paths:continue
  before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=os.path.abspath(paths[0]));added=set(bpy.data.objects)-before
  rig=next(o for o in added if o.type=='ARMATURE');act=rig.animation_data.action if rig.animation_data else None
  if not act:raise RuntimeError('No animation '+hero+'/'+kind)
  act.name=kind;act.use_fake_user=True
  # Strip horizontal root travel only, preserving vertical motion and all limb tracks.
  curves=[]
  for layer in act.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:curves+=list(bag.fcurves)
  for fc in curves:
   if fc.data_path=='pose.bones["Root"].location' and fc.array_index in [0,1]:
    value=fc.keyframe_points[0].co.y
    for point in fc.keyframe_points:point.co.y=value
  if arm is None:arm=rig
  else:
   for o in added:bpy.data.objects.remove(o,do_unlink=True)
  clips.append(act)
 arm.animation_data.action=None
 for act in clips:
  track=arm.animation_data.nla_tracks.new();track.name=act.name
  strip=track.strips.new(act.name,int(act.frame_range[0]),act)
  if hasattr(strip,'action_slot') and act.slots:strip.action_slot=act.slots[0]
 # Material textures are embedded by FBX; clamp for a readable painted finish.
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   for m in o.data.materials:
    if m and m.use_nodes:
     p=m.node_tree.nodes.get('Principled BSDF')
     if p:p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.7
 for image in bpy.data.images:
  if image.size[0]>1024 or image.size[1]>1024:
   ratio=1024/max(image.size);image.scale(int(image.size[0]*ratio),int(image.size[1]*ratio))
 bpy.context.scene.frame_set(1)
 bpy.ops.export_scene.gltf(filepath=f'{OUT}/{hero}.glb',export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_apply=False,export_image_format='JPEG',export_jpeg_quality=85)
 report[hero]={'bones':len(arm.data.bones),'clips':[a.name for a in clips],'triangles':sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')}
 print(hero,report[hero])
open('docs/asset-validation.json','w').write(json.dumps(report,indent=2))
