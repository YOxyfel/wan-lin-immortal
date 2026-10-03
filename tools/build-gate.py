"""Original Chinese threshold model, authored for this camera journey."""
import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def material(name, color, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.78; p.inputs['Metallic'].default_value=metallic
    return m
ink=material('ink',(.045,.042,.038)); stone=material('stone',(.34,.30,.24))
brass=material('brass',(.53,.32,.12),.35); red=material('vermilion',(.31,.023,.018))
def box(name, loc, size, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Cut stone edges','BEVEL'); b.width=bevel; b.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return o
for x in [-5.6,5.6]:
    for z,size in [(.3,(2.2,2.2,.6)),(.85,(1.7,1.7,.5)),(5.4,(1.05,1.05,8.6)),(9.7,(1.8,1.6,.4))]:
        box('Pillar', (x,0,z),size,stone)
    for z in [1.3,2,8.7,9.25]: box('Collar',(x,0,z),(1.3,1.3,.12),brass,.025)
    for dx in [-.37,.37]: box('Inlaid groove',(x+dx,-.54,5.3),(.028,.035,6.7),brass,.005)
    for side in [-1,1]:
        box('Bracket',(x+side*.43,0,9.1),(.16,1.5,.8),ink)
        box('Bracket cap',(x+side*.43,0,9.45),(.36,1.6,.15),brass)
for z in [9.55,10.1]: box('Lintel',(0,0,z),(13,1.5,.5),ink)
box('Carved plaque',(0,-.81,9.82),(3.2,.18,.95),brass)
box('Plaque inset',(0,-.92,9.82),(2.95,.07,.72),ink)
for x in [-4,-2,0,2,4]: box('Roof bracket',(x,0,10.65),(.36,1.2,.9),stone)
def roof(width,depth,z):
    verts=[]; faces=[]; nx=40; ny=12
    for j in range(ny+1):
        v=2*j/ny-1
        for i in range(nx+1):
            u=2*i/nx-1
            h=1.8*(1-abs(v))+.48*abs(u)**4+.5*abs(v)**4
            verts.append((u*width/2,v*depth/2,z+h))
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i; faces.append((k,k+1,k+nx+2,k+nx+1))
    mesh=bpy.data.meshes.new('Curved tile roof'); mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Swept eaves',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(ink)
    for i in range(-18,19):
        u=i/18
        for v in [-1,1]:
            box('Eave tile', (u*width/2,v*depth/2,z+.48*abs(u)**4+.5),(.17,.24,.12),brass,.02)
    box('Roof ridge',(0,0,z+1.93),(width*.85,.22,.24),brass)
roof(15,5.3,10.5); roof(9,3.6,12.4)
for x in [-7.4,7.4]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.16,location=(x,0,12))
    bpy.context.object.data.materials.append(brass)
box('Threshold',(0,0,.12),(13,3.4,.24),stone)
# Merge by material to keep exported draw calls small.
for mat in [ink,stone,brass,red]:
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not objects: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='Threshold_'+mat.name
out=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'assets','models','threshold.glb')
os.makedirs(os.path.dirname(out),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_yup=True)
print('Exported original threshold:',os.path.getsize(out))

