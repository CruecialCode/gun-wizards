"""Normalize and optimize the authored Tripo source for the Bad Omen slot."""
import bpy, os, math, json
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=os.path.abspath('.local/tripo/bad-omen-v2/aeaa02a9-7933-44a7-8549-5b33da3dbc70-pbr_model.glb')
bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)));maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
print('SOURCE BOUNDS',tuple(minimum),tuple(maximum))
# Source uses Blender Y as its long barrel axis. Transform selected after inspecting bounds.
for im in bpy.data.images:
 if im.size[0]>1024 or im.size[1]>1024:
  ratio=1024/max(im.size);im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio))
# Keep the hero silhouette while reducing the provider's dense source to the browser budget.
for o in meshes:
 if len(o.data.polygons)>40000:
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Browser triangle budget','DECIMATE');mod.ratio=40000/len(o.data.polygons)
  bpy.ops.object.modifier_apply(modifier=mod.name)
# Export source for runtime normalization (keeps orientation explicit in one adapter).
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/weapons/bad-omen-hero.glb'),export_format='GLB',export_apply=True,export_image_format='JPEG',export_jpeg_quality=90)
print('TRIANGLES',sum(len(o.data.polygons) for o in meshes))
