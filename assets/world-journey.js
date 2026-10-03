import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const clamp = T.MathUtils.clamp;
const smooth = (a,b,p) => { const x=clamp((p-a)/(b-a),0,1); return x*x*(3-2*x); };
const mix = T.MathUtils.lerp;

export async function initWorldJourney() {
  const root=document.querySelector('[data-world-journey]');
  if (!root) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const status=document.querySelector('[data-load-status]');
  const canvas=root.querySelector('canvas');
  const loader=new T.TextureLoader();
  let renderer;
  const fallback=reason=>{
    document.body.classList.add('journey-fallback');
    document.body.classList.remove('journey-loading');
    status.textContent=reason;
  };
  if(reduced.matches) { fallback('A quieter path through the story.'); initCodex(); return; }
  try { renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}); }
  catch { fallback('Explore the story and the world below.'); initCodex(); return; }
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(44,1,.1,220);
  scene.add(new T.HemisphereLight(0xe5e3d7,0x171113,1.1));
  const key=new T.DirectionalLight(0xffe6c2,1.8);key.position.set(-16,30,15);scene.add(key);
  const rim=new T.DirectionalLight(0xad291c,1.6);rim.position.set(12,18,-70);scene.add(rim);
  const world=new T.Group();scene.add(world);
  const ink=new T.MeshStandardMaterial({color:0x24211d,roughness:.95});
  const stone=new T.MeshStandardMaterial({color:0x77766c,roughness:1});
  const brass=new T.MeshStandardMaterial({color:0x948269,roughness:.8,metalness:.15});
  const red=new T.MeshStandardMaterial({color:0x982d22,roughness:1,side:T.DoubleSide});
  const box=(w,h,d,mat,x,y,z,parent=world)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const texture=async path=>{const t=await loader.loadAsync(path);t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;};
  let gate,portrait,realmMap;
  try {
    const loaded=await Promise.all([
      new GLTFLoader().loadAsync(new URL('./models/threshold.glb',import.meta.url).href),
      texture('Images/Cinematic/bloodline-portraits.webp'),
      texture('Images/Journey/crimson-realm.webp'),
      texture('Images/Journey/threshold-stone.webp')
    ]);
    gate=loaded[0].scene;
    realmMap=loaded[2];
    const surface=loaded[3];surface.wrapS=surface.wrapT=T.RepeatWrapping;
    ink.map=surface;ink.bumpMap=surface;ink.bumpScale=.06;ink.needsUpdate=true;
    stone.map=surface;stone.bumpMap=surface;stone.bumpScale=.09;stone.needsUpdate=true;
    world.add(gate);
    gate.traverse(o=>{if(o.isMesh){
      o.material.roughness=.9;
      if(o.name.includes('stone')){o.material.map=surface;o.material.bumpMap=surface;o.material.bumpScale=.07;o.material.color.set(0xb0aca0);}
      if(o.name.includes('brass'))o.material.color.set(0x82735c);
      if(o.name.includes('ink')){o.material.color.set(0x33332f);o.material.map=surface;}
      const lines=new T.LineSegments(new T.EdgesGeometry(o.geometry,36),new T.LineBasicMaterial({color:0x0c0908,transparent:true,opacity:.6}));o.add(lines);
    }});
    const farGate=gate.clone();farGate.position.set(0,10,-65);farGate.scale.setScalar(.76);world.add(farGate);
    portrait=new T.Mesh(new T.PlaneGeometry(27,18),new T.ShaderMaterial({
      transparent:true,depthWrite:false,depthTest:false,uniforms:{image:{value:loaded[1]},opening:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D image;uniform float opening;varying vec2 vUv;
        void main(){vec4 c=texture2D(image,vUv);float edge=smoothstep(0.,.04,vUv.x)*smoothstep(0.,.04,1.-vUv.x)*smoothstep(0.,.04,vUv.y)*smoothstep(0.,.04,1.-vUv.y);
        float cut=smoothstep(opening*.51-.012,opening*.51+.012,abs(vUv.x-.5));
        float a=cut*edge;
        gl_FragColor=vec4(c.rgb,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    }));portrait.position.set(0,8,1.8);portrait.renderOrder=20;world.add(portrait);
    // Reuse the exact Immortal portrait, with no identity-changing image swap.
    const presenceMap=loaded[1].clone();presenceMap.repeat.x=.5;presenceMap.offset.x=.5;presenceMap.needsUpdate=true;
    const presence=new T.Mesh(new T.PlaneGeometry(6.8,9.1),new T.MeshBasicMaterial({map:presenceMap,color:0xe1d6c4}));
    presence.position.set(0,14.6,-64.7);world.add(presence);
    // Distant illustration supplies atmosphere; approached surfaces are geometry.
    const distanceMap=realmMap.clone();distanceMap.repeat.y=.55;distanceMap.needsUpdate=true;
    const backdrop=new T.Mesh(new T.PlaneGeometry(160,59),new T.MeshBasicMaterial({map:distanceMap,color:0x77716b}));
    backdrop.position.set(0,20,-110);world.add(backdrop);
  } catch(error) { console.error('Journey asset failed',error); fallback('The world could not load. The story remains available below.');initCodex();renderer.dispose();return; }
  const doors=[new T.Group(),new T.Group()];
  doors.forEach((door,i)=>{
    world.add(door); const side=i===0?-1:1;
    box(5.15,9.2,.35,ink,side*2.6,4.8,.3,door);
    for(let j=0;j<7;j++) box(.07,8.6,.08,brass,side*(.3+j*.74),4.8,.52,door);
    for(const y of [.5,3.4,6.3,9])box(5.1,.055,.08,brass,side*2.6,y,.53,door);
  });
  // One uninterrupted ascending route between the two thresholds.
  for(let i=0;i<72;i++){
    const y=i*.14,z=2-i*.95;
    box(8,.22,.98,i%9===0?brass:stone,0,y-.12,z);
    if(i%6===0)for(const x of [-4.35,4.35]){
      box(.38,1.4,.38,ink,x,y+.5,z);box(.65,.12,.65,brass,x,y+1.2,z);
    }
  }
  for(let i=0;i<18;i++){
    const side=i%2?-1:1,z=-12-i*5.1;
    const rock=new T.Mesh(new T.IcosahedronGeometry(1,1),ink);
    rock.position.set(side*(11+(i*7%13)),2+(i*3%17),z);
    rock.scale.set(3.5+(i%3),5.5+(i%4),3);rock.rotation.set(i*.3,i*.7,0);world.add(rock);
    if(i%3===0){const temple=gate.clone();temple.scale.setScalar(.18);temple.position.copy(rock.position);temple.position.y+=rock.scale.y*.75;world.add(temple);}
    const banner=new T.Mesh(new T.PlaneGeometry(.8,7),red);banner.position.set(side*(8.7+i%4),9+i%5,z);banner.rotation.y=side*.4;world.add(banner);
  }
  const ring=new T.Mesh(new T.TorusGeometry(8,.045,8,120),brass);ring.position.set(0,20,-69);world.add(ring);
  const sunMap=realmMap.clone();sunMap.offset.set(.27,.53);sunMap.repeat.set(.46,.46);sunMap.needsUpdate=true;
  const sun=new T.Mesh(new T.CircleGeometry(7.6,96),new T.MeshBasicMaterial({map:sunMap,color:0xb38478}));sun.position.set(0,20,-69.1);world.add(sun);
  const nearRocks=[];
  for(const [x,y,z] of [[-4.4,19,-50.5],[14,9,-58]]){
    const rock=new T.Mesh(new T.IcosahedronGeometry(1,1),ink);
    rock.position.set(x,y,z);rock.scale.set(1.9,2.8,1.6);rock.rotation.set(.3,x*.08,.2);world.add(rock);nearRocks.push(rock);
  }
  const seam=new T.Mesh(new T.BoxGeometry(.025,9.1,.08),new T.MeshBasicMaterial({color:0xffd5a4}));seam.position.set(0,4.8,.6);world.add(seam);
  const openingMatte=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{opacity:{value:1}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform float opacity;void main(){gl_FragColor=vec4(.028,.027,.025,opacity);}'}));
  openingMatte.frustumCulled=false;openingMatte.renderOrder=18;scene.add(openingMatte);
  const paperScene=new T.Scene();paperScene.background=new T.Color(0xe5decc);
  const paperCamera=new T.PerspectiveCamera(44,1,.1,100);paperCamera.position.z=18;
  const scroll=new T.Group();paperScene.add(scroll);
  const paperSky=new T.HemisphereLight(0xe5e3d7,0x171113,1.1);paperScene.add(paperSky);
  const paperKey=key.clone(),paperRim=rim.clone();paperScene.add(paperKey,paperKey.target,paperRim,paperRim.target);
  const paperRocks=nearRocks.map(source=>{const copy=source.clone();copy.matrixAutoUpdate=false;paperScene.add(copy);return copy;});
  const rockMatrices=nearRocks.map(()=>new T.Matrix4());
  const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});target.texture.colorSpace=T.SRGBColorSpace;
  const printMaterial=new T.ShaderMaterial({uniforms:{image:{value:target.texture},ink:{value:0},sunCenter:{value:new T.Vector2()},sunX:{value:new T.Vector2()},sunY:{value:new T.Vector2()}},side:T.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D image;uniform float ink;uniform vec2 sunCenter,sunX,sunY;varying vec2 vUv;
      void main(){vec3 c=texture2D(image,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));
      float hatch=sin((vUv.x+vUv.y*.27)*650.);float shade=smoothstep(.08,.62,pow(l,.38));
      vec3 print=mix(vec3(.009,.008,.006),vec3(.78,.73,.60),shade);
      print-=vec3(.012)*smoothstep(-.5,.1,hatch)*(1.-shade)*shade;
      vec2 d=vUv-sunCenter;float determinant=sunX.x*sunY.y-sunX.y*sunY.x;
      vec2 disc=vec2(d.x*sunY.y-d.y*sunY.x,sunX.x*d.y-sunX.y*d.x)/determinant;
      if(dot(disc,disc)<1.&&c.r>.18&&c.r>c.g*3.&&c.r>c.b*3.)print=mix(vec3(.05,.004,.002),vec3(.4,.025,.012),pow(l,.3));
      gl_FragColor=vec4(mix(c,print,ink),1.);
      #include <colorspace_fragment>
      }`
  });
  const paper=new T.Mesh(new T.PlaneGeometry(1,1),printMaterial);scroll.add(paper);
  const rollers=[];
  for(const side of [-1,1]){
    const roller=new T.Mesh(new T.CylinderGeometry(.17,.17,1,24),new T.MeshBasicMaterial({color:0x30261b}));roller.rotation.z=Math.PI/2;scroll.add(roller);rollers.push([roller,side]);
  }
  const poses=[
    [0,[0,8,25],[0,7,0]], [.1,[0,8,34],[0,7,0]], [.24,[1.7,7.8,31],[0,6,-2]],
    [.34,[1.7,7.8,31],[0,6,-2]], [.43,[0,6.1,1],[0,8,-32]], [.52,[-3,10,-22],[0,14,-65]],
    [.61,[12,16,-38],[0,14,-65]], [.89,[12,16,-38],[0,14,-65]],
    [1,[0,15,-48],[0,16,-65]]
  ];
  const gaze=new T.Vector3();
  function pose(p){
    let i=0;while(i<poses.length-2&&p>poses[i+1][0])i++;
    const a=poses[i],b=poses[i+1],t=smooth(a[0],b[0],p);
    camera.position.set(...a[1]).lerp(new T.Vector3(...b[1]),t);
    gaze.set(...a[2]).lerp(new T.Vector3(...b[2]),t);camera.lookAt(gaze);
    if(innerWidth<700)camera.fov=58;else camera.fov=44;
    camera.updateProjectionMatrix();
  }
  const background=new T.Color();let cached=false;
  function worldState(p){
    const open=smooth(.12,.31,p);
    doors.forEach((d,i)=>{d.position.x=(i===0?-1:1)*open*6;d.rotation.y=(i===0?-1:1)*open*.55;});
    portrait.material.uniforms.opening.value=smooth(.16,.34,p);
    portrait.visible=p<.36;seam.visible=p<.31;
    openingMatte.visible=p<.11;openingMatte.material.uniforms.opacity.value=1-smooth(.025,.11,p);
    const crimson=smooth(.25,.48,p);
    background.set(0x070707).lerp(new T.Color(0x361311),crimson);
    scene.background=background;scene.fog=new T.Fog(background,65,155);
    pose(p);
  }
  function capturePrint(){
    worldState(.61);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const uv=point=>{const projected=point.project(camera);return new T.Vector2((projected.x+1)*.5,(projected.y+1)*.5);};
    const center=uv(sun.position.clone());printMaterial.uniforms.sunCenter.value.copy(center);
    printMaterial.uniforms.sunX.value.copy(uv(sun.position.clone().add(new T.Vector3(7.6,0,0)))).sub(center);
    printMaterial.uniforms.sunY.value.copy(uv(sun.position.clone().add(new T.Vector3(0,7.6,0)))).sub(center);
    nearRocks.forEach(r=>r.visible=false);
    renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);
    nearRocks.forEach((r,i)=>{r.visible=true;rockMatrices[i].makeTranslation(0,0,18).multiply(camera.matrixWorldInverse).multiply(r.matrixWorld);});
    for(const [original,copy] of [[key,paperKey],[rim,paperRim]]){
      copy.position.copy(original.position).applyMatrix4(camera.matrixWorldInverse).add(new T.Vector3(0,0,18));
      copy.target.position.copy(original.target.position).applyMatrix4(camera.matrixWorldInverse).add(new T.Vector3(0,0,18));
    }
    paperSky.position.set(0,1,0).applyQuaternion(camera.quaternion.clone().invert());
    cached=true;
  }
  const captions=[...document.querySelectorAll('[data-journey-copy]')];
  let progress=0,renderProgress=0,frame=0,last=0;
  function paint(p){
    const transfer=p>=.61&&p<=.89;
    if(transfer){
      if(!cached)capturePrint();
      const out=Math.sin(Math.PI*smooth(.61,.89,p));
      const h=2*18*Math.tan(T.MathUtils.degToRad(22)),w=h*camera.aspect;
      paper.scale.set(w,h,1);
      rollers.forEach(([r,side])=>{r.scale.y=w+1;r.position.y=side*(h*.5+.18);});
      scroll.scale.setScalar(mix(1,.68,out));scroll.rotation.set(out*.07,out*-.62,out*.055);
      scroll.position.set(out*(innerWidth<700?.1:2.2),out*.15,-out*2);
      printMaterial.uniforms.ink.value=out;
      paperRocks.forEach((r,i)=>{r.matrix.makeTranslation(out*(i===0?-1:1)*.8,out*(i===0?-.3:.4),out*.6).multiply(rockMatrices[i]);});
      renderer.render(paperScene,paperCamera);
    }else{worldState(p);renderer.render(scene,camera);}
    const act=p<.38?0:p<.65?1:2;
    document.body.dataset.journeyAct=act;
    document.body.classList.toggle('paper-tone',transfer);
    captions.forEach(el=>{
      const [a,b]=el.dataset.journeyCopy.split(',').map(Number);
      const opacity=(a===0?1:smooth(a,a+.025,p))*(1-smooth(b-.025,b,p));
      el.style.opacity=opacity;el.inert=opacity<.8;el.setAttribute('aria-hidden',String(opacity<.8));
    });
    document.querySelector('.journey-meter i').style.width=p*100+'%';
    document.querySelector('[data-chapter]').textContent=['01 / THE FRACTURE','02 / CRIMSON ASCENSION','03 / THE LIVING SCROLL'][act];
    root.dataset.progress=p.toFixed(4);root.dataset.mode=transfer?'print':'spatial';
    root.dataset.drawCalls=renderer.info.render.calls;
    root.dataset.geometries=renderer.info.memory.geometries;
    root.dataset.textures=renderer.info.memory.textures;
    document.querySelector('.journey-hud').hidden=root.getBoundingClientRect().bottom<innerHeight*.25;
    document.querySelector('.journey-meter').hidden=root.getBoundingClientRect().bottom<innerHeight*.25;
  }
  function tick(now){
    frame=0;if(document.hidden||document.body.classList.contains('journey-fallback'))return;
    const dt=Math.min((now-last)/1000,.1);last=now;
    renderProgress=mix(renderProgress,progress,1-Math.exp(-dt*24));
    if(Math.abs(renderProgress-progress)<.00002)renderProgress=progress;
    paint(renderProgress);
    if(renderProgress!==progress)frame=requestAnimationFrame(tick);
  }
  const schedule=()=>{if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}};
  function resize(){
    const pixelBudget=innerWidth<700?1500000:6000000;
    renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.5:1.75,Math.sqrt(pixelBudget/(innerWidth*innerHeight))));
    renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;
    paperCamera.aspect=camera.aspect;paperCamera.updateProjectionMatrix();
    const portraitScale=innerWidth<700?10.5/27:1;
    portrait.scale.setScalar(portraitScale);portrait.position.y=innerWidth<700?8.5:8;
    target.setSize(Math.min(2048,Math.round(innerWidth*renderer.getPixelRatio())),Math.min(2048,Math.round(innerHeight*renderer.getPixelRatio())));
    cached=false;schedule();
  }
  gsap.registerPlugin(ScrollTrigger);
  const driver={p:0};
  gsap.to(driver,{p:1,ease:'none',scrollTrigger:{trigger:root,start:'top top',end:'bottom bottom',scrub:true,
    onUpdate:self=>{progress=self.progress;schedule();},onRefresh:self=>{progress=self.progress;renderProgress=progress;cached=false;schedule();}}});
  addEventListener('resize',resize,{passive:true});
  addEventListener('pageshow',()=>{ScrollTrigger.refresh();schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderProgress=progress;schedule();}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('The story remains available below.');});
  canvas.addEventListener('webglcontextrestored',()=>{document.body.classList.remove('journey-fallback');cached=false;resize();});
  reduced.addEventListener('change',()=>{
    if(reduced.matches){cancelAnimationFrame(frame);frame=0;ScrollTrigger.getAll().forEach(t=>t.kill());fallback('A quieter path through the story.');}
    else location.reload();
  });
  initCodex();resize();ScrollTrigger.refresh();document.body.classList.remove('journey-loading');
  status.textContent='Scroll to cross the threshold.';root.dataset.ready='true';
}

function initCodex(){
  const dialog=document.querySelector('#experience-codex');if(!dialog)return;
  let focus,overflow;
  document.querySelectorAll('[data-open-codex]').forEach(b=>b.addEventListener('click',()=>{
    focus=b;overflow=document.documentElement.style.overflowY;
    document.documentElement.style.overflowY='hidden';dialog.showModal();
  }));
  dialog.querySelector('[data-close-codex]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.documentElement.style.overflowY=overflow;focus?.focus({preventScroll:true});if(!document.body.classList.contains('journey-fallback'))ScrollTrigger.refresh();});
  document.querySelector('[data-sound]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;
    if(b._audio){b._audio.close();b._audio=null;b.textContent='Sound off';b.setAttribute('aria-pressed','false');return;}
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const a=new C();b._audio=a;const gain=a.createGain();gain.gain.value=.025;gain.connect(a.destination);
    for(const frequency of [55,82.4,110]){const osc=a.createOscillator();osc.type='sine';osc.frequency.value=frequency;osc.connect(gain);osc.start();}
    await a.resume();b.textContent='Sound on';b.setAttribute('aria-pressed','true');
  });
}
