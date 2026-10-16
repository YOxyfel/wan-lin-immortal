import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const clamp=x=>Math.max(0,Math.min(1,x)),mix=T.MathUtils.lerp;
export const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
export function surfaceTexture(kind,size=768){
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n=noise(x,y),soft=Math.sin(u*17+Math.sin(v*13)*2)*Math.sin(v*23+Math.cos(u*11));let c;
  if(kind==='wood'){const g=Math.sin(u*130+Math.sin(v*19)*1.7)+Math.sin(u*385+v*9)*.3,s=1;c=[(76+g*9+n*7+soft*4)*s,(52+g*6+n*5+soft*3)*s,(34+g*4+n*4)*s]}
  else if(kind==='roof'){const r=Math.floor(v*3),xx=(u*4+r%2*.5)%1,yy=v*3%1,g=Math.cos(xx*Math.PI*2)*9;c=xx<.035||yy<.06?[24,30,29]:[58+g+n*8,69+g+n*8,65+g+n*8]}
  else if(kind==='stone'){const r=Math.floor(v*5),xx=(u*5+r%2*.5)%1,yy=v*5%1;c=xx<.025||yy<.035?[68,66,59]:[134+n*27,133+n*25,117+n*23]}
  else if(kind==='earth'){c=[139+soft*9+n*9,125+soft*7+n*7,96+soft*6+n*7]}
  else if(kind==='grass'){c=[93+soft*11+n*7,112+soft*12+n*8,73+soft*8+n*5]}
  else if(kind==='cloth'){const w=x%3===0||y%3===0?-8:4;c=[63+w+n*8,70+w+n*8,62+w+n*8]}
  else {const m=soft*3+Math.sin(u*41+v*17)*1.3;c=[217+m+n*3,204+m+n*3,174+m+n*3]}
  const i=(y*size+x)*4;data.set([...c,255],i);
 }
 const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.name=kind;return t;
}
// Physical dimensions determine each face's UVs; textures never stretch to fit.
export function boxUV(w,h,d){const g=new T.BoxGeometry(w,h,d),uv=g.attributes.uv;for(let f=0;f<6;f++){const a=f<2?d:w,b=f<2?h:f<4?d:h;for(let j=0;j<4;j++){const i=f*4+j;uv.setXY(i,uv.getX(i)*a,uv.getY(i)*b)}}return g}
export function createVillage(){
 const scene=new T.Scene();scene.fog=new T.FogExp2(0xb9d4d5,.009);const camera=new T.PerspectiveCamera(48,16/9,.08,250),surfaces={};
 for(const name of ['wood','roof','stone','plaster','cloth','earth','grass']){const map=surfaceTexture(name);surfaces[name]=new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:name==='plaster'?.005:name==='roof'?.025:.016,roughness:.92});surfaces[name].name=name}
 surfaces.grass.map.repeat.set(.12,.12);surfaces.earth.map.repeat.set(.25,.25);
 const solid=c=>new T.MeshStandardMaterial({color:c,roughness:1}),earth=surfaces.earth,grass=surfaces.grass,leaf=solid(0x668253),dark=solid(0x282a23),gold=solid(0x9f7950);
 const architecture=new T.Group();scene.add(architecture);
 function mesh(g,m,parent=architecture){const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 function box(w,h,d,x,y,z,mat=surfaces.wood,parent=architecture){const geometry=boxUV(w,h,d);if(mat===surfaces.wood){const uv=geometry.attributes.uv;for(let f=0;f<6;f++){const i=f*4;if(Math.abs(uv.getX(i)-uv.getX(i+1))>Math.abs(uv.getY(i)-uv.getY(i+2)))for(let j=0;j<4;j++){const a=uv.getX(i+j),b=uv.getY(i+j);uv.setXY(i+j,b,a)}}}const o=mesh(geometry,mat,parent);o.position.set(x,y,z);return o}
 function cyl(a,b,h,x,y,z,mat,parent=architecture){const g=new T.CylinderGeometry(a,b,h,12),uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.9)uv.setXY(i,p.getX(i),p.getZ(i));else uv.setXY(i,uv.getX(i)*Math.PI*(a+b),uv.getY(i)*h)}const o=mesh(g,mat,parent);o.position.set(x,y,z);return o}
 box(150,.18,160,0,-.13,-25,grass);box(6,.12,74,0,-.035,-17,earth);
 for(let i=0;i<92;i++){const o=box(.4+noise(i,3)*.65,.055,.35+noise(i,4)*.5,(noise(i,2)-.5)*4.8,.015,12-i*.63,surfaces.stone);o.rotation.y=noise(i,5)*.3}
 function roof(parent,w,d,base){
  for(const s of [-1,1]){const rows=18,cols=8,pos=[],uv=[],idx=[];let arc=0,prev;
   for(let j=0;j<=rows;j++){const t=j/rows,x=s*w*.5*t,y=base+1.45*(1-t)**1.45+.28*t**8;if(prev)arc+=Math.hypot(x-prev[0],y-prev[1]);prev=[x,y];for(let k=0;k<=cols;k++){const z=(k/cols-.5)*d;pos.push(x,y,z);uv.push(z,arc)}}
   for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=j*(cols+1)+k,b=a+cols+1;if(s===1)idx.push(a,b,a+1,b,b+1,a+1);else idx.push(a,a+1,b,b,a+1,b+1)}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=surfaces.roof.clone();m.side=T.DoubleSide;mesh(g,m,parent);
   box(.14,.13,d,s*w*.5,base+.20,0,surfaces.wood,parent);
   // Rafters follow the roof profile and remain inside its eaves.
   for(let k=0;k<7;k++)for(let j=0;j<12;j++){const t0=j/12,t1=(j+1)/12,x0=s*w*.5*t0,x1=s*w*.5*t1,y0=base+1.45*(1-t0)**1.45+.28*t0**8-.16,y1=base+1.45*(1-t1)**1.45+.28*t1**8-.16;const r=box(Math.hypot(x1-x0,y1-y0)+.015,.085,.075,(x0+x1)/2,(y0+y1)/2,(k/6-.5)*(d-.28),surfaces.wood,parent);r.rotation.z=Math.atan2(y1-y0,x1-x0)}
  }cyl(.12,.12,d,0,base+1.48,0,surfaces.roof,parent).rotation.x=Math.PI/2;
 }
 const houses=[];
 function house(x,z,yaw,w=5,d=5.5,home=false){
  const g=new T.Group();architecture.add(g);g.position.set(x,0,z);g.rotation.y=yaw;g.name=home?'Home':'House';houses.push(g);
  box(w,2.65,d,0,1.325,0,surfaces.plaster,g);box(w+.18,.25,d+.18,0,.14,0,surfaces.stone,g);
  for(const xx of [-w*.5,w*.5])for(const zz of [-d*.5,d*.5])box(.18,2.85,.18,xx,1.43,zz,surfaces.wood,g);
  for(const y of [.58,2.55])for(const zz of [-d*.5-.02,d*.5+.02])box(w,.12,.12,0,y,zz,surfaces.wood,g);
  box(1.05,1.9,.14,0,.98,d*.5+.085,surfaces.wood,g);box(1.32,.10,.3,0,1.99,d*.5+.13,gold,g);
  for(const xx of [-w*.3,w*.3]){box(.95,.92,.08,xx,1.49,d*.5+.08,dark,g);for(let j=0;j<5;j++)box(.035,.92,.08,xx-.44+j*.22,1.49,d*.5+.14,gold,g);for(const y of [1.15,1.5,1.84])box(.95,.035,.08,xx,y,d*.5+.14,gold,g)}
  for(let i=0;i<3;i++)box(1.75,.12,.43,0,.06+i*.12,d*.5+.7-i*.25,surfaces.stone,g);roof(g,w+1.25,d+1.3,2.72);
  for(const zface of [-d*.5,d*.5]){const pos=[],uv=[],ix=[];for(let j=0;j<=24;j++){const xx=-w*.5+j/24*w,tt=Math.abs(xx)/(w+1.25)*2,yy=2.72+1.45*(1-tt)**1.45+.28*tt**8-.12;pos.push(xx,2.65,zface,xx,yy,zface);uv.push(xx,2.65,xx,yy);if(j<24){const a=j*2;ix.push(a,a+1,a+2,a+1,a+3,a+2)}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();const mat=surfaces.plaster.clone();mat.side=T.DoubleSide;mesh(geo,mat,g)}
  if(home){box(.6,.58,.12,-1.2,2.05,d*.5+.1,solid(0x983c29),g);cyl(.19,.19,.65,1.3,2.15,d*.5+.5,solid(0xc87543),g)}return g;
 }
 house(-7,-10,0,5.5,5.2,true);house(7,0,-Math.PI/2,5,6);house(-7,2,Math.PI/2,5.2,5);house(7,-11,-Math.PI/2,5.4,5.8);house(-7,-23,Math.PI/2,5,6);house(7,-25,-Math.PI/2,5.4,6);house(-12,11,Math.PI/8,6,5);house(14,9,-Math.PI/6,6,6);
 const well=new T.Group();well.position.set(3.3,0,-6);architecture.add(well);well.name='Well';cyl(.85,.96,.78,0,.4,0,surfaces.stone,well);cyl(.61,.61,.06,0,.77,0,dark,well);for(const x of [-.95,.95])box(.14,2.4,.14,x,1.2,0,surfaces.wood,well);box(2.1,.15,.15,0,2.3,0,surfaces.wood,well);roof(well,2.7,1.9,2.4);cyl(.025,.025,1.55,0,1.54,0,gold,well);
 for(let i=0;i<13;i++){const s=i%2?1:-1,x=s*(3.8+noise(i,3)),z=8-i*2.6;cyl(.27,.32,.72,x,.36,z,surfaces.wood);box(.74,.64,.66,x+s*.65,.32,z+.5,surfaces.wood).rotation.y=noise(i,5)}
 function tree(x,z,h){cyl(.18,.44,h,x,h*.5,z,surfaces.wood);for(let j=0;j<9;j++){const o=mesh(new T.IcosahedronGeometry(h*(.16+noise(j,7)*.08),2),leaf);o.position.set(x+Math.sin(j*2)*h*.14,h*.58+j*h*.043,z+Math.cos(j*2)*h*.14);o.scale.set(1,.76,1.1)}}
 for(let i=0;i<34;i++)tree((i%2?1:-1)*(15+noise(i,4)*30),19-noise(i,6)*94,4+noise(i,7)*5);for(let i=0;i<18;i++)tree((i%2?1:-1)*(4+noise(i,9)*9),-37-i*1.8,5+noise(i,8)*3);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,o=mesh(new T.IcosahedronGeometry(19+noise(i,12)*13,3),new T.MeshStandardMaterial({map:surfaces.earth.map,color:0x9aafa6,roughness:1}));o.scale.set(1,.9+noise(i,14)*1.5,.7);o.position.set(Math.sin(a)*94,-1,Math.cos(a)*94-20)}
 const sky=new T.Mesh(new T.SphereGeometry(190,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{burn:{value:0}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform float burn;void main(){float h=clamp(normalize(p).y*.8+.2,0.,1.);vec3 day=mix(vec3(.82,.89,.84),vec3(.18,.47,.64),h);vec3 night=mix(vec3(.16,.035,.025),vec3(.015,.014,.021),h);gl_FragColor=vec4(mix(day,night,burn),1.);}'}));scene.add(sky);
 const cloudMat=new T.MeshStandardMaterial({color:0xf3eedf,roughness:1}),clouds=new T.Group();scene.add(clouds);for(let i=0;i<3;i++){const c=new T.Group();clouds.add(c);c.position.set(-20+i*35,34+i*4,-60-i*18);for(let j=0;j<7;j++){const o=mesh(new T.SphereGeometry(3.4,12,8),cloudMat,c);o.position.set(j*3-9,Math.sin(j)*1.3,Math.cos(j)*2);o.scale.set(1.2,.5,.9);o.castShadow=false}}
 const fill=new T.HemisphereLight(0xd7e9ed,0x706a43,2.4),sun=new T.DirectionalLight(0xffe5af,3.1),moon=new T.DirectionalLight(0x909bbd,.1);scene.add(fill,sun,sun.target,moon);sun.position.set(-22,35,18);sun.target.position.set(0,0,-15);moon.position.set(20,24,-45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-27,right:27,top:30,bottom:-30,far:110});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;
 const fires=[],fireLights=[],smoke=[];const flameMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},power:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float time;uniform float power;void main(){float y=v.y;float sway=sin(y*12.-time*5.)*.10*y+sin(y*23.+time*3.)*.04;float w=max(.001,(1.-y)*.42);float e=1.-smoothstep(w*.5,w,abs(v.x-.5+sway));float a=e*smoothstep(0.,.07,y)*(1.-smoothstep(.65,1.,y))*(.72+.28*sin(y*25.-time*8.+v.x*17.))*power;vec3 c=mix(vec3(1.,.12,.005),vec3(1.,.87,.22),pow(1.-y,3.));gl_FragColor=vec4(c*2.5,a);}'});
 const smokeMat=new T.MeshStandardMaterial({color:0x222129,transparent:true,opacity:0,depthWrite:false,roughness:1});
 houses.forEach((h,i)=>{const lamp=new T.PointLight(0xff4b0b,0,13,2);lamp.position.copy(h.position).add(new T.Vector3(0,2,2));scene.add(lamp);fireLights.push(lamp);for(let j=0;j<4;j++){const f=new T.Mesh(new T.PlaneGeometry(1,1),flameMat);f.name='Flame';f.position.copy(h.position).add(new T.Vector3((j-1.5)*1.35,j%2?2.9:.3,j%2?0:2));f.scale.set(2.4,3.2+noise(i,j)*2.8,1);f.position.y+=f.scale.y*.5;scene.add(f);fires.push(f);const s=mesh(new T.IcosahedronGeometry(1.5,1),smokeMat,scene);s.name='Smoke';s.castShadow=false;s.userData.base=h.position.clone().add(new T.Vector3(0,5+j*1.7,0));s.userData.phase=j*.3+i;smoke.push(s)}});
 const creatures=[];for(let i=0;i<4;i++){const g=new T.Group();g.position.set((i%2?1:-1)*(2.1+i*.25),0,-10-i*3.5);architecture.add(g);const b=mesh(new T.IcosahedronGeometry(.7,2),dark,g);b.position.y=1;b.scale.set(.65,.8,1.2);const h=mesh(new T.IcosahedronGeometry(.32,2),dark,g);h.position.set(0,1.55,.6);for(const s of [-1,1]){const horn=mesh(new T.ConeGeometry(.10,.5,7),dark,g);horn.position.set(s*.19,1.96,.63);horn.rotation.z=s*-.35;for(const z of [-.4,.45])box(.16,.82,.17,s*.38,.47,z,dark,g).rotation.z=s*.22;const eye=mesh(new T.SphereGeometry(.04,8,6),new T.MeshBasicMaterial({color:0xff1900}),g);eye.position.set(s*.18,1.62,.86)}creatures.push(g)}
 const metrics={ready:false,geometry:'real 3D village',uv:'metres per repeat; curved roof UVs follow arc length',landmarks:{home:[-7,0,-10],well:[3.3,0,-6],forest:[0,0,-37]}},goal=new T.Vector3(),position=new T.Vector3(),homeRoute=new T.CatmullRomCurve3([new T.Vector3(0,1.63,-35),new T.Vector3(0,1.63,-20),new T.Vector3(0,1.63,-4.5),new T.Vector3(-3,1.6,-4.8),new T.Vector3(-7,1.58,-6.5)]);let character=null,introStart=0,prevDistance=0;
 function setCharacter(c){character=c;scene.add(c.group);metrics.ready=true}
 function update(p,time,aspect=16/9){
  const distance=ease(.024,.17,p)*44,z=9-distance;const establish=Math.max(ease(0,4,(time-introStart)/1000),ease(0,.024,p)),orbit=ease(.125,.187,p),pov=ease(.174,.198,p),turn=ease(.214,.255,p),rush=ease(.297,.36,p),burn=ease(.215,.246,p);
  if(character){character.group.position.set(0,0,z);character.pose(distance,Math.abs(distance-prevDistance),time);character.group.visible=pov<.97;prevDistance=distance}
  const a=mix(-Math.PI*.5,0,orbit),r=mix(3.4,1.2,orbit)*(1-pov);position.set(Math.sin(a)*r,mix(2.1,1.63,pov),z+Math.cos(a)*r+1*(1-pov));goal.set(0,1.18,z-.2);
  if(p<.024){position.lerpVectors(new T.Vector3(15,24,18),new T.Vector3(-3.4,2.1,10),establish);goal.lerpVectors(new T.Vector3(-8,27,-75),new T.Vector3(0,1.18,8.8),establish)}
  if(pov>0){const yaw=turn*Math.PI;goal.lerp(new T.Vector3(position.x+Math.sin(yaw)*8,1.54,position.z-Math.cos(yaw)*8),pov)}
  if(p>.282){goal.lerp(new T.Vector3(-7,1.4,-7.2),ease(.282,.3,p));position.copy(homeRoute.getPoint(rush));goal.lerp(new T.Vector3(-7,1.35,-8.2),rush)}
  position.y+=Math.sin(time*.005)*.012*ease(.192,.207,p)*(1-ease(.212,.218,p));const shake=ease(.209,.215,p)*(1-ease(.22,.232,p));position.x+=Math.sin(time*.061)*.028*shake;position.y+=Math.sin(time*.073)*.018*shake;
  camera.position.copy(position);camera.aspect=aspect;camera.fov=aspect<.8?59:48;camera.lookAt(goal);camera.updateProjectionMatrix();
  sky.material.uniforms.burn.value=burn;fill.intensity=mix(2.4,.22,burn);sun.intensity=mix(3.1,.12,burn);moon.intensity=mix(.1,.65,burn);sun.color.set(burn>.5?0xb66648:0xffe5af);scene.fog.color.set(0xb9d4d5).lerp(new T.Color(0x261b1d),burn);scene.fog.density=mix(.009,.019,burn);cloudMat.color.set(0xf3eedf).lerp(new T.Color(0x45383a),burn);
  for(const m of Object.values(surfaces))m.color.set(0xffffff).lerp(new T.Color(0x57545b),burn*.7);flameMat.uniforms.time.value=time/1000;flameMat.uniforms.power.value=burn;fires.forEach(f=>{f.visible=burn>.001;f.quaternion.copy(camera.quaternion)});fireLights.forEach((l,i)=>l.intensity=burn*(24+Math.sin(time*.009+i*2)*6));smokeMat.opacity=burn*.5;smoke.forEach((s,i)=>{s.visible=burn>.001;const t=(time*.00016+s.userData.phase)%1;s.position.copy(s.userData.base).add(new T.Vector3(t*2,t*5,Math.sin(i)*t));s.scale.setScalar(.65+t*1.1)});creatures.forEach((g,i)=>{g.visible=burn>.6;g.position.z=-10-i*3.5+Math.sin(time*.0008+i)*.25});clouds.position.x=Math.sin(time*.000025)*2;
  Object.assign(metrics,{camera:camera.position.toArray(),lookAt:goal.toArray(),character:[0,0,z],distance,yaw:turn*Math.PI,fire:burn,phase:p<.024?'establish':p<.125?'walk':p<.198?'shoulder to first person':p<.214?'stop':p<.282?'look back':p<.38?'return home':'uncle'});
 }
 // Batch static surfaces without changing their UVs or world coordinates.
 // The character, creatures, smoke, clouds, and flames retain independent motion.
 architecture.updateMatrixWorld(true);const bins=new Map(),old=[];
 architecture.traverse(o=>{if(!o.isMesh)return;for(let a=o.parent;a;a=a.parent)if(creatures.includes(a))return;const key=o.material.uuid;if(!bins.has(key))bins.set(key,{material:o.material,geometries:[]});const g=o.geometry.clone().applyMatrix4(o.matrixWorld);bins.get(key).geometries.push(g.index?g.toNonIndexed():g);old.push(o)});
 for(const o of old)o.removeFromParent();
 for(const b of bins.values()){const merged=mergeGeometries(b.geometries);if(merged){const o=mesh(merged,b.material,scene);o.name='BatchedVillageSurface'}}
 metrics.staticDrawCalls=bins.size;
 return {scene,camera,surfaces,setCharacter,update,reset:time=>{introStart=time;prevDistance=0},metrics};
}
export function createCharacter(source){
 const group=new T.Group();group.name='WuhenWebRig';const bones=[],rest=[];function bone(name,parent,x,y,z){const b=new T.Bone();b.name=name;b.position.set(x,y,z);(parent||group).add(b);bones.push(b);return b}
 const hips=bone('hips',null,0,.89,0),spine=bone('spine',hips,0,.24,0),chest=bone('chest',spine,0,.23,0),neck=bone('neck',chest,0,.15,0),head=bone('head',neck,0,.12,0),limbs=[];
 for(const side of [-1,1]){const thigh=bone('thigh'+side,hips,side*.145,-.02,0),shin=bone('shin'+side,thigh,0,-.40,0),foot=bone('foot'+side,shin,0,-.37,0),arm=bone('arm'+side,chest,side*.23,.015,0),forearm=bone('forearm'+side,arm,side*.29,0,0),hand=bone('hand'+side,forearm,side*.16,0,0);limbs.push({side,thigh,shin,foot,arm,forearm,hand})}
 group.updateMatrixWorld(true);bones.forEach(b=>rest.push(b.getWorldPosition(new T.Vector3())));const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 const cloth=surfaceTexture('cloth',256),mats={skin:new T.MeshStandardMaterial({color:0xb99d7b,roughness:.85}),robe:new T.MeshStandardMaterial({color:0x839382,map:cloth,roughness:1}),coat:new T.MeshStandardMaterial({color:0x525847,map:cloth,roughness:1}),shoe:new T.MeshStandardMaterial({color:0x31261e,roughness:1})};source.updateMatrixWorld(true);
 source.traverse(o=>{if(!o.isMesh)return;const meshName=o.name.toLowerCase();if(meshName.includes('body'))return;const clothPart=meshName.includes('clothing');const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);const p=g.attributes.position,ids=[],weights=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),l=limbs.find(a=>a.side===(x<0?-1:1));let c;if(y>1.47&&Math.abs(x)<.25)c=[neck,head];else if(y>(clothPart?.98:1.23)&&Math.abs(x)>.29)c=[l.arm,l.forearm,l.hand];else if(y<.88)c=clothPart?[hips]:[hips,l.thigh,l.shin,l.foot];else c=[hips,spine,chest];const v=new T.Vector3(x,y,p.getZ(i)),r=c.map(b=>({id:bones.indexOf(b),d:v.distanceTo(rest[bones.indexOf(b)])})).sort((a,b)=>a.d-b.d).slice(0,2),a=r[0],b=r[1]||a,wa=1/(a.d+.04)**4,wb=1/(b.d+.04)**4;ids.push(a.id,b.id,0,0);weights.push(wa/(wa+wb),wb/(wa+wb),0,0)}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));const n=o.name.toLowerCase(),m=n.includes('head')||n.includes('hand')||n.includes('body')?mats.skin:n.includes('shoe')?mats.shoe:n.includes('bottom')?mats.coat:mats.robe;const sk=new T.SkinnedMesh(g,m);sk.name=o.name;sk.castShadow=sk.receiveShadow=true;group.add(sk);sk.bind(skeleton,new T.Matrix4());sk.frustumCulled=false});
 const hairMat=new T.MeshStandardMaterial({color:0x252620,roughness:.8}),cap=new T.Mesh(new T.SphereGeometry(.122,16,12,0,Math.PI*2,0,Math.PI*.62),hairMat);cap.position.set(0,.058,0);cap.scale.set(1,1.15,.95);head.add(cap);const bun=new T.Mesh(new T.SphereGeometry(.075,12,10),hairMat);bun.position.set(0,.10,.13);head.add(bun);const tail=new T.Mesh(new T.CapsuleGeometry(.035,.3,4,10),hairMat);tail.position.set(0,-.11,.12);tail.rotation.x=-.2;head.add(tail);
 function pose(distance,movement,time){const stride=.967742,phase=distance/stride*Math.PI*2,settle=ease(0,.3,distance)*(1-ease(43,44,distance));hips.position.y=.89+Math.cos(phase*2)*.012*settle;chest.rotation.y=Math.sin(phase)*.035*settle;for(const l of limbs){const cycle=((distance/stride+(l.side===1?.5:0))%1+1)%1;let z,y;if(cycle<.62){z=-.30+cycle/.62*.60;y=.10}else{const t=(cycle-.62)/.38;z=.30-.60*t;y=.10+Math.sin(t*Math.PI)*.13}z*=settle;y=mix(.10,y,settle);const dy=.87-y,reach=Math.min(.768,Math.hypot(dy,z)),alpha=Math.atan2(-z,dy),beta=Math.acos(clamp(reach/.77));l.thigh.rotation.x=alpha-beta;l.shin.rotation.x=beta*2;l.foot.rotation.x=-l.thigh.rotation.x-l.shin.rotation.x;l.arm.rotation.z=-l.side*Math.PI*.45;l.arm.rotation.x=-Math.sin(phase+(l.side===1?Math.PI:0))*.18*settle;l.forearm.rotation.y=-l.side*.10;l.forearm.rotation.z=-l.side*.06}tail.rotation.x=-.2+Math.sin(phase)*.06*settle;head.rotation.y=Math.sin(time*.0005)*.008;group.updateMatrixWorld(true);skeleton.update()}
 return {group,pose,skeleton};
}



