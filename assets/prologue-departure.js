import * as T from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export const DEPARTURE_DURATION=4200;
export const EARTH_GRAVITY=9.80665; // metres / second squared; the scroll is 0.734 m long.
// Fixed-step rigid flight: gravity, angular momentum, and dissipative wall impulses.
const flightSeconds=DEPARTURE_DURATION*.84/1000,step=1/240;
function rigidFlight(){
 const position=new T.Vector3(),velocity=new T.Vector3(.95,.045,-.55),rotation=new T.Quaternion(),spin=new T.Vector3(.64,.22,.15);
 const states=[],contacts=[];let lastContact=-1;
 const inverseInertia=v=>v.clone().applyQuaternion(rotation.clone().invert()).multiply(new T.Vector3(1/.0008,1/.0449,1/.0449)).applyQuaternion(rotation);
 for(let time=0;time<=flightSeconds+step;time+=step){
  velocity.z-=EARTH_GRAVITY*step;position.addScaledVector(velocity,step);
  const speed=spin.length();if(speed>0)rotation.premultiply(new T.Quaternion().setFromAxisAngle(spin.clone().divideScalar(speed),speed*step)).normalize();
  const axis=new T.Vector3(1,0,0).applyQuaternion(rotation);
  for(const key of ['x','y']){
   const extent=Math.abs(axis[key])*.367+.022,limit=.48-extent;
   if(Math.abs(position[key])<=limit)continue;
   const sign=Math.sign(position[key]);position[key]=sign*limit;
   const normal=new T.Vector3();normal[key]=-sign;
   const arm=axis.clone().multiplyScalar(Math.sign(axis[key])*sign*.367);
   const contactVelocity=velocity.clone().add(new T.Vector3().crossVectors(spin,arm)),closing=contactVelocity.dot(normal);
   if(closing>=-.002)continue;
   const torque=new T.Vector3().crossVectors(arm,normal),denominator=1+torque.dot(inverseInertia(torque));
   const impulse=normal.clone().multiplyScalar(-(1+.42)*closing/denominator);
   velocity.add(impulse);spin.add(inverseInertia(new T.Vector3().crossVectors(arm,impulse)));
   // Tangential friction removes energy; it never adds a spring or deformation.
   velocity.multiplyScalar(.985);spin.multiplyScalar(.94);
   if(time-lastContact>.12){contacts.push(.16+time/(DEPARTURE_DURATION/1000));lastContact=time}
  }
  velocity.multiplyScalar(Math.exp(-.018*step));spin.multiplyScalar(Math.exp(-.08*step));
  states.push({position:position.clone(),rotation:rotation.clone()});
 }
 return {states,contacts};
}
const flight=rigidFlight();
export const DEPARTURE_IMPACTS=flight.contacts;
export function departurePose(t){
 const elapsed=clamp((t-.16)/.84)*flightSeconds,index=Math.min(flight.states.length-2,Math.floor(elapsed/step)),u=elapsed/step-index;
 const a=flight.states[index],b=flight.states[index+1],position=a.position.clone().lerp(b.position,u),rotation=a.rotation.clone().slerp(b.rotation,u),fall=clamp((t-.16)/.84);
 return {position,rotation,x:position.x/.7,y:position.y/.9,roll:new T.Euler().setFromQuaternion(rotation).z*180/Math.PI,depth:1-position.z/.8,
  scale:1,fold:47.8*smooth(0,.16,t),black:smooth(.015,.17,t),hole:smooth(.52,.70,t)*(1-smooth(.91,1,t)),fall};
}
function stoneTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#0e1010';g.fillRect(0,0,512,512);
 for(let row=0;row<8;row++)for(let col=-1;col<9;col++){const x=col*64+(row%2)*32,y=row*64,tone=36+(row*19+col*31+512)%22;g.fillStyle=`rgb(${tone},${tone-2},${tone-5})`;g.fillRect(x+2,y+2,60,60);g.strokeStyle='#52504a36';g.lineWidth=2;g.strokeRect(x+5,y+5,54,54);}
 for(let i=0;i<6500;i++){const x=(i*73.17)%512,y=(i*47.63)%512;g.fillStyle=i%2?'#00000035':'#aca89b13';g.fillRect(x,y,1+i%3,1);}
 for(let i=0;i<70;i++){g.strokeStyle='#05080739';g.beginPath();g.moveTo(i*8,0);g.bezierCurveTo(i*8-4,130,i*8+7,340,i*8+2,512);g.stroke();}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(1,62.5);map.anisotropy=4;return map;
}

function grainTexture(paper=false){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle=paper?'#d6c7a3':'#594025';ctx.fillRect(0,0,512,128);
  for(let i=0;i<120;i++){
    ctx.strokeStyle=paper?`rgba(84,69,41,${.03+(i%4)*.014})`:`rgba(${i%2?24:166},${i%2?18:126},${i%2?11:76},.3)`;
    ctx.lineWidth=paper?.5:.4+(i%3)*.35;ctx.beginPath();
    for(let y=0;y<=128;y+=4){const x=i*4.37+Math.sin(y*.085+i)*1.5;y===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;texture.repeat.set(2,1);return texture;
}

export function createScrollDeparture(){
  const host=document.querySelector('.departure'),canvas=host.querySelector('canvas');
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1,.005,120);camera.lookAt(0,0,-1);
  scene.add(new T.HemisphereLight(0xe5dcc4,0x20170c,1.4));
  const key=new T.DirectionalLight(0xffe2a4,3);key.position.set(-3,5,4);scene.add(key);
  const rim=new T.DirectionalLight(0xc9d4d2,1.1);rim.position.set(4,-1,-3);scene.add(rim);
  const wood=new T.MeshStandardMaterial({map:grainTexture(),roughness:.48,metalness:.16});
  const bronze=new T.MeshStandardMaterial({color:0xb48b51,roughness:.35,metalness:.65});
  const paper=new T.MeshStandardMaterial({map:grainTexture(true),roughness:.9});
  const ribbon=new T.MeshStandardMaterial({color:0x65281f,roughness:.85});
  const stone=stoneTexture(),wellMaterial=new T.MeshStandardMaterial({map:stone,bumpMap:stone,bumpScale:.016,color:0x9e9c94,roughness:1,side:T.DoubleSide,transparent:true});
 const well=new T.Group();scene.add(well);
 for(const [x,y,turn]of [[-.48,0,Math.PI/2],[.48,0,-Math.PI/2],[0,.48,0],[0,-.48,0]]){const wall=new T.Mesh(new T.PlaneGeometry(.96,60,1,1),wellMaterial);wall.rotation.x=Math.PI/2;wall.rotateOnWorldAxis(new T.Vector3(0,0,1),turn);wall.position.set(x,y,-30);well.add(wall)}
 scene.fog=new T.Fog(0x000000,12,95);
 const actor=new T.Group();scene.add(actor);
  function cylinder(radius,length,material,x=0,y=0){const m=new T.Mesh(new T.CylinderGeometry(radius,radius,length,40,1),material);m.rotation.z=Math.PI/2;m.position.set(x,y,0);actor.add(m);return m}
  cylinder(.20,6.76,paper);
  for(const y of [-.19,.19]){
    cylinder(.095,7.04,wood,0,y);
    for(const side of [-1,1]){cylinder(.16,.18,wood,side*3.59,y);cylinder(.115,.055,bronze,side*3.47,y);cylinder(.14,.035,bronze,side*3.67,y)}
  }
  cylinder(.209,.18,ribbon);
  const materials=[wood,bronze,paper,ribbon];for(const m of materials)m.transparent=true;
  const particleCount=72,positions=new Float32Array(particleCount*3),cloud=new T.BufferGeometry();cloud.setAttribute('position',new T.BufferAttribute(positions,3));
  const fleckMaterial=new T.PointsMaterial({color:0xd7af69,size:.0045,transparent:true,opacity:0,depthWrite:false});
  const flecks=new T.Points(cloud,fleckMaterial);scene.add(flecks);
  let width=0,height=0,distance=8,slender=.5,impactAt=-1,impactOrigin=new T.Vector3();
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;if(w===width&&h===height)return;
    width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    const shell=document.querySelector('.scroll-shell'),box=shell.getBoundingClientRect();
    const rollWidth=box.width*.94,rollHeight=(w<700?35:43)+Math.max(0,box.height*.044-12);
    distance=.734/(rollWidth/w*2*Math.tan(T.MathUtils.degToRad(21))*camera.aspect);
    slender=7.34*(rollHeight/rollWidth)/.70;
  }
  function update(t,now){
    resize();const pose=departurePose(t);
    actor.position.copy(pose.position);actor.position.z-=distance;
    actor.quaternion.copy(pose.rotation);actor.scale.set(.1,slender*.18,slender*.18);
    well.position.z=-distance*.85;wellMaterial.opacity=smooth(.17,.26,t)*(1-smooth(.60,.80,t));
    scene.fog.near=distance+.8;scene.fog.far=distance+12;
    for(const m of materials)m.opacity=1-smooth(.92,1,t);
    const age=(now-impactAt)/1000,energy=Math.max(0,1-age/.45);
    fleckMaterial.opacity=energy*.5;
    if(energy>0){for(let i=0;i<particleCount;i++){const a=i*2.399,r=(.015+age*.3)*((i*37%71)/71);positions[i*3]=impactOrigin.x+Math.cos(a)*r;positions[i*3+1]=impactOrigin.y+Math.sin(a)*r*.65;positions[i*3+2]=impactOrigin.z+Math.sin(i)*age*.1}cloud.attributes.position.needsUpdate=true}
    renderer.render(scene,camera);return pose;
  }
  function impact(now){impactAt=now;impactOrigin.copy(actor.position)}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.classList.add('departure-fallback')});
  return {update,impact};
}
