"""Reproducible original Blender weapon assets. No external textures or paid APIs."""
import bpy, math, os
from mathutils import Vector
OUT=os.path.abspath('public/assets/weapons');os.makedirs(OUT,exist_ok=True)
def material(name,color,metal=0,rough=.45):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def box(name,loc,scale,mat,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:m=o.modifiers.new('Crafted rounded edges','BEVEL');m.width=bevel;m.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,radius,depth,mat,axis='Y',vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 if axis=='X':o.rotation_euler[1]=math.pi/2
 o.data.materials.append(mat);m=o.modifiers.new('Edge softness','BEVEL');m.width=.008;m.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
for hero in range(3):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 brass=material('Brushed antique brass',(.57,.35,.13),.72,.3);steel=material('Blued steel',(.055,.09,.105),.7,.27);ivory=material('Fired ceramic',(.85,.78,.6),.16,.3);wood=material('Walnut grip',(.17,.065,.032),0,.6);ink=material('Bore',(.009,.014,.017),.1,.6)
 enamel=material('Signature enamel',[(.43,.07,.055),(.06,.3,.31),(.65,.32,.035)][hero],.25,.31)
 box('Receiver',(0,0,.1),(.19,.49,.19),ivory)
 box('Enamel spine',(0,.02,.205),(.16,.43,.035),enamel,.012)
 box('Lower frame',(0,.04,-.02),(.15,.37,.07),brass,.015)
 grip=box('Carved walnut grip',(0,.17,-.21),(.145,.16,.32),wood,.04);grip.rotation_euler[0]=-.22
 for j in range(7):box('Grip inlay',(0,.244,-.09-j*.036),(.12,.008,.008),brass,.002)
 box('Magazine',(0,.20,-.385),(.16,.18,.035),enamel,.01)
 box('Moving action',(0,.17,.12),(.20,.13,.09),steel,.018)
 for x in [-.08,.08]:
  box('Side brass rail',(x,-.015,.10),(.018,.46,.025),brass,.004)
  for y in [-.12,.10]:cyl('Frame pin',(x*1.27,y,.06),.018,.012,brass,'X',16)
 length=[.35,.47,.25][hero]
 barrels=[0] if hero<2 else [-.065,.065]
 for x in barrels:
  cyl('Barrel',(x,-.31,.105),.061,length,steel)
  for y in [-.22,-.33,-.31-length/2+.012]:cyl('Barrel collar',(x,y,.105),.074,.035,brass)
  cyl('Muzzle',(x,-.315-length/2,.105),.048,.007,ink)
  cyl('Ceramic barrel jacket',(x,-.28,.105),.066,.13,ivory)
 for j in range(5):box('Cooling cutout',(0,-.08+j*.045,.231),(.09,.018,.006),steel,.002)
 box('Front sight',(0,-.36,.193),(.027,.035,.055),brass,.005)
 for x in [-.037,.037]:box('Rear sight',(x,.215,.228),(.025,.035,.032),steel,.004)
 # Open rectangular trigger guard with rounded corners, rather than a solid block.
 box('Guard bottom',(0,-.035,-.16),(.055,.19,.025),brass,.012)
 box('Guard front',(0,-.12,-.095),(.055,.025,.14),brass,.01)
 trigger=box('Trigger',(0,-.015,-.07),(.025,.025,.09),steel,.008);trigger.rotation_euler[0]=-.35
 cyl('Arcane chamber',(0,.025,.11),.085,.22,brass,'X')
 for x in [-.115,.115]:
  cyl('Chamber enamel',(x,.025,.11),.065,.016,enamel,'X')
  cyl('Chamber seal',(x*1.1,.025,.11),.022,.018,ivory,'X',6)
 if hero==1:box('Split shroud',(0,-.36,.17),(.15,.34,.055),ivory,.025)
 if hero==2:cyl('Lucky bell',(0,.24,-.44),.045,.06,brass,'Z',24)
 bpy.ops.export_scene.gltf(filepath=f'{OUT}/{["bad-omen","dead-letter","lucky-cat"][hero]}.glb',export_format='GLB',export_apply=True)
