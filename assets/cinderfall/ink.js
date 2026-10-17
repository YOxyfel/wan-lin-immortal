// Ink overlay: droplets, blooms, floods and cinnabar splatter rendered over the page with a tiny WebGL2 program.
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
const PAINT_LIB = `// ---------------------------------------------------------------- the painting: mountains and water, in ink
// a row of the noise as a function of x (ridgelines)
float rn(float x, float row){ return texture(uNoise,vec2(x,row)).r*.58+texture(uNoise,vec2(x*2.07+.31,row+.19)).g*.28+texture(uNoise,vec2(x*4.3+.7,row+.43)).a*.14; }
// peaks: rounded heads on steep flanks, a few to a cell, the tallest wins
float range(float x, float W, float H, float seed, float pw){
  float i0=floor(x/W), y=0.;
  for(int k=-1;k<=1;k++){
    float i=i0+float(k);
    float cx=(i+.2+.6*h1(i*1.7+seed))*W, hh=H*(.32+.68*h1(i*3.1+seed+4.)), ww=W*(.55+.55*h1(i*5.3+seed+9.));
    float t=(x-cx)/ww;
    y=max(y,hh*pow(max(0.,1.-t*t),pw));
  }
  return y;
}
// the top of each layer at x (canvas units: the shorter side of the screen spans 1)
// (on a tall screen the far peaks stand higher, filling the sky like a hanging scroll's)
uniform float uTall;
float top0(float x){ return .07+range(x,.34,.36,1.,1.25)*(1.+uTall*.9)+range(x,.13,.11,5.,1.4)*.8+(rn(x*6.,.11)-.5)*.02; }
float top1(float x){ return -.035+range(x+.4,.25,.21,13.,1.5)+range(x,.1,.07,17.,1.5)+(rn(x*9.,.31)-.5)*.018; }
float top2(float x){ return -.165+range(x+.9,.42,.095,23.,2.)+(rn(x*5.,.51)-.5)*.035+(rn(x*24.,.57)-.5)*.008; }
float top3(float x, float E, float R){ return -.36+.62*exp(-(x-E)/.2)*(.85+.3*rn(x*3.,.71))+.11*exp(-(R-x)/.24)+(rn(x*14.,.77)-.5)*.02; }
// stone pillars standing up out of the mist between the far peaks and the near hills (like the towers of the basin)
float pillar(vec2 c, out float edge){
  float W=.12, i0=floor(c.x/W), d=0.; edge=0.;
  for(int k=-1;k<=1;k++){
    float i=i0+float(k);
    if(h1(i*4.1+31.)<.42) continue;
    float cx=(i+.5+(h1(i*2.3+33.)-.5)*.6)*W, ww=W*(.18+.2*h1(i*5.9+35.)), base=-.02+h1(i*1.3+37.)*.05, H=.12+.2*h1(i*7.7+39.);
    float y=(c.y-base)/H;
    if(y<0.||y>1.) continue;
    // straight walls stepped by their bedding, a rounded crown
    float hw=ww*(1.-pow(y,7.)*.85)*(.92+.08*sin(y*40.+i))*(1.-.12*y);
    float dx=abs(c.x-cx+(h1(i)-.5)*.02*y);
    if(dx<hw){ d=max(d,1.); edge=max(edge,smoothstep(hw*.55,hw,dx)); }
  }
  return d;
}
// conifers standing along a ridge (tiered, with a stem), darker than the ridge they stand on
float conifers(vec2 c, float W, float H, float seed, int which, float E, float R){
  float i0=floor(c.x/W), d=0.;
  for(int k=-1;k<=1;k++){
    float i=i0+float(k);
    if(h1(i*7.7+seed)<.28) continue;
    float cx=(i+.5+(h1(i*2.9+seed)-.5)*.7)*W;
    float base=(which==2?top2(cx):top3(cx,E,R))-.006;
    float h=H*(.45+.75*h1(i*4.3+seed+2.));
    float f=(c.y-base)/h;
    if(f<0.||f>1.) continue;
    // a fir: tiers of drooping boughs narrowing to a sharp tip, a little lean
    float nt=3.+2.*h1(i*6.1+seed);
    float tiers=.62+.38*fract(f*nt+h1(i)*.7);
    float hw=W*.66*pow(1.-f,.95)*tiers*(.75+.45*h1(i*9.1+seed));
    float dx=abs(c.x-cx-(h1(i*3.7+seed)-.5)*W*.5*f);
    d=max(d,max(smoothstep(hw,hw*.5,dx),smoothstep(W*.06,W*.03,dx)*step(f,.07)));
  }
  return d;
}
// the pine leaning out over the void at the left of the page (s: its scale on narrow screens)
float bigPine(vec2 c, float E, float s, out float bark){
  bark=0.;
  vec2 o=vec2(E,0.);
  vec2 P0=o+vec2(.05*s,-.56-uTall*.55), P1=o+vec2(.1,-.08)*s, P2=o+vec2(.27,.18)*s;
  float best=1e9, bt=0.;
  vec2 prev=P0;
  for(int i=1;i<=14;i++){
    float t=float(i)/14., it=1.-t;
    vec2 q=it*it*P0+2.*it*t*P1+t*t*P2;
    vec2 e=q-prev; float hh=clamp(dot(c-prev,e)/max(dot(e,e),1e-8),0.,1.);
    float dd=length(c-prev-e*hh);
    if(dd<best){best=dd;bt=t-(1.-hh)/14.;}
    prev=q;
  }
  float w=mix(.042,.011,bt)*s*(1.+.18*sin(bt*17.));
  float fib=texture(uNoise,vec2(bt*4.,(best/w)*.5+.2)).b;
  float trunk=smoothstep(w,w*.72,best+(fib-.5)*w*.3);
  bark=trunk*(1.-smoothstep(.0,w*.55,best))*fib;
  // (dark along its edges, the dry brush leaving light down its middle)
  float d=trunk*mix(.95,.62+.3*fib,smoothstep(w*.75,0.,best)*.7);
  // limbs out to the pads of needles
  vec4 pads[6];
  // (x, y of the pad; its half width and height; where along the trunk its limb leaves it)
  pads[0]=vec4(.36,.17,.13,.036); pads[1]=vec4(.22,.245,.1,.03); pads[2]=vec4(.47,.105,.1,.03);
  pads[3]=vec4(.14,.07,.08,.026); pads[4]=vec4(.3,.255,.075,.024); pads[5]=vec4(.03,.16,.065,.022);
  float at[6]; at[0]=.82; at[1]=.93; at[2]=.7; at[3]=.55; at[4]=1.; at[5]=.74;
  for(int k=0;k<6;k++){
    vec4 pd=pads[k];
    vec2 pc=o+pd.xy*s; vec2 rr=pd.zw*s;
    float ta=at[k], ia=1.-ta;
    vec2 from=ia*ia*P0+2.*ia*ta*P1+ta*ta*P2;
    // (a limb that bends: down a little, then up into the pad)
    vec2 mid=mix(from,pc,.5)+vec2(0.,-.02*s);
    float lb=1e9, lt=0.; vec2 pv=from;
    for(int j=1;j<=6;j++){
      float t=float(j)/6., it=1.-t; vec2 q=it*it*from+2.*it*t*mid+t*t*pc;
      vec2 e=q-pv; float hh=clamp(dot(c-pv,e)/max(dot(e,e),1e-8),0.,1.);
      float dd=length(c-pv-e*hh); if(dd<lb){lb=dd;lt=t-(1.-hh)/6.;}
      pv=q;
    }
    float lw=mix(.0075,.0028,lt)*s;
    d=max(d,smoothstep(lw,lw*.6,lb+(texture(uNoise,c*11.).r-.5)*.0016)*.9);
    // the pad: a flat, lobed cloud of needles, darkest along its scalloped top, the needles in short level strokes
    vec2 q=(c-pc)/rr;
    float scal=.12*sin(q.x*7.+float(k)*1.9)+.07*sin(q.x*15.+float(k));
    float r=length(vec2(q.x,q.y-scal*step(0.,q.y)))+(texture(uNoise,c*vec2(6.,10.)+float(k)*.17).g-.5)*.32;
    float inside=smoothstep(1.,.82,r);
    float needles=texture(uNoise,vec2(c.x*28.,c.y*95.)+float(k)*.3).r*.6+texture(uNoise,vec2(c.x*60.,c.y*160.)+float(k)*.7).g*.4;
    needles=smoothstep(.3,.72,needles);
    float topK=smoothstep(-.5,.75,q.y-scal);
    d=max(d,inside*(.42+.5*topK)*(.5+.6*needles));
  }
  return clamp(d,0.,1.);
}
// the whole painting: ink density at canvas point c (0..1), and where the light was (a pale gold sun)
float painting(vec2 c, float E, float R, out float sun){
  sun=0.;
  vec2 cs=(uSun-.5)*(uRes/min(uRes.x,uRes.y));
  float ds=length(c-cs);
  sun=smoothstep(.075,.068,ds)*.55+exp(-ds*ds/.02)*.22;
  float d=0.;
  float t3=top3(c.x,E,R), t2=top2(c.x), t1=top1(c.x), t0=top0(c.x), pe=0.;
  // texture strokes down the slopes (cun), dry where the brush ran thin
  vec2 sr=mat2(.96,-.28,.28,.96)*c;
  float cun=texture(uNoise,sr*vec2(7.,1.6)+.13).b*.55+texture(uNoise,sr*vec2(19.,3.4)+.61).g*.45;
  float dry=smoothstep(.3,.7,texture(uNoise,sr*vec2(3.,26.)+.37).r);
  if(c.y<t3){
    float g=t3-c.y;
    d=.82*(.4+.6*exp(-g/.09))*(.7+.5*cun)*smoothstep(-.6-uTall*.18,-.38,c.y);
    d=max(d,.9*exp(-g/.0035)*(.5+.5*dry));
  } else if(c.y<t2){
    float g=t2-c.y;
    d=.5*(.35+.65*exp(-g/.05))*(.72+.45*cun)*smoothstep(-.33,-.2,c.y);
    d=max(d,.68*exp(-g/.003)*(.45+.55*dry));
  } else if(c.y<t1){
    float g=t1-c.y;
    d=.27*(.3+.7*exp(-g/.07))*(.75+.4*cun)*smoothstep(-.01,.11,c.y);
    d=max(d,.4*exp(-g/.0028)*(.4+.6*dry));
  } else if(pillar(c,pe)>0.){
    // (pale stone in the mist, darker down its edges, its foot lost in the mist)
    d=(.2+.22*pe)*(.75+.45*cun)*smoothstep(-.02,.09,c.y);
    d=max(d,.32*pe*(.5+.5*dry)*smoothstep(-.02,.09,c.y));
  } else if(c.y<t0){
    float g=t0-c.y;
    d=.15*(.3+.7*exp(-g/.12))*(.8+.35*cun)*smoothstep(.04,.17,c.y);
    d=max(d,.22*exp(-g/.003)*(.4+.6*dry));
  }
  // the forest along the near ridges, and pines on the cliff
  d=max(d,conifers(c,.016,.05,3.,2,E,R)*.62*smoothstep(-.3,-.2,c.y));
  d=max(d,conifers(c+vec2(.0073,-.006),.011,.034,11.,2,E,R)*.4*smoothstep(-.3,-.2,c.y));
  d=max(d,conifers(c,.03,.1,7.,3,E,R)*.9);
  // the old pine over the void
  float bark;
  float s=clamp((R-E)/1.78,.6,1.);
  d=max(d,bigPine(c,E,s,bark));
  return clamp(d,0.,1.);
}
`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform sampler2D uNoise;
uniform vec4 uBlot[8]; uniform vec3 uBlotCol[8];
uniform float uFlood; uniform vec2 uFloodC; uniform vec3 uFloodCol; uniform float uFloodLift;
uniform vec4 uDrop;      // x, y (uv), size, splash progress
uniform float uSplat; uniform float uSplatSeed;
uniform vec4 uStroke;    // x: written to (0..1), y: width, z: alpha, w: tail (0..1, where the stroke has dried away)
uniform vec2 uStrokeA, uStrokeB, uStrokeC, uStrokeD;   // a cubic across the page (uv)
// the painting the gold thread writes into being on the page: x how far it has bled out (0..1), y its alpha, z how far it
// has cleared (the eye going in, 0..1), w the push in (1 = the whole page)
uniform vec4 uLand; uniform vec2 uLandC, uSun;
out vec4 frag;
float n1(vec2 p){ return texture(uNoise,p).r; }
float fbm(vec2 p){ return texture(uNoise,p).r*.5+texture(uNoise,p*2.03+.17).g*.3+texture(uNoise,p*4.1+.41).a*.2; }
float h1(float x){ return fract(sin(x*127.13)*43758.5453); }
// ink blot with domain-warped edge, capillary feathering and a pooled rim
vec2 blot(vec2 p, vec2 c, float r, float seed){
  vec2 q=p-c; float d=length(q); if(r<=0.) return vec2(0.);
  float ang=atan(q.y,q.x);
  float warp=fbm(q*.55/r+vec2(seed,seed*.37))-.5;
  float tend=pow(fbm(vec2(ang*.35+seed*.11,d*.6/r+seed)),2.6)*.55;
  float rr=r*(1.+warp*.42+tend*.5);
  float inside=smoothstep(rr,rr*.965,d);
  float rim=smoothstep(rr*.62,rr*.985,d)*inside;
  float feather=(1.-smoothstep(rr,rr*1.22,d))*step(rr,d)*pow(fbm(q*3.4/r+seed),2.)*.9;
  float density=inside*(.86+rim*.14)+feather*.55;
  return vec2(clamp(density,0.,1.),rim);
}
uniform sampler2D uPaint;
// a few birds going over, far off (wings beating slowly), over the painting
float birds(vec2 c){
  float d=0.;
  for(int k=0;k<6;k++){
    float fk=float(k);
    vec2 b=vec2(.12+fk*.055+h1(fk+.3)*.03,.3+h1(fk+1.9)*.05-fk*.012)+vec2(uLand.x*.05,0.);
    float sp=.012+h1(fk+4.)*.005;
    float flap=sin(uTime*(4.+h1(fk)*2.)+fk*2.);
    vec2 q=c-b;
    float ax=abs(q.x)/sp;
    // (a wing: up from the body, bending down at the tip; up and down as it beats)
    float wy=sp*(ax*(.62+.35*flap)-ax*ax*(.55+.3*flap));
    float bd=abs(q.y-wy);
    d=max(d,smoothstep(.0019,.0007,bd+max(ax-1.,0.)*.01)*.9*(1.-smoothstep(.9,1.05,ax)));
  }
  return d;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float m=min(uRes.x,uRes.y); vec2 asp=uRes/m; vec2 p=uv*asp;
  vec3 col=vec3(0.); float a=0.;
  vec3 ink=vec3(.035,.032,.03);
  for(int i=0;i<8;i++){
    vec4 b=uBlot[i]; if(b.w<=0.) continue;
    vec2 r=blot(p,b.xy*asp,b.z,float(i)*7.31+1.);
    float k=r.x*b.w;
    vec3 c=mix(uBlotCol[i],uBlotCol[i]*.55,r.y);
    col=col*(1.-k)+c*k; a=a+k*(1.-a);
  }
  if(uFlood>0.){
    vec2 r=blot(p,uFloodC*asp,uFlood*2.4,3.7);
    float T=uFloodLift*1.45; float lift=uFloodLift>0.?1.-smoothstep(T-.22,T,fbm(p*.7+.3)*.75+length(p-uFloodC*asp)*.32):0.;
    float k=r.x*(1.-lift);
    col=col*(1.-k)+uFloodCol*k; a=a+k*(1.-a);
  }
  // the falling droplet and its crown splash
  if(uDrop.z>0.){
    vec2 c=uDrop.xy*asp; float s=uDrop.z;
    vec2 q=(p-c)/s;
    if(uDrop.w<=0.){
      q.y-=.35; // teardrop: round bottom, pointed top
      float tear=length(vec2(q.x*(1.+max(q.y,0.)*1.6),q.y*(q.y>0.?.55:1.)));
      float d=smoothstep(1.,.92,tear);
      float spec=smoothstep(.35,.0,length(q-vec2(-.32,-.05)))*.9+smoothstep(.2,.0,length(q-vec2(.25,-.55)))*.3;
      vec3 dc=mix(ink,vec3(.9,.92,1.),spec);
      col=col*(1.-d)+dc*d; a=a+d*(1.-a);
    } else {
      float t=uDrop.w;
      for(int k=0;k<14;k++){
        float fk=float(k), an=fk/14.*6.2831+h1(fk)*.4;
        float dist=(.6+h1(fk+3.)*1.6)*t*2.2;
        vec2 sp=vec2(cos(an),sin(an)*.55)*dist+vec2(0.,(1.-t)*t*2.5*h1(fk+5.));
        float rad=(.12+h1(fk+9.)*.18)*(1.-t*.6);
        float d=smoothstep(rad,rad*.6,length(q-sp))*(1.-smoothstep(.75,1.,t));
        col=col*(1.-d)+ink*d; a=a+d*(1.-a);
      }
    }
  }
  // ---- the page the forest is painted on (pushed in toward where the eye goes in)
  float zoom=max(uLand.w,1.);
  vec2 pz=(uLandC+(uv-uLandC)/zoom)*asp;
  // the gold thread: one stroke written across the paper, from where the light went down to where it leads
  float best=1e9, bt=0., bleed=-1e9;
  if(uStroke.z>0.||uLand.y>0.){
    vec2 A=uStrokeA*asp,Bc=uStrokeB*asp,Cc=uStrokeC*asp,D=uStrokeD*asp;
    vec2 prev=A;
    for(int i=1;i<=64;i++){
      float t=min(float(i)/64.,uStroke.x);
      float it=1.-t;
      vec2 c=it*it*it*A+3.*it*it*t*Bc+3.*it*t*t*Cc+t*t*t*D;
      // distance to the segment prev..c (a polyline, so the stroke is continuous)
      vec2 e=c-prev; float h=clamp(dot(pz-prev,e)/max(dot(e,e),1e-8),0.,1.);
      float d=length(pz-prev-e*h);
      if(d<best){best=d;bt=t-(1.-h)/64.;}
      // (how far the ink has bled out from here: longer since the brush passed, farther)
      bleed=max(bleed,(uStroke.x-t)*.55-d);
      prev=c;
      if(float(i)/64.>=uStroke.x) break;
    }
  }
  // where the page has cleared as the eye goes in (from the point it goes in at, outward, ragged like parting mist)
  vec2 cc=(pz-.5*asp);
  vec2 cD=(uLandC-.5)*asp;
  float clearR=uLand.z>0.?2.5*pow(uLand.z,1.2)-.08:0.;
  float keep=uLand.z>0.?smoothstep(clearR-.38,clearR,length(cc-cD)*.95+(fbm(cc*1.7+.2)-.5)*.36):1.;
  if(uLand.y>0.){
    // the ink bleeds out from the thread as it is written, and on over the whole page
    float rv=smoothstep(0.,.14,bleed+uLand.x*1.7-.3-(fbm(cc*2.6+.4)-.5)*.16);
    // (the painting itself is drawn once into a texture; here it is read at the page point, pushed in)
    vec4 PT=texture(uPaint,pz/asp);
    float sunK=PT.g;
    float d=max(PT.r,birds(cc));
    // (a darker tide line where the wet front is)
    float tide=rv*(1.-rv)*4.;
    d=clamp(d*(1.+tide*.25)+tide*.05*step(.02,d),0.,1.);
    float k=d*rv*uLand.y*keep;
    col=col*(1.-k)+ink*k; a=a+k*(1.-a);
    // the light it went down in: a pale gold sun on the page, the thread comes out of it
    float g=sunK*uLand.y*keep*smoothstep(0.,.25,uLand.x+uStroke.x)*clamp(1.-d*2.4,0.,1.);
    vec3 sunC=vec3(.95,.72,.34);
    col=col*(1.-g)+sunC*g; a=a+g*(1.-a);
  }
  if(uStroke.z>0.&&bt>=uStroke.w&&best<1e8){
    // the brush: swelling in the middle, a fine tail, dry bristles breaking the edges
    float press=sin(3.1416*clamp(bt*1.15,0.,1.))*.85+.15;
    float w=uStroke.y*press*(1.-smoothstep(uStroke.x-.06,uStroke.x,bt)*.6);
    float edge=fbm(vec2(bt*9.,best*30.));
    // dry bristles: streaks along the stroke where the brush runs out, mostly near its edges and its tail
    float dry=smoothstep(.3,.7,fbm(vec2(bt*6.,(best/max(w,1e-4))*2.2+.3)));
    float tailDry=smoothstep(.55,1.,bt);
    float k=smoothstep(w,w*.6,best+(edge-.5)*w*.35)*mix(1.,mix(.35,1.,dry),.35+tailDry*.5);
    float head=exp(-(uStroke.x-bt)*30.);
    vec3 gold=mix(vec3(.62,.42,.12),vec3(.98,.8,.38),.5+.5*sin(bt*24.+best*80.));
    gold=mix(gold,vec3(1.,.93,.7),head*.6);
    k*=uStroke.z*smoothstep(uStroke.w,uStroke.w+.08,bt)*keep;
    col=col*(1.-k)+gold*k; a=a+k*(1.-a);
    // a soft glow around the fresh ink
    float g=exp(-best/max(w*2.5,1e-4))*.25*uStroke.z*head*keep;
    col+=vec3(1.,.75,.3)*g; a=a+g*(1.-a);
  }
  // cinnabar splatter thrown across the frame
  if(uSplat>0.){
    vec3 red=vec3(.52,.035,.025);
    for(int k=0;k<11;k++){
      float fk=float(k)+uSplatSeed*13.;
      vec2 e=vec2(h1(fk),h1(fk+1.7));
      // keep the centre of the frame clear: throw drops toward the edges
      e.x=e.x<.5?e.x*.34:1.-(1.-e.x)*.34;
      if(h1(fk+3.3)<.35) e=vec2(h1(fk+5.1),h1(fk+1.7)<.5?h1(fk+1.7)*.3:1.-(1.-h1(fk+1.7))*.3);
      vec2 c=e*asp;
      float size=.012+pow(h1(fk+2.3),4.)*.07;
      float appear=smoothstep(h1(fk+4.1)*.35,h1(fk+4.1)*.35+.12,uSplat);
      vec2 dir=normalize(vec2(h1(fk+6.)-.5,h1(fk+7.)-.5)+.001);
      vec2 q=p-c;
      float along=dot(q,dir), across=dot(q,vec2(-dir.y,dir.x));
      float streak=smoothstep(size*.35,0.,abs(across))*smoothstep(size*3.,0.,along)*step(0.,along);
      vec2 r=blot(p,c,size*appear,fk);
      float drip=smoothstep(size*.18,0.,abs(q.x))*step(q.y,0.)*smoothstep(-size*(1.+uSplat*5.*h1(fk+8.)),0.,q.y)*step(.55,h1(fk+9.));
      float k2=max(r.x,max(streak*.8,drip))*appear;
      col=col*(1.-k2)+mix(red,red*.5,r.y)*k2; a=a+k2*(1.-a);
    }
    a*=1.-smoothstep(.7,1.,uSplat)*.0;
  }
  frag=vec4(col,a);
}`;

// the painting, drawn once into a texture (it does not change while it is on the page; only how much of it shows does)
const PAINT_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform sampler2D uNoise; uniform vec2 uSun;
out vec4 frag;
float fbm(vec2 p){ return texture(uNoise,p).r*.5+texture(uNoise,p*2.03+.17).g*.3+texture(uNoise,p*4.1+.41).a*.2; }
float h1(float x){ return fract(sin(x*127.13)*43758.5453); }
${PAINT_LIB}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 asp=uRes/min(uRes.x,uRes.y);
  vec2 cc=(uv-.5)*asp;
  float sunK;
  float d=painting(cc,-asp.x*.5,asp.x*.5,sunK);
  frag=vec4(d,sunK,0.,1.);
}`;

export function createInkOverlay(canvas, noiseURL) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const link = fs => {
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    return pr;
  };
  const prog = link(FS);
  // (the painting's own pass: compiled the first time it is needed)
  let progP = null, uP = null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const L = name => gl.getUniformLocation(prog, name);
  const u = { res: L('uRes'), time: L('uTime'), noise: L('uNoise'), blot: L('uBlot'), blotCol: L('uBlotCol'), flood: L('uFlood'), floodC: L('uFloodC'), floodCol: L('uFloodCol'), floodLift: L('uFloodLift'), drop: L('uDrop'), splat: L('uSplat'), splatSeed: L('uSplatSeed'), stroke: L('uStroke'), sA: L('uStrokeA'), sB: L('uStrokeB'), sC: L('uStrokeC'), sD: L('uStrokeD'), land: L('uLand'), landC: L('uLandC'), sun: L('uSun'), paint: L('uPaint') };
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
  const img = new Image();
  let noiseReady = false;
  img.onload = () => {
    noiseReady = true;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };
  img.src = noiseURL;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let w = 0, h = 0, clearedW = 0, clearedH = 0;
  const blots = new Float32Array(32), cols = new Float32Array(24);
  // the painting, drawn once into a texture at a little more than the overlay's size (the eye pushes into it)
  const ptex = gl.createTexture(), fbo = gl.createFramebuffer();
  let pKey = '', pw = 1, ph = 1;
  function paintCache(sun) {
    const k = Math.min(1.35, 2560 / Math.max(w, h));
    const W2 = Math.max(2, Math.round(w * k)), H2 = Math.max(2, Math.round(h * k));
    const key = `${W2}x${H2}:${sun[0].toFixed(3)},${sun[1].toFixed(3)}:${noiseReady}`;
    if (key === pKey) return;
    pKey = key;
    if (!progP) {
      progP = link(PAINT_FS);
      uP = { res: gl.getUniformLocation(progP, 'uRes'), noise: gl.getUniformLocation(progP, 'uNoise'), sun: gl.getUniformLocation(progP, 'uSun'), time: gl.getUniformLocation(progP, 'uTime'), tall: gl.getUniformLocation(progP, 'uTall') };
    }
    if (W2 !== pw || H2 !== ph) {
      pw = W2; ph = H2;
      gl.bindTexture(gl.TEXTURE_2D, ptex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ptex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, pw, ph);
    gl.disable(gl.BLEND);
    gl.useProgram(progP);
    gl.uniform2f(uP.res, pw, ph);
    gl.uniform2f(uP.sun, sun[0], sun[1]);
    gl.uniform1f(uP.time, 0);
    gl.uniform1f(uP.tall, Math.max(0, ph / pw - 1));
    gl.uniform1i(uP.noise, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
    gl.useProgram(prog);
  }
  return {
    // state: {blots:[{x,y,r,a,col:[r,g,b]}], flood, floodC:[x,y], floodCol, floodLift, drop:[x,y,size,splash], splat, splatSeed}
    render(time, s) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (W !== w || H !== h) { w = canvas.width = W; h = canvas.height = H; }
      const st = s.stroke || null;
      const ld = s.land || null;
      const any = s.blots.some(b => b.a > 0.001) || s.flood > 0.001 || s.drop[2] > 0 || s.splat > 0.001 || (st && st.alpha > 0.001) || (ld && ld.alpha > 0.001);
      // (the canvas stays in the page: hiding and showing it made the browser rebuild its surface each time; with
      // nothing to draw it is cleared once and left)
      if (!any) {
        if (!clearedW || clearedW !== w || clearedH !== h) { gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); clearedW = w; clearedH = h; }
        return;
      }
      clearedW = 0;
      if (ld && ld.alpha > 0.001) paintCache(ld.sun || [0.4, 0.6]);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      blots.fill(0); cols.fill(0);
      s.blots.slice(0, 8).forEach((b, i) => { blots.set([b.x, b.y, b.r, b.a], i * 4); cols.set(b.col || [0.035, 0.032, 0.03], i * 3); });
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.time, time);
      gl.uniform1i(u.noise, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform4fv(u.blot, blots);
      gl.uniform3fv(u.blotCol, cols);
      gl.uniform1f(u.flood, s.flood);
      gl.uniform2f(u.floodC, s.floodC[0], s.floodC[1]);
      gl.uniform3fv(u.floodCol, s.floodCol || [0.035, 0.032, 0.03]);
      gl.uniform1f(u.floodLift, s.floodLift || 0);
      gl.uniform4fv(u.drop, s.drop);
      gl.uniform1f(u.splat, s.splat);
      gl.uniform1f(u.splatSeed, s.splatSeed || 0);
      if (st) {
        gl.uniform4f(u.stroke, st.progress, st.width, st.alpha, st.tail || 0);
        gl.uniform2f(u.sA, ...st.pts[0]); gl.uniform2f(u.sB, ...st.pts[1]); gl.uniform2f(u.sC, ...st.pts[2]); gl.uniform2f(u.sD, ...st.pts[3]);
      } else gl.uniform4f(u.stroke, 0, 0, 0, 0);
      if (ld) {
        gl.uniform4f(u.land, ld.reveal, ld.alpha, ld.clear || 0, ld.zoom || 1);
        gl.uniform2f(u.landC, ...(ld.center || [0.5, 0.5]));
        gl.uniform2f(u.sun, ...(ld.sun || [0.4, 0.6]));
      } else gl.uniform4f(u.land, 0, 0, 0, 1);
      gl.uniform1i(u.paint, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ptex);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

// Brush-written calligraphy: a glyph outline revealed by thick strokes following hand-placed medians. The strokes'
// edges are roughened by turbulence, as a brush's would be; the sign itself keeps its clean outline.
// Done once, not every frame: for each stroke a map of how far along it each point is first reached (the stroke drawn
// with round ends and joins, 190 wide) is computed here, roughened once by the same SVG turbulence the strokes used to
// carry, and kept as a bitmap; writing the sign is then a threshold of those maps, a colour lookup per pixel. (With
// the filter on the strokes themselves the browser re-ran the turbulence every frame of the writing, 0.1–0.5 s a
// frame; and each filter's region, taken from its stroke's centre line, cut the strokes off: the top bar of 玄 was
// never written and its dot was a sliver.)
export function writeGlyph(svg, glyph, medians, { color = '#a3201a', id = 'g' + Math.random().toString(36).slice(2), defer = false } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const VB = [0, -60, 1000, 1060], W = 95;              // viewBox; half the stroke width
  const MW = 800, MH = 848;                              // the maps' size (0.8 px a unit)
  svg.setAttribute('viewBox', VB.join(' '));
  const lens = medians.map(pts => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0));
  const total = lens.reduce((a, b) => a + b, 0);
  const acc = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const defs = document.createElementNS(NS, 'defs');
  const mask = document.createElementNS(NS, 'mask');
  mask.id = id;
  for (const [k, v] of [['maskUnits', 'userSpaceOnUse'], ['x', VB[0] - 100], ['y', VB[1] - 100], ['width', VB[2] + 200], ['height', VB[3] + 200]]) mask.setAttribute(k, v);
  defs.appendChild(mask);
  const shape = document.createElementNS(NS, 'path');
  shape.setAttribute('d', glyph.d);
  shape.setAttribute('fill', color);
  shape.setAttribute('mask', `url(#${id})`);
  svg.append(defs, shape);

  // the map of one stroke: where it is first reached, as a grey (1 at its start, 0.05 at its end, black where never)
  function strokeMap(pts, len) {
    const c = document.createElement('canvas');
    c.width = MW; c.height = MH;
    const g = c.getContext('2d');
    const img = g.createImageData(MW, MH), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    const sx = VB[2] / MW, sy = VB[3] / MH;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const ci0 = Math.max(0, Math.floor((x0 - W - VB[0]) / sx)), ci1 = Math.min(MW - 1, Math.ceil((x1 + W - VB[0]) / sx));
    const cj0 = Math.max(0, Math.floor((y0 - W - VB[1]) / sy)), cj1 = Math.min(MH - 1, Math.ceil((y1 + W - VB[1]) / sy));
    const segs = [];
    let cum = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
      const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey);
      segs.push({ ax, ay, ex, ey, ee: ex * ex + ey * ey, l, cum });
      cum += l;
    }
    for (let j = cj0; j <= cj1; j++) {
      const py = VB[1] + (j + 0.5) * sy;
      for (let i = ci0; i <= ci1; i++) {
        const px = VB[0] + (i + 0.5) * sx;
        let s = -1;
        for (const q of segs) {
          const dx = px - q.ax, dy = py - q.ay, de = dx * q.ex + dy * q.ey, dd = dx * dx + dy * dy - W * W;
          if (q.ee < 1e-9) { if (dd <= 0) { s = q.cum; break; } continue; }
          const disc = de * de - q.ee * dd;
          if (disc < 0) continue;
          const r = Math.sqrt(disc), t1 = (de - r) / q.ee, t2 = (de + r) / q.ee;
          if (t2 < 0 || t1 > 1) continue;
          s = q.cum + Math.max(0, t1) * q.l;
          break;
        }
        if (s < 0) continue;
        const v = Math.round(255 * (1 - 0.95 * Math.min(1, s / len)));
        const o = (j * MW + i) * 4;
        d[o] = d[o + 1] = d[o + 2] = v;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  // roughened once by the turbulence the strokes used to carry (the same noise, in the same units)
  function roughen(url) {
    const src = `<svg xmlns="${NS}" viewBox="${VB.join(' ')}" width="${MW}" height="${MH}"><defs><filter id="d" filterUnits="userSpaceOnUse" x="${VB[0] - 100}" y="${VB[1] - 100}" width="${VB[2] + 200}" height="${VB[3] + 200}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="28"/></filter></defs><rect x="${VB[0] - 100}" y="${VB[1] - 100}" width="${VB[2] + 200}" height="${VB[3] + 200}" fill="#000"/><image href="${url}" x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" preserveAspectRatio="none" filter="url(#d)"/></svg>`;
    return new Promise((res, rej) => {
      const im = new Image();
      const u = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = MW; c.height = MH;
          c.getContext('2d').drawImage(im, 0, 0, MW, MH);
          URL.revokeObjectURL(u);
          c.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('toBlob'))), 'image/png');
        } catch (e) { URL.revokeObjectURL(u); rej(e); }
      };
      im.onerror = e => { URL.revokeObjectURL(u); rej(e); };
      im.src = u;
    });
  }
  // a threshold per stroke: shown where reached by `p` of the way along it (a soft edge of a few grey levels). Only the
  // stroke being written carries its filter, over its own area; a finished stroke shows a ready-made image, no filter.
  const K = 85, M = 24;
  const boxes = medians.map(pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0 - W - M, y0 - W - M, x1 - x0 + 2 * (W + M), y1 - y0 + 2 * (W + M)];
  });
  const layers = medians.map((_, i) => {
    const f = document.createElementNS(NS, 'filter');
    f.id = `${id}t${i}`;
    const [bx, by, bw, bh] = boxes[i];
    for (const [k, v] of [['filterUnits', 'userSpaceOnUse'], ['x', bx], ['y', by], ['width', bw], ['height', bh], ['color-interpolation-filters', 'sRGB']]) f.setAttribute(k, v);
    // (grey to alpha, then white with the threshold on alpha: the strokes' layers add up in the mask)
    const lum = document.createElementNS(NS, 'feColorMatrix');
    lum.setAttribute('type', 'luminanceToAlpha');
    const ct = document.createElementNS(NS, 'feComponentTransfer');
    for (const n of ['feFuncR', 'feFuncG', 'feFuncB']) { const e = document.createElementNS(NS, n); e.setAttribute('type', 'linear'); e.setAttribute('slope', '0'); e.setAttribute('intercept', '1'); ct.appendChild(e); }
    const fa = document.createElementNS(NS, 'feFuncA');
    fa.setAttribute('type', 'linear'); fa.setAttribute('slope', String(K)); fa.setAttribute('intercept', '0');
    ct.appendChild(fa);
    f.append(lum, ct);
    defs.appendChild(f);
    // (two images, both given their maps once they are made and only shown or hidden after: the stroke being
    // written, its map under the threshold; the stroke done, a plain image. Swapping one image's source instead left
    // the stroke blank for a moment while the new one was taken up.)
    const mk = () => {
      const im = document.createElementNS(NS, 'image');
      for (const [k, v] of [['x', VB[0]], ['y', VB[1]], ['width', VB[2]], ['height', VB[3]], ['preserveAspectRatio', 'none']]) im.setAttribute(k, v);
      im.style.display = 'none';
      mask.appendChild(im);
      return im;
    };
    const imW = mk(), imF = mk();
    imW.setAttribute('filter', `url(#${f.id})`);
    return { imW, imF, fa, state: 'off', c: null };
  });
  let want = 0, ready = false;
  function apply(t) {
    const target = Math.max(0, Math.min(1, t)) * total;
    layers.forEach((L, i) => {
      const p = Math.max(0, Math.min(1, (target - acc[i]) / lens[i]));
      const state = p <= 0 ? 'off' : p >= 1 ? 'full' : 'writing';
      if (state !== L.state) {
        L.state = state;
        L.imW.style.display = state === 'writing' ? '' : 'none';
        L.imF.style.display = state === 'full' ? '' : 'none';
      }
      if (state !== 'writing') return;
      // revealed where grey >= 1 - 0.95 p: alpha = K (grey - thr) + 1, clamped
      const c = (1 - K * (1 - 0.95 * p)).toFixed(2);
      if (c !== L.c) { L.fa.setAttribute('intercept', c); L.c = c; }
    });
  }
  // a finished stroke: white where it reached, as the threshold at its end would give
  function fullOf(greyUrl) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = MW; c.height = MH;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(im, 0, 0);
          const img = g.getImageData(0, 0, MW, MH), d = img.data;
          for (let o = 0; o < d.length; o += 4) {
            const a = Math.max(0, Math.min(1, K * (d[o] / 255 - 0.05) + 1));
            d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(a * 255);
          }
          g.putImageData(img, 0, 0);
          c.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('toBlob'))), 'image/png');
        } catch (e) { rej(e); }
      };
      im.onerror = rej;
      im.src = greyUrl;
    });
  }
  // made at once (the page is loading), or when asked for (`defer`); until they are ready nothing is shown, then
  // whatever was asked for last
  let made = null;
  const prepare = () => made || (made = (async () => {
    try {
      const greys = await Promise.all(medians.map((pts, i) => roughen(strokeMap(pts, lens[i]))));
      const fulls = await Promise.all(greys.map(fullOf));
      // (decoded now, so showing them later costs nothing)
      await Promise.all([...greys, ...fulls].map(u => { const im = new Image(); im.src = u; return im.decode().catch(() => {}); }));
      layers.forEach((L, i) => { L.imW.setAttribute('href', greys[i]); L.imF.setAttribute('href', fulls[i]); });
      ready = true;
      apply(want);
    } catch (e) { console.warn('glyph maps', e); }
  })());
  if (!defer) prepare();
  return {
    // progress 0..1 across all strokes in order
    set(t) { want = t; if (ready) apply(t); },
    // where each stroke begins and ends, as progress
    bounds: lens.map((l, i) => [acc[i] / total, (acc[i] + l) / total]),
    // the maps made (resolves once they are; starts making them if they were deferred)
    prepare,
  };
}
