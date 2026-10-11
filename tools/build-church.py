"""Eigenständige Bergkirche: Blender-Quelle, GLB und Einbauvertrag."""
import bpy, bmesh, math, json, random, pathlib, sys
import numpy as np
from mathutils import Vector
print('CHURCH start', flush=True)

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/church'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(271)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Alle Modellmaße in Spielkoordinaten: Meter, Y oben, Eingang in Richtung +Z.
def xyz(x, y, z): return (x, -z, y)
colliders, floors, doors = [], [], []
TOWER_RISE = 6.0

def texture(name, kind, size=512):
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    rng = np.random.default_rng(45)
    noise = rng.random((size, size))
    if kind == 'wood':
        grain = .5 + .2*np.sin(xx*.52+np.sin(yy*.012)*3) + .13*np.sin(xx*1.13+np.sin(yy*.008)*5)
        values = .75+grain*.3+noise*.13
        rgb = np.array([.235,.175,.125])[None,None,:]*values[:,:,None]
    elif kind == 'slate':
        row = (yy//42).astype(int)
        joint = (yy%42<2) | ((xx+(row%2)*31)%62<2)
        values = .8+noise*.25+.1*np.sin(xx*.08+yy*.05)
        rgb = np.array([.22,.265,.29])[None,None,:]*values[:,:,None]
        rgb[joint] *= .57
    elif kind == 'stone':
        row = (yy//85).astype(int)
        joint = (yy%85<3) | ((xx+(row%2)*71)%142<3)
        values = .88+noise*.19+.07*np.sin(xx*.07)*np.sin(yy*.1)
        rgb = np.array([.61,.585,.525])[None,None,:]*values[:,:,None]
        rgb[joint] *= .57
    else:
        clouds=.5+.18*np.sin(xx*.015+np.sin(yy*.021)*2)+.15*np.cos(yy*.025+xx*.009)
        rgb=np.array([.25,.38,.44])[None,None,:]+clouds[:,:,None]*np.array([.38,.31,.21])[None,None,:]
    rgba=np.concatenate([np.clip(rgb,0,1),np.ones((size,size,1))],axis=2).astype(np.float32)
    image=bpy.data.images.new(name,width=size,height=size)
    image.pixels.foreach_set(rgba.ravel()); image.pack()
    return image

def material(name, color, tex=None, rough=.8, metal=0, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if tex:
        t=m.node_tree.nodes.new('ShaderNodeTexImage'); t.image=tex
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m

stone=material('Weathered limestone',(.61,.585,.525),texture('Limestone authored', 'stone'))
trim=material('Carved pale stone',(.68,.65,.57),rough=.84)
wood=material('Aged dark oak',(.23,.17,.12),texture('Oak authored','wood'))
slate=material('Blue slate',(.22,.265,.29),texture('Slate authored','slate'))
iron=material('Forged iron',(.075,.083,.08),rough=.48,metal=.8)
brass=material('Old brass',(.47,.31,.105),rough=.38,metal=.72)
ceiling=material('Faded sky vault',(.45,.52,.53),texture('Faded sky authored','sky'),rough=.91)
floor_mat=material('Worn flagstones',(.32,.325,.31),rough=.72)
glass=[material('Glass '+str(i),c,rough=.23,emission=.32) for i,c in enumerate([
    (.10,.38,.53),(.22,.20,.50),(.52,.16,.29),(.72,.40,.14),(.18,.49,.40),(.58,.45,.65)])]
white=material('Ivory candles',(.77,.72,.57),rough=.8)

def mesh(name, vertices, faces, mat):
    data=bpy.data.meshes.new(name); data.from_pydata([xyz(*p) for p in vertices],[],faces); data.update()
    bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(data); bm.free()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o)
    if mat: data.materials.append(mat)
    return o

def box(name,x,y,z,w,h,d,mat,bevel=0,solid=False):
    vertices=[(sx*w/2,sy*h/2,sz*d/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    o.location=xyz(x,y,z)
    if solid: colliders.append({'id':name,'center':[x,y,z],'halfSize':[w/2,h/2,d/2]})
    return o

def beam(name,a,b,width,mat=wood):
    av,bv=Vector(xyz(*a)),Vector(xyz(*b)); delta=bv-av
    o=box(name,0,0,0,width,delta.length,width,mat)
    # Box-Längsachse ist Blender-Z, entsprechend Spiel-Y.
    o.location=(av+bv)/2; o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return o

def arch(w,h,n=16):
    spring=h-w*math.sqrt(3)/2
    points=[(-w/2,0),(-w/2,spring)]
    for i in range(1,n+1):
        a=math.pi-i/n*math.pi/3
        points.append((w/2+w*math.cos(a),spring+w*math.sin(a)))
    for i in range(1,n+1):
        a=math.pi/3-i/n*math.pi/3
        points.append((-w/2+w*math.cos(a),spring+w*math.sin(a)))
    points.append((w/2,0))
    return points

def prism(name,poly,depth,mat):
    n=len(poly); v=[(x,y,z) for z in [-depth/2,depth/2] for x,y in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    f.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,v,f,mat)

def place(o,x,y,z,side=False):
    o.location=xyz(x,y,z)
    if side: o.rotation_euler.z=math.pi/2
    return o

def ring(name,poly,scale,depth,mat):
    # Polygonring mit schmalem Profil; Pfeiler und Spitzbogen bleiben offen.
    inner=[(x*scale,y*scale) for x,y in poly]; n=len(poly)
    v=[(x,y,z) for z in [-depth/2,depth/2] for p in [poly,inner] for x,y in p]
    f=[]
    for i in range(n):
        j=(i+1)%n
        f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    return mesh(name,v,f,mat)

def cut(wall,name,x,y,z,w,h,side=False):
    cutter=place(prism('cutter '+name,arch(w,h),1.5,None),x,y,z,side)
    bpy.context.view_layer.objects.active=wall
    mod=wall.modifiers.new('Opening '+name,'BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name); bpy.data.objects.remove(cutter,do_unlink=True)

def window(name,x,y,z,w,h,side=False):
    outline=arch(w,h)
    for i,(extra,depth) in enumerate([(.24,.25),(.10,.18)]):
        o=ring(name+' moulding '+str(i),arch(w+extra,h+extra*.65),.93,depth,trim)
        place(o,x,y-extra*.15,z,side)
    # Farbige Bleiverglasung als einzelne polygonale Scheiben, beidseitig sichtbar.
    spring=h-w*math.sqrt(3)/2
    columns,rows=5,11
    for row in range(rows):
        for col in range(columns):
            x0=-w/2+col*w/columns; x1=x0+w/columns
            y0=row*h/rows; y1=y0+h/rows
            def top(xx): return spring+math.sqrt(max(0,w*w-(abs(xx)+w/2)**2))
            t0,t1=min(y1,top(x0)),min(y1,top(x1))
            if min(t0,t1)<=y0+.02: continue
            # Jede Scheibe hat eine eigene leichte Färbung, schmale Fugen sind die Bleiruten.
            pane=prism(name+' glass',[(x0+.018,y0+.018),(x1-.018,y0+.018),(x1-.018,t1-.018),(x0+.018,t0-.018)],.025,glass[(row*3+col+(row//3))%len(glass)])
            place(pane,x,y,z,side)
    for i in [-1,0,1]:
        bx=x+i*w*.23 if not side else x
        bz=z if not side else z-i*w*.23
        box(name+' mullion',bx,y+spring*.5,bz,.075,spring,.075,iron)

def roof(name,w,z0,z1,eave,ridge,mat=slate):
    v=[(-w/2,eave,z0),(0,ridge,z0),(w/2,eave,z0),(-w/2,eave,z1),(0,ridge,z1),(w/2,eave,z1)]
    o=mesh(name,v,[(0,1,4,3),(1,2,5,4)],mat)
    # Dach ist eine Schale, keine Füllung des Innenraums.
    mod=o.modifiers.new('Roof thickness','SOLIDIFY'); mod.thickness=.16
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    for z in [z0,z1]:
        beam(name+' verge',(-w/2,eave,z),(0,ridge,z),.17)
        beam(name+' verge',(0,ridge,z),(w/2,eave,z),.17)
    beam(name+' ridge',(0,ridge+.1,z0),(0,ridge+.1,z1),.15)
    return o

def cross(name,x,y,z,size=1):
    box(name,x,y+size*.6,z,.12,size*1.4,.12,iron)
    box(name,x,y+size*.85,z,size*.75,.12,.12,iron)

# Nave und Turm stimmen mit den bisherigen Platzhaltergrundrissen überein.
floor=box('Nave floor',0,-.12,-18.5,13,.24,23,floor_mat)
floors.append({'id':'nave','min':[-6.2,-30],'max':[6.2,-7],'y':0})
box('Tower floor',0,-.12,-3.5,7,.24,7,floor_mat)
floors.append({'id':'tower','min':[-3.25,-7],'max':[3.25,0],'y':0})
box('Foundation nave',0,-.75,-18.5,13.3,1.3,23.3,stone)
box('Foundation tower',0,-.75,-3.5,7.3,1.3,7.2,stone)
# Sanfter Zugang statt einer hohen Stufe, definierte Gehfläche für den Weltadapter.
ramp=mesh('Entrance ramp',[(-2,0,0),(2,0,0),(-2,-.25,3),(2,-.25,3),(-2,-.4,0),(2,-.4,0),(-2,-.4,3),(2,-.4,3)],[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],stone)
floors.append({'id':'entrance-ramp','min':[-2,0],'max':[2,3],'yAtMinZ':0,'yAtMaxZ':-.25})

for side in [-1,1]:
    wall=box('Nave wall '+str(side),side*6.28,4.5,-18.5,.44,9,23,stone)
    print('CHURCH walls',side, flush=True)
    for z in [-10.5,-14.5,-18.5,-22.5,-26.5]:
        cut(wall,'nave window',side*6.28,2.45,z,1.85,4.95,True)
        window('Nave lancet',side*6.29,2.45,z,1.85,4.95,True)
    # Kollisionssegmente besitzen dieselben Öffnungen nur oberhalb der Spielerhöhe.
    colliders.append({'id':'nave-side-'+str(side),'center':[side*6.28,4.5,-18.5],'halfSize':[.22,4.5,11.5]})
    for z in [-8.1,-12.5,-16.5,-20.5,-24.5,-28.9]:
        box('Buttress',side*6.65,3.6,z,.8,7.2,.75,stone,bevel=.025,solid=True)
        box('Buttress cap',side*6.65,7.3,z,.94,.22,.9,trim,bevel=.03)
        beam('Oak cornice',(side*6.42,8.85,-30),(side*6.42,8.85,-7),.22)
    tw=box('Tower wall '+str(side),side*3.28,8.25+TOWER_RISE/2,-3.5,.44,16.5+TOWER_RISE,7,stone,solid=True)
    cut(tw,'tower slit',side*3.28,7.1,-3.6,1.0,3.2,True)
    window('Tower slit',side*3.29,7.1,-3.6,1.0,3.2,True)
    cut(tw,'upper tower slit',side*3.28,15.4,-3.6,1.2,3.8,True)
    window('Upper tower slit',side*3.29,15.4,-3.6,1.2,3.8,True)
    for z in [-6.75,-.35]: box('Tower corner pier',side*3.31,7.9+TOWER_RISE/2,z,.62,15.8+TOWER_RISE,.62,trim,bevel=.025)

print('CHURCH side walls ready', flush=True)
box('Tower rear upper wall',0,(9+16.5+TOWER_RISE)/2,-6.78,6.6,7.5+TOWER_RISE,.44,stone,solid=True)
rear=box('Sanctuary rear wall',0,4.5,-29.78,12.6,9,.44,stone,solid=True)
cut(rear,'altar window',0,3.4,-29.78,3.6,5.0)
window('Sanctuary great window',0,3.4,-29.8,3.6,5.0)
front=box('Nave front wall',0,4.5,-7.2,12.6,9,.44,stone)
cut(front,'tower passage',0,0,-7.2,2.9,5.4)
for side in [-1,1]: colliders.append({'id':'nave-front-'+str(side),'center':[side*3.875,4.5,-7.2],'halfSize':[2.425,4.5,.22]})
colliders.append({'id':'nave-front-lintel','center':[0,7.2,-7.2],'halfSize':[1.45,1.8,.22]})
facade=box('Tower entrance wall',0,8.25+TOWER_RISE/2,-.22,6.6,16.5+TOWER_RISE,.44,stone)
cut(facade,'entrance',0,0,-.22,2.7,4.2)
window('Tower entrance upper window',0,8.7,.03,2.0,4.6)
cut(facade,'entrance upper window',0,8.7,-.22,2.0,4.6)
cut(facade,'upper front tower slit',0,15.4,-.22,1.4,3.8)
window('Upper front tower slit',0,15.4,.03,1.4,3.8)
for side in [-1,1]: colliders.append({'id':'entrance-pier-'+str(side),'center':[side*2.325,8.25+TOWER_RISE/2,-.22],'halfSize':[.975,8.25+TOWER_RISE/2,.22]})
colliders.append({'id':'entrance-lintel','center':[0,10.35+TOWER_RISE/2,-.22],'halfSize':[1.35,6.15+TOWER_RISE/2,.22]})
for w,h,depth in [(3.28,4.8,.3),(3.0,4.5,.26),(2.78,4.28,.22)]:
    place(ring('Carved entrance arch',arch(w,h),.94,depth,trim),0,-.02,.05)

# Zwei getrennte, standardmäßig geöffnete Türflügel mit benannten Scharnieren.
print('CHURCH facades ready', flush=True)
for side in [-1,1]:
    pivot=bpy.data.objects.new('DoorHinge'+('Left' if side<0 else 'Right'),None)
    bpy.context.collection.objects.link(pivot); pivot.location=xyz(side*1.33,0,.03)
    leaf=box('Door leaf '+str(side),side*.66,1.35,.03,1.3,2.7,.14,wood,bevel=.02)
    bpy.context.view_layer.update()
    leaf.parent=pivot; leaf.matrix_parent_inverse=pivot.matrix_world.inverted()
    bpy.context.view_layer.update()
    # Dreht die Tür aus dem Durchgang nach außen.
    pivot.rotation_euler.z=side*math.radians(85)
    doors.append({'node':pivot.name,'axis':[0,1,0],'closedAngle':0,'openAngle':side*math.radians(85),'defaultOpen':True})

for z in [-30.0,-7.0]:
    mesh('Nave gable',[(-6.5,8.8,z),(6.5,8.8,z),(0,15.2,z),(-6.5,8.8,z+.24),(6.5,8.8,z+.24),(0,15.2,z+.24)],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],wood)
roof('Main steep slate roof',14.1,-30.65,-6.5,8.8,15.4)
for z in [-30.7,-6.5]: cross('Gable cross',0,15.45,z,.85)
for z in np.arange(-30,-7,.8):
    box('Ridge ornament',0,15.58,float(z),.11,.25,.11,iron)

# Leicht geschwungener schlanker Turmhelm nach der Holmenkollen-Silhouette.
box('Belfry lower belt',0,16.55+TOWER_RISE,-3.5,7.35,.35,7.35,wood)
box('Belfry upper belt',0,18.65+TOWER_RISE,-3.5,7.6,.28,7.6,wood)
for x in [-3.25,3.25]:
    for z in [-6.75,-.25]: box('Belfry oak post',x,17.6+TOWER_RISE,z,.32,2.1,.32,wood)
for side in [-1,1]:
    for offset in [-2.2,0,2.2]:
        for y in np.arange(16.85,18.4,.22):
            box('Belfry louvre',side*3.3,float(y)+TOWER_RISE,-3.5+offset,.12,.10,1.9,wood)
            box('Belfry louvre',offset,float(y)+TOWER_RISE,-3.5+side*3.3,1.9,.10,.12,wood)
levels=[(y+TOWER_RISE,r) for y,r in [(18.8,4.2),(19.2,3.65),(20.2,2.75),(22.0,1.95),(25.0,.95),(28.2,.06)]]
v=[(sx*r,y,-3.5+sz*r) for y,r in levels for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]]
f=[]
for i in range(len(levels)-1):
    for j in range(4): f.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
mesh('Curved square slate spire',v,f,slate)
for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]:
    for (y0,r0),(y1,r1) in zip(levels,levels[1:]): beam('Spire corner seam',(sx*r0,y0,-3.5+sz*r0),(sx*r1,y1,-3.5+sz*r1),.07,iron)
cross('Spire cross',0,28.2+TOWER_RISE,-3.5,.7)

# Zwei unterschiedlich große Anbauten, vorerst geschlossene grobe Baukörper.
def annex(name,x,z,w,d,h,ridge):
    box(name+' foundation',x,-.75,z,w+.25,1.3,d+.25,stone)
    box(name+' volume',x,h/2,z,w,h,d,stone,solid=True)
    for end in [-1,1]:
        zz=z+end*d/2
        place(prism(name+' gable',[(-w/2,h),(w/2,h),(0,ridge)],.2,wood),x,0,zz)
    existing=set(bpy.context.scene.objects)
    roof(name+' roof',w+.7,z-d/2-.4,z+d/2+.4,h,ridge)
    for o in set(bpy.context.scene.objects)-existing: o.location.x+=x
    # Fenster nur als einfache äußere Andeutungen; kein fertiger Anbau-Innenraum.
    window(name+' front window',x,1.2,z+d/2+.06,1.3,2.6)

annex('East side chapel',8.35,-16.5,4.5,15.0,4.4,6.9)
annex('West sacristy',-8.5,-25.0,4.8,8.5,3.8,6.1)

# Begehbarer Innenraum: hoher Spitzbogenhimmel, Rippen, Bänke, Altar.
vault=[(float(x),13.2-.65*abs(float(x))-.03*float(x)**2) for x in np.linspace(-6,6,49)]
for a,b in zip(vault,vault[1:]):
    mesh('Painted vault',[(a[0],a[1],-29.5),(b[0],b[1],-29.5),(b[0],b[1],-7.5),(a[0],a[1],-7.5)],[(0,1,2,3)],ceiling)
for z in [-28.9,-24.5,-20.5,-16.5,-12.5,-8.1]:
    for a,b in zip(vault,vault[1:]): beam('Gothic vault rib',(a[0],a[1]-.06,z),(b[0],b[1]-.06,z),.12,trim)
    for side in [-1,1]: box('Interior slender pilaster',side*5.93,3.8,z,.18,7.6,.2,trim)
for z in [-11,-13.2,-15.4,-17.6,-19.8,-22.0]:
    for side in [-1,1]:
        x=side*3.25
        box('Oak pew seat',x,.48,z,3.7,.14,.65,wood,bevel=.025)
        box('Oak pew back',x,.9,z+.27,3.7,.85,.12,wood,bevel=.025,solid=True)
        for end in [-1,1]: box('Pew end',x+end*1.8,.55,z,.14,1.1,.7,wood,bevel=.02)
box('Altar table',0,1.1,-27,3.3,.2,1.3,trim,bevel=.04,solid=True)
for x in [-1.25,1.25]: box('Altar support',x,.48,-27,.32,.95,1.0,stone)
cross('Altar crucifix',0,1.25,-27.35,1.3)
for x in [-1.3,1.3]:
    box('Candlestick',x,1.35,-27,.13,.4,.13,brass)
    box('Candle',x,1.68,-27,.1,.35,.1,white)
box('Aisle runner',0,.015,-17.5,1.9,.025,17,material('Faded burgundy runner',(.22,.06,.075),rough=.94))
for x in [-3.4,3.4]:
    for z in [-13,-21]:
        beam('Pendant chain',(x,7.1,z),(x,5.5,z),.035,iron)
        box('Lantern frame',x,5.3,z,.35,.55,.35,iron)
        box('Lantern amber pane',x,5.3,z,.30,.46,.30,material('Lantern amber',(.8,.38,.10),emission=1.4))

# Echte Glocke, unabhängiger Interaktionsanker; noch keine Turmtreppe.
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.64,radius2=.32,depth=.75,location=xyz(0,17.2+TOWER_RISE,-3.5))
bell=bpy.context.object; bell.name='Bell'; bell.data.materials.append(brass)
beam('Bell yoke',(-1,17.7+TOWER_RISE,-3.5),(1,17.7+TOWER_RISE,-3.5),.18,wood)
for name,point in [('Entrance',(0,0,.2)),('SanctuarySeal',(0,.4,-25.6)),('BellInteract',(0,1.1,-2)),('BellMount',(0,17.7+TOWER_RISE,-3.5))]:
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=xyz(*point); o.empty_display_size=.35

# UVs und wenige statische Materialgruppen statt hunderter Draw Calls.
print('CHURCH geometry ready',len(bpy.context.scene.objects), flush=True)
for o in list(bpy.context.scene.objects):
    if o.type!='MESH': continue
    if not o.data.uv_layers:
        uv=o.data.uv_layers.new(name='Metre projection')
        for face in o.data.polygons:
            normal=face.normal; axis=max(range(3),key=lambda i:abs(normal[i]))
            axes=[i for i in range(3) if i!=axis]
            for loop_index in face.loop_indices:
                point=o.data.vertices[o.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv=(point[axes[0]]/3,point[axes[1]]/3)
    for p in o.data.polygons: p.use_smooth=False

groups={}
print('CHURCH UV ready', flush=True)
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and not o.parent and o.name!='Bell': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in groups.items():
    if len(objects)==1:
        objects[0].name='Church '+name
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); bpy.context.object.name='Church '+name

root=bpy.data.objects.new('NachtjagdChurch',None); bpy.context.collection.objects.link(root)
for o in list(bpy.context.scene.objects):
    if o!=root and not o.parent: o.parent=root
root['units']='metres'; root['front']='+Z in glTF'; root['pivot']='entrance threshold'; root['assetVersion']='1.1.0'

model_objects=[o for o in bpy.context.scene.objects]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'church.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)

for o in model_objects:
    if o.type=='MESH': o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in model_objects if o.type=='MESH')
bpy.context.view_layer.update()
corners=[o.matrix_world @ Vector(p) for o in model_objects if o.type=='MESH' for p in o.bound_box]
bounds={axis:[round(min(values),3),round(max(values),3)] for axis,values in [('x',[v.x for v in corners]),('y',[v.z for v in corners]),('z',[-v.y for v in corners])]}
contract={
    'asset':'NachtjagdChurch','version':'1.1.0','units':'metres','upAxis':'Y','frontAxis':'+Z',
    'pivot':'entrance threshold at local [0,0,0]',
    'suggestedPlacement':{'x':91,'z':24.5,'rotationY':0,'y':'height of the church approach at (91,25); sample once, do not fit each wall separately'},
    'bounds':bounds,
    'anchors':{'entrance':[0,0,.2],'seal':[0,.4,-25.6],'bellInteract':[0,1.1,-2],'bellMount':[0,17.7+TOWER_RISE,-3.5]},
    'doorClearWidth':2.7,'doorClearHeightAtCenter':4.2,'centerAisleWidth':2.8,
    'colliderFile':'church-collision.json','doors':doors,
    'limitations':['Side buildings are closed blockout volumes without accessible interiors','Bell tower has no walkable staircase in this asset version','Terrain requires one common floor pad; cut or lower terrain below nave','Door leaves are open by default; closed doors need dynamic collision'],
    'estimatedTriangles':triangles
}
(OUT/'church-manifest.json').write_text(json.dumps(contract,indent=2),encoding='utf8')
(OUT/'church-collision.json').write_text(json.dumps({'version':1,'units':'metres','space':'church local glTF coordinates','boxes':colliders,'floors':floors,'playerRadiusRecommended':.4},indent=2),encoding='utf8')

# Nur in der Blender-Datei: neutrale Bühne und Kameras für überprüfbare Ansichten.
stage=box('Preview ground',0,-1.48,-13,140,.1,140,material('Preview ground',(.115,.14,.14)))
world=bpy.context.scene.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.46,.52,1); world.node_tree.nodes['Background'].inputs[1].default_value=.45
def area(name,point,power,size,color):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.location=xyz(*point)
    direction=Vector(xyz(0,9,-14))-o.location; o.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
area('Soft daylight',(-20,35,18),4200,22,(1,.86,.70)); area('Cool fill',(25,20,-23),3000,18,(.64,.79,1))
bpy.ops.object.light_add(type='SUN',location=(0,0,20)); bpy.context.object.rotation_euler=(.5,-.4,-.5); bpy.context.object.data.energy=2.0
for x in [-3.4,3.4]:
    for z in [-13,-21]:
        bpy.ops.object.light_add(type='POINT',location=xyz(x,5.1,z)); bpy.context.object.data.energy=180; bpy.context.object.data.color=(1,.52,.20); bpy.context.object.data.shadow_soft_size=.6
def camera(name,eye,target,lens=42):
    d=bpy.data.cameras.new(name); d.lens=lens
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.location=xyz(*eye)
    o.rotation_euler=(Vector(xyz(*target))-o.location).to_track_quat('-Z','Y').to_euler(); return o
exterior=camera('Exterior camera',(42,29,51),(0,17,-13),40)
interior=camera('Interior camera',(0,2.1,-5),(0,6,-27),18)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.cycles.use_denoising=True; scene.render.resolution_x=1400; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
quick='--quick' in sys.argv
if quick:
    scene.cycles.samples=8
    scene.render.resolution_percentage=70
    bpy.context.preferences.filepaths.save_version=0
scene.view_settings.view_transform='AgX'; scene.camera=exterior
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'church.blend'))
scene.render.filepath=str(OUT/'church-exterior.png'); bpy.ops.render.render(write_still=True)
if not quick:
    scene.camera=interior; scene.render.filepath=str(OUT/'church-interior.png'); bpy.ops.render.render(write_still=True)
print('CHURCH_EXPORT',json.dumps({'glbBytes':(OUT/'church.glb').stat().st_size,'triangles':triangles,'meshes':sum(o.type=='MESH' for o in model_objects)}))
