/* 5312 Samels Rd site model — plain three.js r128 (non-module, works from file://) */
(function(){
const S=window.SITE, CX=389, CY=264;            // world x = bx-CX (east), z = by-CY (south), y = elevation ft - BASE
const NX=S.grid[0].length, NY=S.grid.length;
let BASE=1e9; S.grid.forEach(r=>r.forEach(v=>BASE=Math.min(BASE,v))); BASE-=2;
const W=x=>x-CX, Zs=y=>y-CY;
function rawElev(x,z){ // bilinear on USGS samples (dense patch near the guest suite)
  const D=S.dense; if(D){const gx=(x-D.x0)/D.dx,gy=(z-D.z0)/D.dz,nx=D.g[0].length,ny=D.g.length; if(gx>=0&&gy>=0&&gx<=nx-1&&gy<=ny-1){const i=Math.min(nx-2,Math.floor(gx)),j=Math.min(ny-2,Math.floor(gy)),fx=gx-i,fy=gy-j,q=D.g;return (q[j][i]*(1-fx)+q[j][i+1]*fx)*(1-fy)+(q[j+1][i]*(1-fx)+q[j+1][i+1]*fx)*fy-BASE;}}
  let gx=(x+CX)/S.bboxW*(NX-1), gy=(z+CY)/S.bboxH*(NY-1);
  gx=Math.max(0,Math.min(NX-1.001,gx)); gy=Math.max(0,Math.min(NY-1.001,gy));
  const i=Math.floor(gx),j=Math.floor(gy),fx=gx-i,fy=gy-j,g=S.grid;
  return (g[j][i]*(1-fx)+g[j][i+1]*fx)*(1-fy)+(g[j+1][i]*(1-fx)+g[j+1][i+1]*fx)*fy-BASE;
}
const flats=[]; // {x0,x1,z0,z1,y}
function elev(x,z){for(const f of flats) if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1) return f.y; return rawElev(x,z);}

// ---------- renderer ----------
const canvas=document.getElementById('c3d');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio));
const scene=new THREE.Scene(); window.__scene=scene; scene.background=new THREE.Color(0x9cc0de); scene.fog=new THREE.Fog(0xd8e3ea,550,1700);
{const sg=new THREE.SphereGeometry(5000,32,16);const sm=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color(0x3f78b8)},mid:{value:new THREE.Color(0x9cc0de)},bot:{value:new THREE.Color(0xdfe7ea)}},
  vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 top;uniform vec3 mid;uniform vec3 bot;varying vec3 vp;void main(){float h=vp.y;vec3 c=h>0.15?mix(mid,top,smoothstep(0.15,0.7,h)):mix(bot,mid,smoothstep(-0.05,0.15,h));gl_FragColor=vec4(c,1.0);}'});
 const sky=new THREE.Mesh(sg,sm);sky.renderOrder=-1;scene.add(sky);window.__sky=sky;
 const cc=document.createElement('canvas');cc.width=cc.height=256;const cg=cc.getContext('2d');for(let i=0;i<14;i++){const x=60+Math.random()*136,y=100+Math.random()*60,r=30+Math.random()*40;const gr=cg.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,0.9)');gr.addColorStop(1,'rgba(255,255,255,0)');cg.fillStyle=gr;cg.fillRect(0,0,256,256);}
 const ct=new THREE.CanvasTexture(cc);for(let i=0;i<14;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:0.85,fog:false,depthWrite:false}));const a=i/14*Math.PI*2+Math.random()*0.4,r=1500+Math.random()*1300;sp.position.set(Math.cos(a)*r-150,520+Math.random()*380,Math.sin(a)*r);const sc=700+Math.random()*700;sp.scale.set(sc,sc*0.45,1);scene.add(sp);}}
const camera=new THREE.PerspectiveCamera(55,1,0.8,6000);
scene.add(new THREE.HemisphereLight(0xf4f7ff,0x6a6650,0.78));scene.add(new THREE.AmbientLight(0xffffff,0.2));
const sun=new THREE.DirectionalLight(0xfff4e2,0.85); sun.position.set(-300,500,400); scene.add(sun);

const LAYERS={site:'Site features (pond, well, septic, propane, firepit)',bldg:'Buildings (exteriors)',house:'House interior (inferred plan)',barn:'Pole barn: Airstream Interstate 24X van, pontoon, bench',gym:'Gym barn: owned + proposed gear',elec:'Electrical callouts',solar:'Solar candidates',plan:'Setbacks + ADU spot',trees:'Trees (illustrative)',future:'Future (2+ yrs): guest suite',cars:'Vehicles: garage cars + barn fit',optA:'Small-section door: Option A (replace swing door, front)',optB:'Small-section door: Option B (new rear door, keep swing door)',tandem:'Barn fit variant: tandem 911 + Model Y (smaller section)',nowall:'Barn fit variant: divider removed (only if non-structural; no structural work)',net:'Network: UniFi APs + bridges',netcov:'Network coverage (approx. circles)',cams:'Ring cameras + doorbell',camcov:'Camera view cones',smart:'Smart locks, thermostats, myQ'};
const groups={}; for(const k in LAYERS){groups[k]=new THREE.Group();scene.add(groups[k]);} window.groups=groups;
const TAGS={photo:['seen in photo','t-photo'],sat:['satellite','t-sat'],rec:['public record','t-rec'],inf:['inferred','t-inf'],prop:['proposed','t-prop'],own:['owned – Seabreeze inventory','t-own'],pnew:['proposed new','t-prop'],future:['future (2+ yrs)','t-fut']};
const items=[], colliders=[], surfaces=[], pickables=[], extWalls=[], roofs=[], occl=[], panes=[], softMats=[], softLines=[];
// ---------- procedural textures (grayscale, tinted by material color) ----------
function ctex(sz,draw){const c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d');draw(g,sz);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
const TEX={
 siding:ctex(256,(g,n)=>{g.fillStyle='#fff';g.fillRect(0,0,n,n);for(let i=0;i<8;i++){const y=i*n/8;const gr=g.createLinearGradient(0,y,0,y+n/8);gr.addColorStop(0,'#d9d9d9');gr.addColorStop(0.15,'#ffffff');gr.addColorStop(1,'#eeeeee');g.fillStyle=gr;g.fillRect(0,y,n,n/8);g.fillStyle='#a8a8a8';g.fillRect(0,y,n,2);}}),
 rib:ctex(256,(g,n)=>{g.fillStyle='#f4f4f4';g.fillRect(0,0,n,n);for(let i=0;i<4;i++){const x=i*n/4;g.fillStyle='#c4c4c4';g.fillRect(x,0,6,n);g.fillStyle='#ffffff';g.fillRect(x+6,0,3,n);}}),
 seam:ctex(256,(g,n)=>{g.fillStyle='#e6e6e6';g.fillRect(0,0,n,n);for(let i=0;i<3;i++){const x=i*n/3;g.fillStyle='#ffffff';g.fillRect(x,0,4,n);g.fillStyle='#9a9a9a';g.fillRect(x+4,0,3,n);}}),
 plank:ctex(512,(g,n)=>{let r=7;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647;};const pw=n/8;for(let i=0;i<8;i++){let y=0;while(y<n){const L=n*(0.35+rnd()*0.5);const v=225+Math.floor(rnd()*30);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(i*pw,y,pw,L);g.fillStyle='rgba(0,0,0,0.25)';g.fillRect(i*pw,y,pw,1.5);y+=L;}g.fillStyle='rgba(0,0,0,0.3)';g.fillRect(i*pw,0,1.5,n);}}),
 tile:ctex(256,(g,n)=>{g.fillStyle='#fafafa';g.fillRect(0,0,n,n);g.fillStyle='#cfcfcf';for(let i=0;i<2;i++){g.fillRect(0,i*n/2,n,2);g.fillRect(i*n/2,0,2,n);}}),
 deck:ctex(256,(g,n)=>{for(let i=0;i<10;i++){const v=200+(i*37%40);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(i*n/10,0,n/10,n);g.fillStyle='#555';g.fillRect(i*n/10,0,2,n);}})};
window.__TEX=TEX;function texMat(m,key,ru,rv){const t=TEX[key].clone();t.needsUpdate=true;t.repeat.set(ru,rv);m.map=t;m.needsUpdate=true;}
const soft=t=>t==='inf'||t==='prop'||t==='pnew'||t==='future';
function mat(color,tag,extra){
  const m=new THREE.MeshLambertMaterial(Object.assign({color},extra||{}));
  if(soft(tag)){m.transparent=true;m.opacity=0.5;m.depthWrite=false;softMats.push({m,tag});}
  return m;
}
function edges(mesh,tag){
  const g=new THREE.EdgesGeometry(mesh.geometry);
  const lm=soft(tag)?new THREE.LineDashedMaterial({color:tag==='inf'?0xffb0a0:tag==='future'?0xd7a6ff:0x9fffb0,dashSize:1.2,gapSize:0.8}):new THREE.LineBasicMaterial({color:0x222222,transparent:true,opacity:.5});
  const l=new THREE.LineSegments(g,lm); l.computeLineDistances(); mesh.add(l); l.userData.soft=soft(tag)&&tag!=='future'; softLines.push(l);
}
function item(o){ // register label/info item
  o.tag=o.tag||'inf'; items.push(o); return o;
}
function box(layer,x,y,z,w,h,d,color,tag,it,opt){ // x,z = center; y = bottom
  opt=opt||{};
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,tag,opt.mat));
  m.position.set(x,y+h/2,z); if(opt.rotY) m.rotation.y=opt.rotY;
  groups[layer].add(m); if(opt.edges!==false) edges(m,tag);
  if(it){m.userData.item=it; pickables.push(m);}
  if(opt.collide) colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y,y1:y+h});
  return m;
}
function cyl(layer,x,y,z,r,h,color,tag,it,horiz){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat(color,tag));
  if(horiz){m.rotation.z=Math.PI/2;m.position.set(x,y+r,z);} else m.position.set(x,y+h/2,z);
  groups[layer].add(m); edges(m,tag); if(it){m.userData.item=it;pickables.push(m);} return m;
}
function line(layer,pts,color,tag,dy){ // pts [[x,z],...] draped on terrain
  const v=[]; for(let k=0;k<pts.length-1;k++){const [a,b]=[pts[k],pts[k+1]];const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);
    for(let s=0;s<=n;s++){const x=a[0]+(b[0]-a[0])*s/n,z=a[1]+(b[1]-a[1])*s/n;v.push(new THREE.Vector3(x,elev(x,z)+(dy||0.6),z));}}
  const g=new THREE.BufferGeometry().setFromPoints(v);
  const m=soft(tag)?new THREE.LineDashedMaterial({color,dashSize:3,gapSize:2,linewidth:2}):new THREE.LineBasicMaterial({color});
  const l=new THREE.Line(g,m); l.computeLineDistances(); groups[layer].add(l); return l;
}
function ribbon(layer,pts,width,color,dy){ // flat strip draped on terrain (driveway / road)
  const pos=[],idx=[];let n=0;
  for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(L/4);
    const nx=-(b[1]-a[1])/L*width/2,nz=(b[0]-a[0])/L*width/2;
    for(let s=0;s<=steps;s++){const x=a[0]+(b[0]-a[0])*s/steps,z=a[1]+(b[1]-a[1])*s/steps;
      pos.push(x+nx,elev(x+nx,z+nz)+(dy||.35),z+nz,x-nx,elev(x-nx,z-nz)+(dy||.35),z-nz);
      if(n>0)idx.push(2*n-2,2*n-1,2*n,2*n-1,2*n+1,2*n);n++;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));groups[layer].add(m);return m;
}
// walls along axis-aligned line with door gaps (gaps in distance along the line from start)
const GLASS=new THREE.MeshPhongMaterial({color:0x9fc4d6,transparent:true,opacity:0.22,shininess:120,specular:0xffffff,depthWrite:false});
const FRAME=new THREE.MeshLambertMaterial({color:0x1d1f22});
const sid=0xcfcabd, trim=0x2a2a2a, roofC=0x4a5058, tan=0xd8d2bc, beige=0xd7cfb4;
function wall(layer,x0,z0,x1,z1,y0,h,color,tag,gaps,isExt){
  const dx1=x1-x0,dz1=z1-z0;const L=Math.hypot(x1-x0,z1-z0),dx=(x1-x0)/L,dz=(z1-z0)/L,t=0.5;
  gaps=(gaps||[]).slice().sort((a,b)=>a[0]-b[0]);let s=0;const segs=[];
  for(const g of gaps){if(g[0]>s)segs.push([s,g[0]]);
    // header above door
    if(g[2]!==undefined && g[2]<h){const a=g[0],b=g[1],cx=x0+dx*(a+b)/2,cz=z0+dz*(a+b)/2;
      const m=box(layer,cx,y0+g[2],cz,Math.abs(dx)*(b-a)+Math.abs(dz)*t,h-g[2],Math.abs(dz)*(b-a)+Math.abs(dx)*t,color,tag,null,{edges:false}); if(isExt)extWalls.push(m); occl.push(m); wtex(m,b-a,h-g[2]);}
    if(g[3]!==undefined){const a=g[0],b=g[1],cx=x0+dx*(a+b)/2,cz=z0+dz*(a+b)/2,L2=b-a,W2=Math.abs(dx)*L2,D2=Math.abs(dz)*L2;
      const sm=box(layer,cx,y0,cz,W2+Math.abs(dz)*t,g[3],D2+Math.abs(dx)*t,color,tag,null,{collide:true,edges:false}); if(isExt)extWalls.push(sm); occl.push(sm); wtex(sm,L2,g[3]);
      const top=g[2]!==undefined?g[2]:h, gh=top-g[3];
      const pane=new THREE.Mesh(new THREE.BoxGeometry(W2+Math.abs(dz)*0.08,gh,D2+Math.abs(dx)*0.08),GLASS);pane.position.set(cx,y0+g[3]+gh/2,cz);groups[layer].add(pane);panes.push(pane);
      colliders.push({x0:cx-W2/2-Math.abs(dz)*0.3,x1:cx+W2/2+Math.abs(dz)*0.3,z0:cz-D2/2-Math.abs(dx)*0.3,z1:cz+D2/2+Math.abs(dx)*0.3,y0:y0+g[3],y1:y0+top});
      // black frame: head, sill, jambs, mullion
      const fr=(fx,fy,fz,fw,fh,fd)=>{const f=new THREE.Mesh(new THREE.BoxGeometry(fw,fh,fd),FRAME);f.position.set(fx,fy,fz);groups[layer].add(f);};
      const tw=t+0.12;fr(cx,y0+g[3]+0.12,cz,W2+Math.abs(dz)*tw,0.24,D2+Math.abs(dx)*tw);fr(cx,y0+top-0.1,cz,W2+Math.abs(dz)*tw,0.2,D2+Math.abs(dx)*tw);
      for(const e of [-1,1]){fr(cx+dx*e*(L2/2-0.1),y0+g[3]+gh/2,cz+dz*e*(L2/2-0.1),Math.abs(dx)*0.2+Math.abs(dz)*tw,gh,Math.abs(dz)*0.2+Math.abs(dx)*tw);}
      if(L2>3.5)fr(cx,y0+g[3]+gh/2,cz,Math.abs(dx)*0.12+Math.abs(dz)*tw,gh,Math.abs(dz)*0.12+Math.abs(dx)*tw);}
    s=g[1];}
  if(s<L)segs.push([s,L]);
  for(const [a,b] of segs){const cx=x0+dx*(a+b)/2,cz=z0+dz*(a+b)/2,len=b-a;
    const m=box(layer,cx,y0,cz,Math.abs(dx)*len+Math.abs(dz)*t,h,Math.abs(dz)*len+Math.abs(dx)*t,color,tag,null,{collide:true,edges:false});
    if(isExt)extWalls.push(m); occl.push(m); if(isExt)wtex(m,len,h);}
  function wtex(m,len,hh){if(!isExt)return;if(color===sid){const mm=m.material;const k0=(color===sid)?'siding':'rib';texMat(mm,k0,Math.max(0.2,len/5),Math.max(0.2,hh/5));const inner=new THREE.MeshLambertMaterial({color:0xefebe4});const p=m.position;const inG=p.z<H.z0-32.6;const cx=inG?H.x0+17:H.x0+17,cz=inG?H.z0-44:H.z0-16;const dx=cx-p.x,dz=cz-p.z;const horiz=Math.abs(dx1)>Math.abs(dz1);let face;if(horiz)face=(dz>0?4:5);else face=(dx>0?0:1);const arr=[mm,mm,mm,mm,mm,mm];arr[face]=inner;m.material=arr;m.userData.mm=mm;return;}const k=(color===sid)?'siding':(color===tan||color===beige||color===0xc8b896)?'rib':null;if(k)texMat(m.material,k,Math.max(0.2,len/5),Math.max(0.2,hh/5));}
}
function gableRoof(layer,x0,z0,w,d,yEave,rise,ridgeAlongX,color,overhang,inner){ // footprint corner x0,z0 (min x, min z); two sloped planes + interior ceiling
  overhang=overhang||1.5;const span=ridgeAlongX?d:w, len=ridgeAlongX?w:d, half=span/2, drop=overhang*rise/half;
  // local coords: a = along ridge (0..len+2oh), b = across (-half-oh..half+oh)
  const ye=yEave-drop, yr=yEave+rise, slope=Math.hypot(half+overhang,rise+drop);
  const P=(a,b,y)=>ridgeAlongX?[x0-overhang+a,y,z0+d/2+b]:[x0+w/2+b,y,z0-overhang+a];
  const A=len+2*overhang, B=half+overhang;
  const pos=[...P(0,-B,ye),...P(A,-B,ye),...P(A,0,yr),...P(0,0,yr), ...P(0,0,yr),...P(A,0,yr),...P(A,B,ye),...P(0,B,ye)];
  const uv=[0,0,A/4,0,A/4,slope/4,0,slope/4, 0,slope/4,A/4,slope/4,A/4,0,0,0];
  let idx=[0,1,2,0,2,3,4,5,6,4,6,7];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  // make sure normals point up
  const v=k=>new THREE.Vector3(pos[k*3],pos[k*3+1],pos[k*3+2]);const n=new THREE.Vector3().crossVectors(v(1).sub(v(0)),v(2).sub(v(0)));
  if(n.y<0)idx=[0,2,1,0,3,2,4,6,5,4,7,6];const n2=new THREE.Vector3().crossVectors(v(5).sub(v(4)),v(6).sub(v(4)));
  if((n.y<0)!==(n2.y<0)){idx=n.y<0?[0,2,1,0,3,2,4,5,6,4,6,7]:[0,1,2,0,2,3,4,6,5,4,7,6];}
  g.setIndex(idx);g.computeVertexNormals();
  const om=new THREE.MeshLambertMaterial({color,side:THREE.FrontSide});texMat(om,'seam',1,1);
  const m=new THREE.Mesh(g,om);groups[layer].add(m);roofs.push(m);occl.push(m);
  const imM=new THREE.MeshLambertMaterial({color:inner||(color===roofC?0xdcaa6e:0xc9ccd0),side:THREE.BackSide});if(!inner&&color===roofC)texMat(imM,'plank',0.55,1.4);const im=new THREE.Mesh(g,imM);im.position.y=-0.25;groups[layer].add(im);roofs.push(im);m.userData.inner=im;
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:0x1a1a1a,transparent:true,opacity:.6}));m.add(e);
  return m;
}
function gableEnds(layer,x0,z0,w,d,yEave,rise,ridgeAlongX,color){ // triangular infill on gable walls
  const span=ridgeAlongX?d:w;const sh=new THREE.Shape();sh.moveTo(-span/2,0);sh.lineTo(span/2,0);sh.lineTo(0,rise);sh.lineTo(-span/2,0);
  const g=new THREE.ShapeGeometry(sh);
  for(const e of [0,1]){const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));
    if(ridgeAlongX){m.rotation.y=Math.PI/2;m.position.set(x0+(e?w:0),yEave,z0+d/2);}else m.position.set(x0+w/2,yEave,z0+(e?d:0));
    groups[layer].add(m);roofs.push(m);occl.push(m);}
}
function flat(x0,z0,x1,z1,y){flats.push({x0:Math.min(x0,x1)-3,x1:Math.max(x0,x1)+3,z0:Math.min(z0,z1)-3,z1:Math.max(z0,z1)+3,y});}
function surf(x0,z0,x1,z1,y){surfaces.push({x0:Math.min(x0,x1),x1:Math.max(x0,x1),z0:Math.min(z0,z1),z1:Math.max(z0,z1),y});}
function floor(layer,x0,z0,x1,z1,y,color,tag,walk){
  const m=box(layer,(x0+x1)/2,y-0.3,(z0+z1)/2,Math.abs(x1-x0),0.3,Math.abs(z1-z0),color,tag||'inf',null,{edges:false});
  if(walk!==false)surf(x0,z0,x1,z1,y);occl.push(m);return m;}
function floorT(layer,x0,z0,x1,z1,y,color,tag,tex,ceil){const m=floor(layer,x0,z0,x1,z1,y,color,tag);const top=m.material;texMat(top,tex,Math.abs(x1-x0)/8,Math.abs(z1-z0)/8);
  if(ceil){const cm=new THREE.MeshLambertMaterial({color:ceil});m.material=[top,top,top,cm,top,top];}return m;
}
// building local frame: (u east, v north) from SW corner
function frame(bx,by,y){const x0=W(bx),z0=Zs(by);return {x0,z0,y,P:(u,v)=>[x0+u,z0-v]};}
function lbox(layer,F,u0,v0,u1,v1,h,color,tag,it,y0,opt){const [x,z]=F.P((u0+u1)/2,(v0+v1)/2);
  const m=box(layer,x,F.y+(y0||0),z,Math.abs(u1-u0),h,Math.abs(v1-v0),color,tag,it,opt);
  if(it&&!it.pos){it.pos=[x,F.y+(y0||0)+h+1,z];} return m;}
function lwall(layer,F,u0,v0,u1,v1,y0,h,color,tag,gaps,isExt){const a=F.P(u0,v0),b=F.P(u1,v1);wall(layer,a[0],a[1],b[0],b[1],F.y+y0,h,color,tag,gaps,isExt);}
function railing(layer,a,b,y,col){col=col||0x5a3f2c;const L=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/L,dz=(b[1]-a[1])/L,M=new THREE.MeshLambertMaterial({color:col});
  const add=(x,yy,z,w,h,d)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M);m.position.set(x,yy,z);groups[layer].add(m);return m;};
  const np=Math.max(1,Math.round(L/6));for(let i=0;i<=np;i++){const t=i/np*L;add(a[0]+dx*t,y+1.75,a[1]+dz*t,0.33,3.5,0.33);}
  add(a[0]+dx*L/2,y+3.45,a[1]+dz*L/2,Math.abs(dx)*L+0.45,0.15,Math.abs(dz)*L+0.45);add(a[0]+dx*L/2,y+0.35,a[1]+dz*L/2,Math.abs(dx)*L+0.2,0.12,Math.abs(dz)*L+0.2);
  const nb=Math.floor(L/0.42),bg=new THREE.BoxGeometry(0.12,3,0.12),im=new THREE.InstancedMesh(bg,M,nb),o=new THREE.Object3D();
  for(let i=0;i<nb;i++){const t=(i+0.5)*L/nb;o.position.set(a[0]+dx*t,y+1.9,a[1]+dz*t);o.updateMatrix();im.setMatrixAt(i,o.matrix);}groups[layer].add(im);
  colliders.push({x0:Math.min(a[0],b[0])-0.2,x1:Math.max(a[0],b[0])+0.2,z0:Math.min(a[1],b[1])-0.2,z1:Math.max(a[1],b[1])+0.2,y0:y,y1:y+3.5});}
function info(name,tag,text,pos,extra){return item(Object.assign({name,tag,text,pos},extra||{}));}

// ================= PRE-COMPUTE BUILDING FRAMES & FLATTEN TERRAIN =================
// House chalet 34 (E-W) x 32 (N-S), SW corner at bbox (263,308); attached garage 24x24 north
const HM=rawElev(W(263),Zs(292))+1.5;             // main floor ≈ 1.5 ft above grade at the west wall (inferred)
const H=frame(263,308,HM), HL=HM-9;               // HL = walk-out lower level
flat(H.x0,H.z0,H.x0+34,H.z0-32,HL-0.2);
const SU=frame(243,308,HM); flat(SU.x0-7,SU.z0,SU.x0+20,SU.z0-28,HM-1.2);   // future guest suite 20x28 (crawlspace) flat(H.x0+5,H.z0-32,H.x0+29,H.z0-56,HM-0.2);
// Pole barn 32 (E-W) x 38 (N-S), doors on south gable end
const PBy=rawElev(W(236),Zs(87)); const PB=frame(220,106,PBy); flat(PB.x0,PB.z0+12,PB.x0+32,PB.z0-38,PBy-0.15);
// Second garage / gym 28 x 30, overhead door on east wall
const GYy=rawElev(W(168),Zs(165)); const GY=frame(154,180,GYy); flat(GY.x0,GY.z0+8,GY.x0+28,GY.z0-38,GYy-0.15);
const SHy=rawElev(W(221),Zs(225)); const SH=frame(216,231,SHy); flat(SH.x0,SH.z0,SH.x0+10,SH.z0-12,SHy-0.1);

// ================= TERRAIN =================
const tex=new THREE.TextureLoader().load(window.SAT_IMG); tex.anisotropy=8;
const tg=new THREE.PlaneGeometry(S.bboxW,S.bboxH,156,106); tg.rotateX(-Math.PI/2); tg.translate(S.bboxW/2-CX,0,S.bboxH/2-CY);
const tp=tg.attributes.position; for(let k=0;k<tp.count;k++){tp.setY(k,elev(tp.getX(k),tp.getZ(k)));} tg.computeVertexNormals();
const satMat=new THREE.MeshLambertMaterial({map:tex}), plainMat=new THREE.MeshLambertMaterial({color:0x6f8a52});
const terrain=new THREE.Mesh(tg,satMat); scene.add(terrain);
const outer=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x56703c}));outer.position.y=-8;scene.add(outer);
// parcel line (county GIS)
line('site',S.ring.map(p=>[W(p[0]),Zs(p[1])]),0xffe14a,'rec',1.2);
info('Parcel 13-002-015-25 (6.00 ac)','rec','Grand Traverse County TaxParcel layer. Legal: S 878.39 ft from W¼ corner Sec 2 T27N R9W; E 698.62 ft; S 412.78 ft; W 698.61 ft; N to POB, exc. road R/W. Zoning A1-AG. Shape is a true ~698 × 413 ft rectangle running east–west. Elevations: USGS 3DEP point samples, ~40 ft of relief, lowest toward the east-center.',[W(700),rawElev(W(700),Zs(70))+12,Zs(70)]);
// setbacks (front = road/west 30, rear = east 30, sides 15)
{const r=S.ring,xw=W(41)+30,xe=W(737)-30,zn=Zs(62)+15,zs=Zs(470)-15;
 line('plan',[[xw,zn],[xe,zn],[xe,zs],[xw,zs],[xw,zn]],0xff9a3c,'inf',1);
 info('Setback envelope','rec','A-1 dimensional table: front 30 ft, side 15 ft, rear 30 ft, max height 35 ft. Line drawn assuming the west line on Samels Rd is the front. Confirm with the zoning administrator.',[xw,elev(xw,zn)+8,zn+40]);}

// ================= ROADS / DRIVE =================
const road=[[W(23),Zs(0)],[W(23),Zs(528)]]; ribbon('site',road,18,0xb8a78a,.3);
info('Samels Rd (private gravel road)','sat','Seen on satellite; listing: private gravel road, privately maintained. Annual "HOA" fee likely a road association fee (unverified). Confirm winter plowing.',[W(23),rawElev(W(23),Zs(150))+8,Zs(150)]);
const drive=[[W(32),Zs(68)],[W(140),Zs(70)],[W(190),Zs(76)],[W(236),Zs(112)],[W(250),Zs(148)],[W(268),Zs(205)],[W(278),Zs(240)]];
ribbon('site',drive,12,0x4a4a4c,.4);
ribbon('site',[[W(252),Zs(160)],[W(205),Zs(166)],[W(183),Zs(166)]],10,0x8a8070,.38);
info('Paved driveway','photo','Asphalt drive seen in p03/p04/p60 and on satellite; links house garage, pole-barn apron and the access lane west to Samels Rd. Exact route to the road is read from imagery (satellite).',[W(245),rawElev(W(245),Zs(135))+6,Zs(135)]);

// ================= HOUSE =================

// lower level (walk-out): exterior walls; east wall has sliders
lwall('bldg',H,0,0,34,0,-9,9,sid,'photo',[[3,7,6.8,3],[22,26,6.8,3.4]],true);
lwall('bldg',H,0,32,34,32,-9,9,sid,'photo',[[5,9,6.8,3],[24,28,6.8,3]],true);
lwall('bldg',H,0,0,0,32,-9,9,0x9a958a,'photo',[],true);
lwall('bldg',H,34,0,34,32,-9,9,sid,'photo',[[4,6.5,6.8],[9,12,6.8,3],[16,26,7]],true);
// main level
lwall('bldg',H,0,0,34,0,0,9,sid,'photo',[[3,7,6.8,3],[20,24,6.8,3],[28,31,6.8,3]],true);
lwall('bldg',H,0,32,34,32,0,9,sid,'photo',[[3,7,6.8,3],[16,19,6.8],[23,27,6.8,3.4]],true);    // door to garage
lwall('bldg',H,0,0,0,32,0,9,sid,'photo',[[4,8,6.8,3],[13,16,6.8,3.5],[22,25,6.8]],true);   // opening = future pass-through
lwall('bldg',H,34,0,34,32,0,9,sid,'photo',[[1,7,8.4,1.2],[8,24,7.5],[25,31,8.4,1.2]],true);  // glass gable + sliders to deck
gableRoof('bldg',H.x0,H.z0-32,34,32,HM+9,20,true,roofC,2); gableEnds('bldg',H.x0,H.z0-32,34,32,HM+9,20,true,sid);
// main floor with a stair opening (u12.5-16.5, v12.5-19.5); light oak (modern remodel)
for(const [u0,v0,u1,v1] of [[0,0,34,12.5],[0,19.5,34,32],[0,12.5,12.5,19.5],[16.5,12.5,34,19.5]]){const a=H.P(u0,v0),b=H.P(u1,v1);floorT('house',a[0],a[1],b[0],b[1],HM,0xe2cfae,'photo','plank',0xf3efe6);}
floorT('house',H.x0,H.z0,H.x0+34,H.z0-32,HL,0xd9ccb6,'photo','plank');
info('House — 1997 chalet (1.5 story + walk-out)','photo','Seen: steep metal roof, vaulted pine ceilings, glass east gable, wraparound deck, landscaped pond in front (p01-p36). Record: 1,480 sf above grade + 900 sf lower; 4 bd / 2 full + 1 ¾ bath; propane forced air, central air; built 1997 (permit 1996). Footprint 34 × 32 ft is estimated from satellite.',[H.x0+17,HM+31,H.z0-16]);
// deck (east) + stair to grade
floorT('bldg',H.x0+34,H.z0,H.x0+44,H.z0-32,HM,0x8a6242,'photo','deck',0xd8d2c8);
for(const [u0,v] of [[44,0],[44,32]]){} // rails
railing('bldg',H.P(44,0),H.P(44,13),HM);railing('bldg',H.P(44,17),H.P(44,32),HM);railing('bldg',H.P(34,0),H.P(44,0),HM);railing('bldg',H.P(34,32),H.P(44,32),HM);
{const gy=rawElev(H.x0+52,H.z0-15);const steps=Math.max(1,Math.round((HM-gy)/0.6));for(let s=1;s<=steps;s++){const y=HM-s*(HM-gy)/steps,x=H.x0+44+s*0.9;floor('bldg',x-0.9,H.z0-13,x,H.z0-17,y,0x6a4a30,'inf');}}
{const gy=rawElev(H.x0+52,H.z0-15);const steps=Math.max(1,Math.round((HM-gy)/0.6));const run=steps*0.9,len=Math.hypot(run,HM-gy),ang=Math.atan2(HM-gy,run);for(const zz of [H.z0-13.1,H.z0-16.9]){const st=new THREE.Mesh(new THREE.BoxGeometry(len,0.9,0.2),new THREE.MeshLambertMaterial({color:0x5a4030}));st.position.set(H.x0+44+run/2,(HM+gy)/2-0.6,zz);st.rotation.z=-ang;groups.bldg.add(st);}}
info('Deck (cable-free wood rail)','photo','Seen p09, p33-p36: covered wraparound deck on the east (pond) side, main-floor level. Stairs to grade are inferred.',[H.x0+40,HM+5,H.z0-30]);
// main level rooms (inferred from photos)
const iw=0xf1eee8;
lwall('house',H,0,12,12,12,0,8,iw,'inf',[[8,11]]); lwall('house',H,12,0,12,12,0,8,iw,'inf',[]);
lwall('house',H,0,20,12,20,0,8,iw,'inf',[[4.4,6.9,6.8],[8,11]]); lwall('house',H,12,20,12,32,0,8,iw,'inf',[]);
lwall('house',H,8,12,8,20,0,8,iw,'inf',[[3,6]]);
const STAIR_INFO=info('Stairs (main ↔ loft ↔ lower)','photo','Stair seen p19. Location inferred. Press L in walk mode to change level.');
lbox('house',H,17,30,34,32,3,0xf2f2f2,'photo',info('Kitchen — white cabinets, stainless','photo','Seen p05, p06, p10, p17, p18. Layout position inferred (north side, near garage entry).'),0);
lbox('house',H,1,1,7,8,0.04,0x6d5a4a,'inf',info('Office (main bedroom 1)','inf','Smaller main-floor bedroom → pure office. 2 bedrooms on main per listing; placement inferred.'),0);
lbox('house',H,1,24,7,31,0.04,0x6d5a4a,'inf',info('Office / guest (futon) — main bedroom 2','inf','Larger main-floor bedroom (sellers\' master) with a direct door to the main bath → office + guest overflow. Placement inferred.'),0);
lbox('house',H,1,13,7,19,0.04,0xbfd7e0,'inf',info('Full bath (main)','photo','Bath seen p27/p28; placement inferred.'),0);
// loft (visual only)
lbox('house',H,0,0,14,32,0.4,0xd9c7a6,'photo',info('Loft: bedroom 3 + ¾ bath','photo','Upper bedroom with skylights seen p21-p26 (pine ceiling). Walkable in v2 (stairs or the Loft level button). Headroom is limited near the north/south eaves.'),9,{edges:true});
// lower level rooms
lwall('house',H,0,12,34,12,-9,8,iw,'inf',[[8,11],[14,16.5],[26,29]]);
lwall('house',H,12,0,12,12,-9,8,iw,'inf',[]); lwall('house',H,18,0,18,12,-9,8,iw,'inf',[]);
lbox('house',H,2,2,8,9,0.04,0x6d5a4a,'inf',info('Lower bedroom 4','photo','Seen p43/p44 (blue walls, French doors). Placement inferred.'),-9);
lbox('house',H,13,1,17,5,0.04,0xbfd7e0,'inf',info('Lower ¾ bath','photo','Seen p45/p46.'),-9);
lbox('house',H,19,1,33,11,0.04,0xd0d0d0,'photo',info('Laundry / mechanical / storage','photo','Seen p55-p56: propane furnace, water heater, shelving. Main panel is probably here — not shown in any photo.'),-9);

// attached garage 24x24 (record) — door north
const G=frame(263+5,308-32,HM);
lwall('bldg',G,0,0,0,24,0,9,sid,'rec',[[8,11,6.8]],true); lwall('bldg',G,24,0,24,24,0,9,sid,'rec',[],true);
lwall('bldg',G,0,24,24,24,0,9,sid,'rec',[[4,20,7]],true);
lwall('bldg',G,0,0,5,0,0,9,sid,'rec',[],true);
gableRoof('bldg',G.x0,G.z0-24,24,24,HM+9,7,false,roofC,1.5,0xc9ccd0); gableEnds('bldg',G.x0,G.z0-24,24,24,HM+9,7,false,sid);
floor('bldg',G.x0,G.z0,G.x0+24,G.z0-24,HM,0x9b9b9b,'rec');
info('Attached 2-car garage 24 × 24','rec','1996 permit: house with attached 24 × 24 garage. Seen p03, p53. ~7 ft door (inferred) — no Airstream.',[G.x0+12,HM+18,G.z0-12]);

// ================= POLE BARN 32 x 38 =================

lwall('bldg',PB,0,0,32,0,0,12,tan,'photo',[[1.2,10.2,8],[14,24,11.5],[26,29,6.8]],true);
lwall('bldg',PB,0,38,32,38,0,12,tan,'photo',[[1.2,10.2,8]],true);
lwall('bldg',PB,0,0,0,38,0,12,tan,'photo',[],true); lwall('bldg',PB,32,0,32,38,0,12,tan,'photo',[],true);
gableRoof('bldg',PB.x0,PB.z0-38,32,38,PBy+12,5.3,false,0x8f9396,1.2); gableEnds('bldg',PB.x0,PB.z0-38,32,38,PBy+12,5.3,false,tan);
floor('barn',PB.x0,PB.z0,PB.x0+32,PB.z0-38,PBy+0.01,0xa8a8a2,'photo');
floor('site',PB.x0+4,PB.z0+12,PB.x0+30,PB.z0,PBy+0.02,0x3d3d3f,'photo');
info('Pole barn 32 × 38 (1999)','rec','Record: 1999 permit "construct 32×38 storage (pole type)", status TERMINATED 1/12/2012 (no final). Seen p51/p57: tan steel; Clark (in person, Oct 25): TWO sections split by an interior wall: large section behind the tall overhead door (Airstream + boat), smaller section also sizable; concrete floor, insulated liner, LED lights. Doors on the gable end facing the paved apron (south here — orientation inferred from satellite/p60).',[PB.x0+16,PBy+21,PB.z0-19]);
lbox('barn',PB,14,-0.3,24,0.3,0.2,0xffffff,'photo',info('Overhead door (with opener)','photo','Seen p51/p57. Clark confirmed on Oct 25 it is very tall and fits the Airstream. Modeled 10 ft wide × 11.5 ft tall — exact size not measured.'),11.4);
lbox('barn',PB,26,-0.3,29,0.3,0.2,0xffffff,'photo',info('Walk-in door','photo','Seen p51, right of the overhead door.'),6.8);
lbox('barn',PB,2,-0.3,8,0.3,0.2,0x7a5a3a,'photo',info('Old wooden double door','photo','Seen p51 at far left. ~7 × 6 ft (estimated). Could become a 2nd overhead door for the boat.'),7);
// Airstream Interstate 24X = Class B camper VAN on a 2021 Mercedes Sprinter 3500 dually chassis (~24 ft). Nose-in, large section.
{const it=info('Airstream Interstate 24X camper van (2022, Sprinter 3500 dually)','own','Class B camper van on a 2021 Mercedes-Benz Sprinter 3500 dual-rear-wheel chassis, ~24 ft long, ~6.7 ft wide (body), ~9.8 ft tall incl. roof A/C (approximate). Parked nose-in in the large section behind the tall overhead door (Clark confirmed the door fits). Shore power: 30 A outlet beside it.',null,{short:'Airstream Interstate 24X van',pri:9});
 const [cx]=PB.P(16.9,0);const y0=PBy;const Z=v=>PB.P(0,v)[1];const g=groups.barn;
 const silver=new THREE.MeshPhongMaterial({color:0xd3d8dd,shininess:120,specular:0xffffff}),dark=new THREE.MeshLambertMaterial({color:0x17191c}),glass=new THREE.MeshPhongMaterial({color:0x0e1720,shininess:160,specular:0x8899aa});
 // side profile (x = length from rear, y = height), extruded across the width with a bevel for rounded edges
 const L=24,sh=new THREE.Shape();sh.moveTo(0,1.5);sh.lineTo(0,8.6);sh.quadraticCurveTo(0,9.0,0.5,9.0);sh.lineTo(18.6,9.0);sh.quadraticCurveTo(19.6,9.0,19.9,8.4);
 sh.lineTo(21.9,5.3);sh.quadraticCurveTo(22.2,4.75,22.8,4.65);sh.lineTo(23.6,4.5);sh.quadraticCurveTo(24,4.4,24,3.9);sh.lineTo(24,1.9);sh.quadraticCurveTo(24,1.5,23.6,1.5);sh.lineTo(0,1.5);
 const bev=0.35,W2=6.7-2*bev;const geo=new THREE.ExtrudeGeometry(sh,{depth:W2,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:4,curveSegments:10});geo.rotateY(Math.PI/2);
 const body=new THREE.Mesh(geo,silver);body.position.set(cx-W2/2,y0,Z(3.5));g.add(body);body.userData.item=it;pickables.push(body);body.castShadow=true;
 const add=(gm,m,x,y,z,ry)=>{const o=new THREE.Mesh(gm,m);o.position.set(x,y,z);if(ry)o.rotation.y=ry;g.add(o);return o;};
 const zr=Z(3.5); // rear plane; front = zr-24
 // windshield on the slope (from x=19.9,y=8.4 to x=21.9,y=5.3)
 const ws=add(new THREE.PlaneGeometry(6.2,3.6),glass,cx,y0+6.85,zr-20.95);ws.rotation.x=-Math.atan2(2.0,3.1);ws.position.y+=0.02;ws.translateZ(0.42);
 for(const s of [-1,1]){
  add(new THREE.BoxGeometry(0.05,2.2,2.6),glass,cx+s*3.72,y0+6.4,zr-19.6); // cab door window
  for(const [v,w] of [[5.2,2.4],[10.5,3.2],[14.8,1.8]])add(new THREE.BoxGeometry(0.05,1.6,w),glass,cx+s*3.72,y0+6.5,zr-v);
  add(new THREE.BoxGeometry(0.05,0.28,22.5),new THREE.MeshLambertMaterial({color:0x3c4f66}),cx+s*3.73,y0+4.6,zr-11.6); // Airstream stripe
  add(new THREE.BoxGeometry(0.05,0.1,22.5),new THREE.MeshLambertMaterial({color:0x8fa3b8}),cx+s*3.73,y0+4.3,zr-11.6);
  add(new THREE.BoxGeometry(0.06,0.5,2.2),new THREE.MeshLambertMaterial({color:0xf2f2f2}),cx+s*3.73,y0+7.6,zr-3.2); // decal plate
  add(new THREE.BoxGeometry(0.06,1.0,22.8),dark,cx+s*3.72,y0+1.95,zr-12); // rocker / lower trim
  add(new THREE.BoxGeometry(0.5,0.8,0.25),dark,cx+s*3.95,y0+6.3,zr-21.0); // mirror
  add(new THREE.BoxGeometry(0.06,0.45,0.9),new THREE.MeshBasicMaterial({color:0xfff6dc}),cx+s*2.6,y0+3.7,zr-24.02).rotation.y=Math.PI/2; // headlight
 }
 add(new THREE.BoxGeometry(5.2,1.0,0.12),dark,cx,y0+3.1,zr-24.05);add(new THREE.BoxGeometry(6.8,0.7,0.5),dark,cx,y0+1.9,zr-24.1); // grille, bumper
 add(new THREE.BoxGeometry(6.8,0.6,0.5),dark,cx,y0+1.9,zr+0.15); // rear bumper
 add(new THREE.BoxGeometry(5.6,6.0,0.05),new THREE.MeshPhongMaterial({color:0xc8cdd2,shininess:90}),cx,y0+5.3,zr+0.37); // rear doors
 add(new THREE.BoxGeometry(0.05,6.0,0.06),dark,cx,y0+5.3,zr+0.4);
 add(new THREE.BoxGeometry(2.4,0.8,3),new THREE.MeshLambertMaterial({color:0xf2f2f2}),cx,y0+9.6,zr-12); // roof A/C
 add(new THREE.BoxGeometry(5.8,0.12,9),new THREE.MeshPhongMaterial({color:0x1a2f55,shininess:80}),cx,y0+9.45,zr-6); // roof solar
 add(new THREE.BoxGeometry(4.6,0.2,0.2),dark,cx,y0+9.3,zr-17.5);
 const tg=new THREE.CylinderGeometry(1.25,1.25,0.72,24);tg.rotateZ(Math.PI/2);const hub=new THREE.CylinderGeometry(0.55,0.55,0.74,16);hub.rotateZ(Math.PI/2);const hm=new THREE.MeshPhongMaterial({color:0xbfc3c8,shininess:100});
 for(const s of [-1,1]){add(tg,dark,cx+s*3.05,y0+1.25,zr-19.9);add(hub,hm,cx+s*3.08,y0+1.25,zr-19.9);
   for(const o of [2.75,3.5]){add(tg,dark,cx+s*o,y0+1.25,zr-6.2);}add(hub,hm,cx+s*3.53,y0+1.25,zr-6.2);
   add(new THREE.BoxGeometry(0.4,0.5,3.2),dark,cx+s*3.6,y0+2.7,zr-6.2);} // dually fender flare
 colliders.push({x0:cx-3.9,x1:cx+3.9,z0:zr-24.3,z1:zr+0.4,y0:PBy,y1:PBy+10});
 it.pos=[cx,PBy+11.2,zr-12];}
// Pontoon boat on a tandem trailer, east side of the large section
{const it=info('Pontoon boat on trailer (large section)','own','Clark: the big barn\'s large section holds the van AND a pontoon. Modeled as a typical ~22 ft pontoon (8.5 ft beam) on a bunk trailer, tongue toward the door. Size is a placeholder; it must come in through the 10 ft overhead door and then shift east — measure door and bay widths.',null,{short:'Pontoon boat on trailer',pri:8});
 const [cx]=PB.P(25.6,0);const Z=v=>PB.P(0,v+4)[1],y=PBy,g=groups.barn,add=(geo,c,x,yy,z,m)=>{const o=new THREE.Mesh(geo,m||new THREE.MeshLambertMaterial({color:c}));o.position.set(x,yy,z);g.add(o);return o;};
 const tube=new THREE.CylinderGeometry(0.95,0.95,21,18);tube.rotateX(Math.PI/2);const alu=new THREE.MeshPhongMaterial({color:0xd5d9dd,shininess:90});
 for(const sd of [-1,1]){add(tube,0,cx+sd*2.9,y+2.6,Z(18),alu);const cone=new THREE.Mesh(new THREE.SphereGeometry(0.95,16,10,0,Math.PI*2,0,Math.PI/2),alu);cone.rotation.x=-Math.PI/2;cone.scale.set(1,2.2,1);cone.position.set(cx+sd*2.9,y+2.6,Z(28.5));g.add(cone);}
 const deck=add(new THREE.BoxGeometry(8.5,0.3,22),0x7a7f86,cx,y+3.75,Z(18));deck.userData.item=it;pickables.push(deck);
 const fence=new THREE.MeshLambertMaterial({color:0xeeeeee});
 for(const [w,d,x,z] of [[0.15,20,cx-4.17,Z(18.5)],[0.15,20,cx+4.17,Z(18.5)],[8.5,0.15,cx,Z(28.6)]]){const f=add(new THREE.BoxGeometry(w,2.6,d),0,x,y+5.2,z,fence);f.userData.item=it;pickables.push(f);}
 add(new THREE.BoxGeometry(8.6,0.25,22),0x2f5d8a,cx,y+6.55,Z(18)); // gunwale stripe
 add(new THREE.BoxGeometry(2,3.2,2),0xeeeeee,cx+2.5,y+5.5,Z(24)); // console
 for(const v of [11,14,21,26])add(new THREE.BoxGeometry(2.6,1.6,2.4),0xf1eee6,cx-2.4,y+4.7,Z(v)); // seats
 add(new THREE.BoxGeometry(8,0.1,9),0xd8d0bc,cx,y+11.0,Z(18)); // bimini (raised)
 for(const sd of [-1,1])for(const v of [14,22])add(new THREE.CylinderGeometry(0.05,0.05,4.4,6),0x999999,cx+sd*3.9,y+8.8,Z(v));
 add(new THREE.BoxGeometry(1.2,4.2,1.6),0x111111,cx,y+3.6,Z(7.0)); // outboard
 // trailer
 add(new THREE.BoxGeometry(0.3,0.3,24),0x2a2a2a,cx-1.5,y+1.2,Z(16));add(new THREE.BoxGeometry(0.3,0.3,24),0x2a2a2a,cx+1.5,y+1.2,Z(16));
 add(new THREE.BoxGeometry(0.3,0.3,5),0x2a2a2a,cx,y+1.2,Z(3.0));
 const tw=new THREE.CylinderGeometry(0.9,0.9,0.6,16);tw.rotateZ(Math.PI/2);for(const sd of [-1,1])for(const v of [16,18.2])add(tw,0x111111,cx+sd*2.6,y+0.9,Z(v));
 colliders.push({x0:cx-4.3,x1:cx+4.3,z0:Math.min(Z(0.5),Z(29)),z1:Math.max(Z(0.5),Z(29)),y0:PBy,y1:PBy+11});
 it.pos=[cx,PBy+12.5,Z(18)];}
// interior divider wall (seen by Clark) — location NOT measured; modeled N-S at u=12 so the old double door serves the smaller section
{const [x,z]=PB.P(12,19); const dv=box('barn',x,PBy,z,0.5,12,38,0xb8a07a,'photo',info('Interior divider wall (existing, seen by Clark Oct 25)','photo','Splits the 32 × 38 barn into a large section (overhead door; Airstream + boat) and a smaller section (~12 × 38 modeled; old double door). Exact position not measured. No structural work planned (Clark). Remove ONLY if it is a flimsy non-load-bearing partition (girts/light framing + siding, no posts carrying trusses), est. $1-3K. If posts carry trusses, the wall stays (engineered beam: not pursuing). Visit check: posts on this line?'),{collide:true});
 const dc=colliders[colliders.length-1]; let on=true; window.toggleDivider=()=>{on=!on; dv.material.opacity=on?1:0.18; dv.material.transparent=!on; dv.material.depthWrite=on; dv.material.needsUpdate=true; const i=colliders.indexOf(dc); if(on&&i<0)colliders.push(dc); if(!on&&i>=0)colliders.splice(i,1); return on;};}
lbox('barn',PB,2,35.5,11.5,38,3,0x9c7a55,'photo',info('Workbench + wood shelving','photo','Seen p57 along the back/right walls. Ask whether it stays.'),0,{collide:true});
lbox('barn',PB,30,10,32,30,7,0x9c7a55,'photo',info('Tall wood shelf unit','photo','Seen p57 on the right wall.'),0,{collide:true});
lbox('barn',PB,0,19,0.6,21,2.5,0x555b66,'photo',info('Barn subpanel (seen p57)','photo','Electrical panel on the left wall in p57. Fed from the 1999 electrical permit (closed 2000). Feeder size unknown — have the electrician check feeder, grounding and spaces. The Airstream Interstate 24X (Sprinter van) plugs into a 30 A shore outlet; a 50 A 14-50 also covers EV-style charging.',null,{layer:'elec'}),4);
lbox('elec',PB,12.3,22,12.9,23,1,0xff5040,'prop',info('Shore power for the Airstream van: 50 A NEMA 14-50 + 30 A TT-30 (proposed)','prop','Van shore cord is 30 A (TT-30); a 14-50 next to it serves a 50 A adapter or a portable EV charger. Published installed cost: $600-1,800 for a 14-50 on a longer run (electrical-guide.com, Oct 2026). Barn feeder size must be checked.'),3.5);

// ================= SECOND GARAGE → GYM (28 x 30) =================

lwall('bldg',GY,0,0,28,0,0,10,beige,'photo',[[22,25,6.8]],true);                      // south: man door (seen side door)
lwall('bldg',GY,0,30,28,30,0,10,beige,'photo',[[13,16,6.8]],true);                     // north: proposed door to outdoor shower
lwall('bldg',GY,0,0,0,30,0,10,beige,'photo',[],true);
lwall('bldg',GY,28,0,28,30,0,10,beige,'photo',[[11,19,8]],true);                       // east: overhead door
gableRoof('bldg',GY.x0,GY.z0-30,28,30,GYy+10,4.7,false,0x8f9396,1.2); gableEnds('bldg',GY.x0,GY.z0-30,28,30,GYy+10,4.7,false,beige);
floor('gym',GY.x0,GY.z0,GY.x0+28,GY.z0-30,GYy+0.01,0x9e9e98,'photo');
info('Second garage → CrossFit gym (planned)','photo','Seen p50/p58: steel building on grass, white sectional door, man door + window on the side, concrete floor, tube-steel trusses, no posts. No permit on record. Size ~28 × 30 ft and eave ~10 ft are estimated from satellite/photos — measure before buying gear (rope climb and ring height limited by truss height).',[GY.x0+14,GYy+18,GY.z0-15]);
const G1=(n,t,txt,u0,v0,u1,v1,h,c,y0,opt)=>{const it=info(n,t,txt,null,{gym:true,near:true});lbox('gym',GY,u0,v0,u1,v1,h,c,t,it,y0||0,Object.assign({collide:h>1.2&&!(opt&&opt.nocol)},opt||{}));return it;};
// --- rubber flooring (owned)
lbox('gym',GY,8,7.5,24,24.5,0.08,0x1c1c1c,'own',info('Rubber gym flooring (owned #19, #30)','own','Large black mats from the Seabreeze gym, laid over the lifting/rig zone.',null,{gym:true,near:true}),0,{edges:false});
// --- proposed centerpiece rig
{const it=info('Free-standing pull-up rig — centerpiece (proposed new)','pnew','~10 × 6 ft, 9 ft tall, 4 uprights, pull-up bars both sides, J-cups, battle-rope anchor. Stays the main station.',null,{gym:true,near:true});
 for(const [u,v] of [[11,12],[21,12],[11,18],[21,18]]) lbox('gym',GY,u-0.15,v-0.15,u+0.15,v+0.15,9,0x26292d,'pnew',it,0,{collide:true});
 lbox('gym',GY,11,11.9,21,12.1,0.2,0x26292d,'pnew',it,8.6); lbox('gym',GY,11,17.9,21,18.1,0.2,0x26292d,'pnew',it,8.6);
 lbox('gym',GY,15.9,12,16.1,18,0.2,0x26292d,'pnew',it,8.6);}
// rings & rope from truss
{const it=info('Gymnastics rings hung from truss (proposed new)','pnew','Straps from a truss at ~10 ft (eave height estimated). Check truss rating.',null,{gym:true,near:true});
 for(const du of [-0.9,0.9]){lbox('gym',GY,13+du-0.03,19.97,13+du+0.03,20.03,4.5,0xdddddd,'pnew',it,5.3,{edges:false});cyl('gym',GY.x0+13+du,GYy+4.6,GY.z0-20,0.45,0.15,0xc8a060,'pnew',it);}}
{const it=info('Climbing rope from truss (proposed new)','pnew','1.5 in manila rope. With only ~10 ft to the truss this is a short climb; a taller anchor would need structural work.',null,{gym:true,near:true});
 cyl('gym',GY.x0+18.5,GYy,GY.z0-20.5,0.12,9.8,0xc8a060,'pnew',it);}
G1('owned – Seabreeze rack (accessory)','own','Inventory #22: wall-mounted power/squat rack with attachments (Xebex-style). Placed along the west wall as an extra rack — not the main station.',0,10,4,14,7.5,0x444a55);
G1('Flat weight bench (owned #23)','own','Black flat bench.',5,10,6.5,14,1.5,0x222222);
G1('Hip-thrust bench + plate attachment (owned #18)','own','Strongweight / Tib Bar Guy style.',8,5,10,9,1.6,0x333333);
G1('Barbell tree with 3 barbells (owned #27)','own','Two chrome, one black. Weights/bar spec TBD.',0.3,15.5,2.3,17.5,4.6,0x8899aa);
G1('Bumper plates + rolling plate rack (owned #28)','own','Colored bumper set. Plate weights TBD — inventory says "weigh total".',0.3,18.5,3.3,20.5,3,0xcc4444);
G1('DB/KB 3-tier rack, hex dumbbells, kettlebells (owned #25, #31, #32)','own','Hex dumbbells: about 4-5 pairs (weights TBD). Kettlebells: about 6 (one 35 lb; others TBD).',23.5,0.2,27.5,1.7,3.5,0x2a2a2a);
G1('Xebex curved manual treadmill (owned #16)','own','~6 × 3 ft, heavy (two-person lift).',16,26.5,22,29.5,5,0x2b2b2b);
G1('Peloton bike + rubber mat (owned #17, #19)','own','~4 × 2 ft footprint.',22.5,25.5,24.5,29.5,4.5,0x1a1a1a);
G1('EnergyFit rower / SkiErg combo (owned #21)','own','Rail ~7+ ft; SkiErg tower ~7 ft tall. Along the east wall south of the overhead door.',26,2.5,27.8,10.5,2,0x3a3a3a); lbox('gym',GY,26.2,9.2,27.8,10.5,7,0x3a3a3a,'own',null,0,{collide:true});
G1('30-in 3-in-1 plyo box + step boxes (owned #24)','own','Xebex 30 in plyo box and smaller boxes.',12,4.5,14.5,7,2.5,0x7a5530);
G1('Med/slam balls, battle rope, bands, foam roller (owned #26, #33, #34)','own','Small accessories bin; red battle rope anchors to the rig.',24,21.5,26,23.5,1.2,0xaa2222,0,{nocol:true});
G1('Small gray fridge (owned #29)','own','Inventory says check if it goes.',26,20,28,22,3,0x9a9a9a);
G1('Cold plunge tub (owned #36 — "take to Michigan")','own','Model/size to confirm; modeled ~5.5 × 2.7 × 2.3 ft. Chiller on a dedicated ~12 A 120 V GFCI circuit.',7,27.3,12.5,30,2.3,0x3a7fbf);
// bike wall + eBike charger
{const it=info('Bike storage wall: 2 bikes + eBike (owned #37-#39)','own','Two bikes on vertical wall hooks; the large eBike stands on the floor (too heavy to hang) next to its charger.',null,{gym:true,near:true});
 for(const u of [10,13]){lbox('gym',GY,u-0.1,0.2,u+0.1,3.6,6,0x222222,'own',it,0.4);cyl('gym',GY.x0+u,GYy+0.4,GY.z0-0.8,1.1,0.1,0x111111,'own',null);}
 lbox('gym',GY,9,0,15,0.25,7,0x8c6a45,'own',null,0,{edges:false});
 lbox('gym',GY,16.5,0.6,22.5,1.6,3.6,0x1c3c2c,'own',it,0,{collide:true});}
lbox('elec',GY,22.7,0,23.3,0.3,0.8,0xff5040,'prop',info('eBike charging spot (proposed)','prop','Dedicated 20 A GFCI outlet on a timer, away from the sauna; lithium charging on a non-combustible shelf.',null,{gym:true,near:true}),3.5);
// proposed new gear
G1('Assault / Echo air bike (proposed new)','pnew','Not in the Seabreeze inventory.',25,25.5,27.5,29.5,4.2,0x5f7f68);
G1('GHD (proposed new)','pnew','~6 × 2.5 ft.',20,20.5,26,23,3.6,0x23262a);
G1('Plyo box set (proposed new)','pnew','Soft/stackable 20/24/30 in set.',15.5,4.5,19.5,6.5,2.5,0x2f3338);
G1('Wall balls (proposed new)','pnew','14/20 lb.',1,21,3,23,1,0x5f7f68,0,{nocol:true});
lbox('gym',GY,0,21.5,0.3,22.5,1,0x5f7f68,'pnew',info('Wall-ball target at 9-10 ft (proposed new)','pnew','On the west wall.',null,{gym:true,near:true}),9);
G1('Kettlebell set (proposed new, additional)','pnew','Adds to the ~6 owned (one 35 lb). Weights TBD.',4.5,16,7,17.5,1.2,0x5f7f68,0,{nocol:true});
G1('Sled (proposed new)','pnew','Push out the overhead door onto the drive/grass.',8,20.5,11,23,1.3,0x3a3d42);
// recovery corner
G1('#1 Seabreeze massage chair — recovery room (size to verify)','own','Clark\'s choice: small-barn recovery room with the gym and cold plunge. Size not logged: modeled ~32 in W × 60 in D upright, up to ~75 in reclined, ~300 lb (VERIFY). Clear zone ≥3 ft beside and behind for recline; dedicated 15/20 A GFCI outlet. Requires the barn to be climate-controlled (mini-split + dehumidifier, insulation): cold/humid air is bad for its electronics and upholstery.',13.6,23.5,16.3,29.75,3.8,0x2b2b2b);
lbox('gym',GY,13.1,22.6,19.6,30,0.03,0x9fc5a8,'prop',info('Massage chair clearance zone (≥3 ft, recline)','prop','Kept free of gym gear.'),0.02,{edges:false});
lbox('gym',GY,9,29.4,13,30,1.1,0xf4f4f4,'prop',info('Mini-split heat pump head (cold-climate, ~18k BTU)','prop','e.g. Mitsubishi Hyper-Heat H2i 18k (rated to −13°F), $4.3–5.8K installed (OhmSnap); single-zone Hyper-Heat $4.5–9K installed (LatestCost 2026). Outdoor unit on the north wall.'),7.5);
lbox('gym',GY,17.5,29,19,30,2.2,0xe8e8e8,'prop',info('Dehumidifier (keep RH ~45–50%)','prop','Ducted/whole-space or a 50-pint unit with a condensate pump to the floor drain; protects the massage chair, plunge area and steel gear. Estimate $300–2,000 (not quoted).'),0);
info('Climate control: spray-foam insulation + mini-split + dehumidifier','prop','Gym barn insulation status not verified; plan closed-cell spray foam on walls + roof: ~2,100–2,400 sf surface for a 28×30-ish building, $2,100–10,800 (HomeGuide 30×30 range). Plus mini-split $4.5–9K and dehumidifier ~$0.3–2K → ~$7–22K.',[GY.P(14,15)[0],GYy+11,GY.P(14,15)[1]],{layer:'gym',short:'Climate: insulation + mini-split + dehumidifier',pri:6});
G1('Sauna 6 × 6 — OPTIONAL concept','prop','Optional, not in the base plan. ~8 kW 240 V heater (~33 A, 40-50 A circuit). Recovery corner (NW).',0,24,6,30,7,0xb5824f);
G1('Bathroom / shower spot (proposed)','prop','~7 × 8 ft. Water from the well (trench), septic tie-in or separate system needs GT County Environmental Health review; building + plumbing permits; garage may need to be permitted first. Est. $25-60K.',0,0,7,8,8,0x88b8d8);
// outdoor shower outside north door
{const F=GY;const it=info('Outdoor shower — cedar enclosure (proposed)','prop','~5 × 5 ft cedar enclosure, gravel/deck floor, just outside a proposed north door next to the sauna/plunge corner. Hot/cold feed (or a frost-free hose bib) teed off the planned barn water line. Drain to a dry well/gravel — check Environmental Health rules.',null,{gym:true,near:true});
 lbox('gym',F,12,30.6,17,35.6,0.25,0xa08060,'prop',it,0);
 lwall('gym',F,12,35.6,17,35.6,0,7,0xb07040,'prop',[]); lwall('gym',F,12,30.6,12,35.6,0,7,0xb07040,'prop',[]); lwall('gym',F,17,30.6,17,35.6,0,7,0xb07040,'prop',[[0,2.5]]);
 lbox('gym',F,14.3,35.3,14.7,35.5,0.3,0xcccccc,'prop',null,6.5);
 it.pos=[F.x0+14.5,GYy+9,F.z0-33];}
// planned barn water line (well → gym bath + shower)
const WELL=[W(252),Zs(258)];
line('gym',[WELL,[W(200),Zs(200)],[GY.x0+3,GY.z0-4],[GY.x0+3,GY.z0-30.6],[GY.x0+14.5,GY.z0-34]],0x3fa9ff,'prop',0.8);
info('Planned barn water line (proposed)','prop','PEX from the well pressure tank, 42-48 in below frost, sharing the electrical trench where possible. Feeds the gym bathroom and the outdoor shower. Est. $2-6K.',[W(205),rawElev(W(205),Zs(205))+5,Zs(205)]);

// ================= SHED =================
lwall('bldg',SH,0,0,10,0,0,8,0xc8b896,'inf',[[3,6,6.5]],true); lwall('bldg',SH,0,12,10,12,0,8,0xc8b896,'inf',[],true);
lwall('bldg',SH,0,0,0,12,0,8,0xc8b896,'inf',[],true); lwall('bldg',SH,10,0,10,12,0,8,0xc8b896,'inf',[],true);
gableRoof('bldg',SH.x0,SH.z0-12,10,12,SHy+8,3,false,0x8f9396,0.8);gableEnds('bldg',SH.x0,SH.z0-12,10,12,SHy+8,3,false,0xc8b896);
floor('bldg',SH.x0,SH.z0,SH.x0+10,SH.z0-12,SHy+0.05,0x8a7a60,'inf');
info('Shed (~10 × 12)','inf','Listing lists a shed; only glimpsed at the edge of p04/p50. Position is a small structure seen on satellite beside the drive — size inferred.',[SH.x0+5,SHy+13,SH.z0-6]);

// ================= SITE FEATURES =================
{const px=W(345),pz=Zs(296),py=rawElev(px,pz);
 const pond=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshPhongMaterial({color:0x22343a,shininess:80})); pond.scale.set(14,9,1); pond.rotation.x=-Math.PI/2; pond.position.set(px,py+0.5,pz); groups.site.add(pond);
 const rim=new THREE.Mesh(new THREE.RingGeometry(1,1.35,40),new THREE.MeshLambertMaterial({color:0xbdb5a8})); rim.scale.set(14,9,1);rim.rotation.x=-Math.PI/2;rim.position.set(px,py+0.45,pz);groups.site.add(rim);rim.material.color.set(0x8c8a7e);
 {const n=window.innerWidth<900?110:220,rg=new THREE.DodecahedronGeometry(1,0),rm=new THREE.MeshLambertMaterial({color:0xffffff}),ri=new THREE.InstancedMesh(rg,rm,n),o=new THREE.Object3D(),cc=new THREE.Color();
  for(let i=0;i<n;i++){const row=i%3,a=i/n*Math.PI*2*3+row*0.4,rr=1.02+row*0.11+((i*37)%7)/70;o.position.set(px+Math.cos(a)*14*rr,py+0.35+row*0.25,pz+Math.sin(a)*9*rr);const s=0.55+((i*53)%10)/14;o.scale.set(s*1.2,s*0.7,s);o.rotation.set(i,i*1.7,i*0.3);o.updateMatrix();ri.setMatrixAt(i,o.matrix);
   ri.setColorAt(i,cc.set([0xb9b2a3,0x9c968a,0xcfc7b6,0x8a8478,0xa89a84][i%5]));}ri.castShadow=ri.receiveShadow=true;groups.site.add(ri);
  const sg=new THREE.IcosahedronGeometry(1,1),si=new THREE.InstancedMesh(sg,new THREE.MeshLambertMaterial({color:0xffffff}),18);for(let i=0;i<18;i++){const a=i/18*Math.PI*2+0.2,rr=1.55+(i%3)*0.12;o.position.set(px+Math.cos(a)*14*rr,py+1.2,pz+Math.sin(a)*9*rr);const s=1.3+(i%4)*0.35;o.scale.set(s,s*0.85,s);o.rotation.set(0,i,0);o.updateMatrix();si.setMatrixAt(i,o.matrix);si.setColorAt(i,cc.set([0x3f6a2c,0x4d7a34,0x5a3a52,0x6b8a3a][i%4]));}si.castShadow=true;groups.site.add(si);
  const lp=new THREE.InstancedMesh(new THREE.CircleGeometry(0.9,10),new THREE.MeshLambertMaterial({color:0x4f7a35}),14);for(let i=0;i<14;i++){o.position.set(px+Math.cos(i*2.3)*8*((i%5)/6+0.3),py+0.53,pz+Math.sin(i*2.3)*5*((i%5)/6+0.3));o.rotation.set(-Math.PI/2,0,0);o.scale.set(1,1,1);o.updateMatrix();lp.setMatrixAt(i,o.matrix);}groups.site.add(lp);}
 pond.userData.item=info('Landscaped garden pond','photo','Seen p01, p07, p09, p37: rock-lined lily pond in the front lawn east of the deck. Not a mapped waterbody (county GIS). Position from p09/p60 aerials (≈ 60 ft east of house).',[px,py+6,pz]); pickables.push(pond);}
{const [x,z]=[W(247),Zs(286)],y=rawElev(x,z);const it=info('Propane tank (~500 gal, location inferred) — conflicts with future suite','inf','Listing: forced-air propane heat, so there is a tank (owned or leased — ask). Not visible in photos/satellite; placed on the west (uphill) side near the drive. Could also feed a standby generator. Sits inside the future guest-suite footprint, so it would have to move (see relocated tank).',[x,y+7,z]);
 cyl('site',x-5,y+0.5,z,1.9,10,0xf2f2f2,'inf',it,true);}
{const [x,z]=WELL,y=rawElev(x,z);cyl('site',x,y,z,0.5,1.5,0x6080a0,'inf',info('Private well (location inferred)','inf','Listing: private well. Typically near the house/garage; ask for the well log (depth, yield, pump age).',[x,y+5,z]));}
{const x0=W(295),z0=Zs(325);const y=rawElev(x0+20,z0+25);const m=box('site',x0+20,y+0.1,z0+25,40,0.3,50,0xc6d68a,'inf',info('Septic drain field (location inferred)','inf','Listing: private septic (1996, ~30 yrs). Assumed in the open lawn south of the house. Request Environmental Health permit/as-built, pump and inspect.',[x0+20,y+5,z0+25]));}
{const [x,z]=[W(386),Zs(250)],y=rawElev(x,z);cyl('site',x,y,z,2.5,0.8,0x6a4a3a,'inf',info('Fire pit (inferred spot)','inf','Not confirmed in listing photos. A small object in the east lawn on satellite could be a fire ring — verify on site. Shown where a fire pit would sit in the clearing.',[x,y+5,z]));}
// trees (illustrative, wooded areas from satellite) — instanced conifers + deciduous
{let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
 const clear=(bx,by)=>(bx>140&&bx<470&&by>60&&by<420)||(bx<45);const pts=[];
 for(let k=0;k<420;k++){const bx=45+rnd()*730,by=rnd()*528;if(clear(bx,by))continue;pts.push([W(bx),Zs(by),0.7+rnd()*0.8,rnd()]);}
 // a few specimen trees around the lawn/pond (seen p01/p03)
 for(const [bx,by] of [[250,300],[330,250],[380,330],[200,240],[300,360],[240,190],[150,300],[420,250]])pts.push([W(bx),Zs(by),0.8,0.9]);
 const con=pts.filter(p=>p[3]<0.68),dec=pts.filter(p=>p[3]>=0.68);
 const mk=(geo,c,n)=>{const m=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:c}),n);groups.trees.add(m);return m;};
 const trunk=mk(new THREE.CylinderGeometry(0.6,0.9,1,6),0x5a4330,pts.length),t1=mk(new THREE.ConeGeometry(7,20,8),0x2c5229,con.length),t2=mk(new THREE.ConeGeometry(5,16,8),0x355f30,con.length),cr=mk(new THREE.IcosahedronGeometry(9,1),0x4c7a3a,dec.length);
 const o=new THREE.Object3D();
 pts.forEach((p,i)=>{const y=rawElev(p[0],p[1]);o.position.set(p[0],y+5*p[2],p[1]);o.scale.set(p[2],10*p[2],p[2]);o.rotation.set(0,0,0);o.updateMatrix();trunk.setMatrixAt(i,o.matrix);});
 con.forEach((p,i)=>{const y=rawElev(p[0],p[1]);o.scale.set(p[2],p[2],p[2]);o.position.set(p[0],y+(8+10)*p[2],p[1]);o.updateMatrix();t1.setMatrixAt(i,o.matrix);o.position.set(p[0],y+(20+8)*p[2],p[1]);o.updateMatrix();t2.setMatrixAt(i,o.matrix);});
 cr.material.color.set(0xffffff);const SEASON=new URLSearchParams(location.search).get('season')||(()=>{try{return localStorage.getItem('samelsSeason')}catch(e){return null}})()||'summer';const FALL=SEASON==='fall'?[0x4c7a3a,0x5b8a3c,0xc9772e,0xd9a43a,0xa8452a,0x6f8f3a,0xe0b04a,0x8a3a22]:[0x3f6e2c,0x4a7a32,0x557f36,0x3a6428,0x5e8a3a,0x46732e,0x67913f,0x355f26];window.__season=SEASON;const tc=new THREE.Color();
 window.__trees=[trunk,t1,t2,cr];
 dec.forEach((p,i)=>{cr.setColorAt(i,tc.set(FALL[Math.floor((Math.sin(i*12.9898)*43758.5453%1+1)%1*FALL.length)]));const y=rawElev(p[0],p[1]);o.scale.set(p[2]*1.1,p[2]*0.9,p[2]*1.1);o.position.set(p[0],y+17*p[2],p[1]);o.updateMatrix();cr.setMatrixAt(i,o.matrix);});}

// ================= ELECTRICAL / SOLAR =================
const meter=G.P(-0.3,12); cyl('elec',meter[0],HM+4,meter[1],0.6,1.2,0xff5040,'inf',info('Electric meter / service entrance (inferred)','inf','Utility likely Cherryland Electric Co-op (confirm from bill). Service size NOT listed: likely 200 A, could be 100-150 A. Plan a 400 A (2×200) upgrade (~$4-10K) or a 2nd meter at the gym.',[meter[0],HM+8,meter[1]]));
{const p=H.P(27,6);cyl('elec',p[0],HL+4,p[1],0.7,1.4,0xff7050,'inf',info('Main panel — location unknown','inf','No photo shows it. Most likely in the lower-level mechanical room. Ask for breaker size and brand (avoid Federal Pacific/Zinsco).',[p[0],HL+7,p[1]]));}
line('elec',[[meter[0],meter[1]],[W(245),Zs(200)],[PB.x0+0.5,PB.z0-20]],0xff8a50,'inf',0.9);
info('Existing barn feeder (route inferred)','inf','Pole barn was wired under the 1999 electrical permit (closed 2000). Buried route unknown — call MISS DIG before digging.',[W(248),rawElev(W(248),Zs(190))+5,Zs(190)]);
line('elec',[[meter[0],meter[1]],[W(225),Zs(220)],[GY.x0+27,GY.z0-6]],0x4cff6a,'prop',1.1);
info('Proposed trench → gym: 100 A feeder','prop','~110-150 ft. $8-25/ft for trench+conduit+wire (~$2-5K); share with the water line. Alternative: separate Cherryland meter at the gym ($100 + $6/ft past 100 ft).',[W(232),rawElev(W(232),Zs(205))+6,Zs(205)]);
{const p=G.P(0.4,4);box('elec',p[0],HM+3.5,p[1],0.4,1.2,0.8,0xe03030,'prop',info('Tesla Wall Connector (proposed)','prop','60 A breaker / 48 A charging (~11.5 kW) on the garage west wall.',[p[0],HM+6,p[1]]));}
{const p=G.P(0.6,17);for(const d of [0,2.4])box('elec',p[0],HM,p[1]-d,0.6,3.6,1.9,0xf4f4f4,'prop',info('Powerwall 3 ×2 + expansion (proposed, central)','prop','One central system at the main service backing up the house; barns fed through their subpanels. 2 × PW3 (27 kWh) covers a 1-2 day outage if the sauna and EV are excluded. ~$14-17K first, $11-13K each after. No federal credit in 2026.',[p[0],HM+6,p[1]-1.2]));}
// solar: roof arrays NOT recommended (snow) -> proposed ground-mount array in the open field
{const g=new THREE.PlaneGeometry(30,17);const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x1d3b66,transparent:true,opacity:.22,side:THREE.DoubleSide}));
 const ang=Math.atan2(20,16);m.rotation.x=-(Math.PI/2-ang);m.position.set(H.x0+17,HM+9+10.3,H.z0-8.1);groups.solar.add(m);
 m.userData.item=info('Roof solar on the chalet — not recommended (snow)','inf','Superseded: roof panels hold snow, are dangerous to clear on a steep roof, and trees shade 20-50%. Use the ground-mount array in the field instead.',[H.x0+17,HM+24,H.z0+2]);pickables.push(m);}
const SOLAR={};
{const it=info('Proposed ground-mount solar (concept) — ~20 kW','prop','About 20 kW DC: 52 × 400 W panels in 2 racked rows (2 panels high, portrait), tilted ~40° facing true south, in the open field. Notes: ~20 kW for annual net-zero (~22,500 kWh/yr est.); ground mount at 40-50° sheds snow and can be cleared by hand; Dec/Jan output only ~25-30% of summer. Published northern-MI installed cost ~$3.00-3.80/W ground mount → ~$60-76K before any tax credit. Needs a shade report, Whitewater Twp land-use permit (setbacks), GT County building/electrical permits, Cherryland interconnection. Position is a concept only.');
 const pm=new THREE.MeshLambertMaterial({color:0x1b2f5c}),fm=new THREE.MeshLambertMaterial({color:0x9aa0a6});
 const pt=ctex(256,(gx,n)=>{gx.fillStyle='#fff';gx.fillRect(0,0,n,n);gx.fillStyle='#9fb0c8';for(let i=0;i<=6;i++){gx.fillRect(i*n/6-1,0,2,n);}for(let j=0;j<=10;j++)gx.fillRect(0,j*n/10-1,n,2);});
 pm.map=pt;pt.repeat.set(13,2);
 const len=13*3.75,slope=2*5.6,tilt=40*Math.PI/180,X0=W(420),Zr=[Zs(352),Zs(378)];
 for(const z of Zr){const y=rawElev(X0,z)+1.8;const tbl=new THREE.Mesh(new THREE.BoxGeometry(len,0.15,slope),pm);tbl.rotation.x=tilt;tbl.position.set(X0,y+Math.sin(tilt)*slope/2,z);groups.solar.add(tbl);tbl.userData.item=it;pickables.push(tbl);tbl.castShadow=true;
   for(let i=0;i<=6;i++){const x=X0-len/2+i*len/6;for(const [dz,h] of [[slope*Math.cos(tilt)/2-0.6,1.8],[-slope*Math.cos(tilt)/2+0.6,1.8+Math.sin(tilt)*slope-0.6]]){const leg=new THREE.Mesh(new THREE.BoxGeometry(0.3,h,0.3),fm);leg.position.set(x,rawElev(x,z+dz)+h/2,z+dz);groups.solar.add(leg);}}
   colliders.push({x0:X0-len/2,x1:X0+len/2,z0:z-4.5,z1:z+4.5,y0:rawElev(X0,z)-2,y1:rawElev(X0,z)+10});}
 it.pos=[X0,rawElev(X0,Zr[0])+14,Zr[0]+13];SOLAR.x=X0;SOLAR.z=(Zr[0]+Zr[1])/2;
 const hp=H.P(27,0);line('solar',[[X0-len/2,Zr[0]-4],[W(360),Zs(340)],[hp[0]+3,hp[1]+6],[hp[0],hp[1]]],0xffb000,'prop',0.7);
 info('Solar trench to the house (proposed)','prop','Buried conduit from the array combiner/disconnect to the Powerwall/inverter at the house service (mechanical room, inferred). Roughly 150-200 ft; trenching published at ~$10-25/ft. Call MISS DIG first; avoid the septic field.',[W(370),rawElev(W(370),Zs(342))+5,Zs(342)]);}

// ADU spot
{const x=W(470),z=Zs(330),y=rawElev(x,z);box('plan',x,y,z,30,14,26,0xe6a35a,'prop',info('Possible ADU / guest-house spot (proposed)','prop','~780 sf footprint inside setbacks, in the east clearing. A detached 2nd dwelling is NOT expressly allowed in Whitewater Twp (needs ZA approval or a land split); an attached unit / two-family dwelling is allowed by right in A-1. STRs < 30 days banned. Est. $200-400K detached.',[x,y+18,z]));}


// ================= FUTURE (2+ yrs): GUEST SUITE ADDITION =================
const FUTNAME='Future consideration (~2 years out): Guest suite addition, only if we still love the property and want to keep investing';
{const F=SU,c=0xb06cff,fw=0xcdb2ef,L='future';
 const it=info(FUTNAME,'future','20 × 28 ft (560 sf) studio attached to the chalet west wall at the MAIN (entry) level: one open room (queen bed, sitting area, kitchenette), separate full bath, private west entry with porch and path from the driveway, and a lockable pass-through door into the main house. Floor = chalet main floor. USGS grade across the footprint falls ~1.9 ft west→east (782.3 → 780.4 ft) → crawlspace on 42 in frost walls, ~0.5 ft exposed at the west, ~2 ft at the east; regrade the uphill (west) side to drain around the suite. Setbacks: ~203 ft to the west (front) line, ~163 ft south, ~223 ft north — far inside 30/15/30. Est. $140-290K all in.',[F.x0+10,HM+22,F.z0-14]);
 lwall(L,F,0,0,0,28,0,9,fw,'future',[[10,13,6.8]],true);           // west wall: private entry door
 lwall(L,F,0,0,20,0,0,9,fw,'future',[[6,12,5]],true);              // south wall (window band)
 lwall(L,F,0,28,20,28,0,9,fw,'future',[],true);
 floor(L,F.x0,F.z0,F.x0+20,F.z0-28,HM,0xcbb8e8,'future');
 // crawlspace / frost wall skirt
 box(L,F.x0+10,HM-3.6,F.z0-14,20.4,3.3,28.4,0x8a7a9a,'future',null,{edges:true});
 gableRoof(L,F.x0,F.z0-28,20,28,HM+9,9,true,0x7d5aa8,1.2);
 // bathroom NW
 lwall(L,F,0,20,8,20,0,8,0xeee6ff,'future',[[5,7.5,6.8]]); lwall(L,F,8,20,8,28,0,8,0xeee6ff,'future',[]);
 lbox(L,F,0.2,23,3.2,27.8,7,0xa8d8f0,'future',info('Suite full bathroom (future)','future','~8 × 8 ft: 3 × 5 ft shower, toilet, vanity. Adds fixtures to the 1996 septic — GT County Environmental Health review.',null,{near:true}),0,{collide:true});
 lbox(L,F,4.5,26.4,6.3,27.8,1.4,0xffffff,'future',null,0,{collide:true}); lbox(L,F,4.2,20.3,7.8,22,2.8,0xd0c0a0,'future',null,0,{collide:true});
 // kitchenette along north wall
 lbox(L,F,9,26,19,28,3,0xe7e0d0,'future',info('Kitchenette — no range (future)','future','10 ft counter: sink with drain, under-counter fridge, microwave, plug-in single induction plate, air fryer. No range/oven, no 240 V cooking circuit, no hood — keeps the case for "addition, not a dwelling unit" (building official decides).',null,{near:true}),0,{collide:true});
 lbox(L,F,10.5,26.6,12.5,27.6,0.3,0x9aa0a8,'future',null,3); lbox(L,F,15.5,26.4,17.2,27.8,0.9,0x333333,'future',null,3); lbox(L,F,13.2,26.6,14.4,27.6,0.1,0x111111,'future',null,3); lbox(L,F,17.6,26.6,18.6,27.5,1.1,0x444444,'future',null,3);
 lbox(L,F,9,18,12,21,2.5,0x8a6a40,'future',info('Bistro table + 2 chairs (future)','future','3 × 3 ft table, true scale.',null,{near:true}),0,{collide:true});
 // bed + sitting
 lbox(L,F,12.5,0.3,17.5,7,2,0xf2efe8,'future',info('Queen bed 60 × 80 in (future)','future','True-scale queen against the south wall, nightstands each side.',null,{near:true}),0,{collide:true});
 lbox(L,F,12.5,0,17.5,0.4,4,0x6a5040,'future',null,0); lbox(L,F,10.7,0.3,12.2,1.8,2,0x6a5040,'future',null,0,{collide:true}); lbox(L,F,17.8,0.3,19.3,1.8,2,0x6a5040,'future',null,0,{collide:true});
 lbox(L,F,2,3,8,6,2.8,0x5a6a7a,'future',info('Sitting area: loveseat, armchair, coffee table (future)','future','72 × 36 in loveseat, 32 in armchair, TV wall. Mini-split head above (separate HVAC zone).',null,{near:true}),0,{collide:true});
 lbox(L,F,3.5,7.5,6.5,9.5,1.4,0x7a5a3a,'future',null,0,{collide:true}); lbox(L,F,0.5,11,3,13.5,0,0x000000,'future',null,0,{edges:false});
 lbox(L,F,6.5,8.5,9,11,2.8,0x5a6a7a,'future',null,0,{collide:true});
 lbox(L,F,6,27.7,9,28,1,0xffffff,'future',info('Ductless mini-split (future)','future','Own heat/cool zone (~9-12k BTU), independent of the chalet propane furnace.',null,{near:true}),7);
 // doors
 lbox(L,F,19.8,22,20.2,25,6.8,0xffd24a,'future',info('Lockable pass-through (future)','future','Main-level door through the chalet west wall into the existing west bedroom (inferred plan; that bedroom becomes a vestibule/office or the door relocates). Keyed deadbolts on both sides. If the suite is ruled a 2nd dwelling unit: 1-hr separation (MRC R302.3) and a fire-rated, self-closing door.',null,{near:true}),0,{edges:true,mat:{}}).visible=true;
 lbox(L,F,-0.2,10,0.2,13,0.05,0xffd24a,'future',info('Private exterior entry (future)','future','West door, keyed separately, off a 7 × 7 ft porch about one step (≤7¾ in) above the regraded walk — near zero-step.',null,{near:true}),6.8);
 // porch + path
 floor(L,F.x0-7,F.z0-8,F.x0,F.z0-15,HM-0.2,0x9a7a5a,'future');
 floor(L,F.x0-9,F.z0-8,F.x0-7,F.z0-15,HM-0.75,0x9a7a5a,'future');
 ribbon(L,[[F.x0-9,F.z0-11.5],[F.x0-16,F.z0-20],[F.x0-14,F.z0-45],[F.x0+8,F.z0-62],[W(270),Zs(240)]],4,0xc8b898,.4);
 info('Suite porch + path from driveway (future)','future','7 × 7 ft porch with one step; 4 ft gravel/paver path north to the driveway near the garage.',[F.x0-12,HM+4,F.z0-30]);
 // south-roof solar on the suite
 {const g=new THREE.PlaneGeometry(18,12.5);const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x1d3b66,transparent:true,opacity:.25,side:THREE.DoubleSide}));
  const ang=Math.atan2(9,14);m.rotation.x=-(Math.PI/2-ang);m.position.set(F.x0+10,HM+9+4.6,F.z0-7);groups[L].add(m);edges(m,'future');
  m.userData.item=info('Suite south roof solar — NOT recommended (snow)','future','Roof arrays here hold snow for weeks and are hard to clear; the plan now uses the ground-mount array in the field instead. The suite covers the circled area beside the chalet; its own south roof can carry panels. Chalet south roof candidate stays usable (suite ridge is ~12 ft lower, small afternoon shading on its west end).',[F.x0+10,HM+17,F.z0-4],{near:true});pickables.push(m);}
 // relocated propane tank
 {const x=F.x0-19,z=F.z0-30,y=rawElev(x,z);const it=info('Propane tank — relocated (proposed)','future','Moved ~19 ft west of the suite and ~25 ft from the chalet: NFPA 58 Table 6.4.1.1 needs ≥10 ft from buildings for a 125-500 gal tank (25 ft for 501-2,000 gal), and ≥10 ft from any ignition source, opening or window well relative to the fill/relief valve. Keep truck-hose reach from the drive. Supplier (owned/leased?) sets it.',[x,y+7,z]);
  cyl(L,x-5,y+0.5,z,1.9,10,0xffffff,'future',it,true);}
 // well check (inferred well)
 {const [wx,wz]=WELL;const dz=(F.z0-28)-wz;const it=info('Well clearance check (well position inferred)','inf','Inferred well is ~'+Math.round(Math.abs(dz))+' ft north of the suite footprint — outside it. County Sanitary Code §3.310: well ≥50 ft from septic tank/field, ≥10 ft from any sewer line (10-50 ft only with heavy-duty pipe). Route the suite drain south, away from the well. If the real well turns out to be inside or within ~10 ft of the footprint, it is a relocation (new well ~$8-15K) or a dealbreaker for this spot.',[wx,rawElev(wx,wz)+9,wz]);}
}

// ================= LABELS / UI =================
const lblDiv=document.getElementById('labels');
items.forEach((it,k)=>{if(!it.pos)return;const d=document.createElement('div');d.className='lbl'+(it.tag==='future'?' fut':it.tag==='inf'?' inf':soft(it.tag)?' prop':it.tag==='own'?' own':'');
  d.textContent=it.short||(it.name.startsWith('Future consideration')?'Future guest suite':(()=>{let t=it.name.replace(/^#\d+\s*/,'').split(/\s+\(|\s+—\s+|:\s+|\s+–\s+/)[0];return t.length>30?t.slice(0,28)+'…':t;})());it.pri=it.pri!==undefined?it.pri:(it.layer==='bldg'?7:it.tag==='own'?6:it.tag==='photo'||it.tag==='rec'||it.tag==='sat'?4:it.tag==='future'?3:3);d.title=it.name;d.onclick=()=>showInfo(it);lblDiv.appendChild(d);it.el=d;
  it.layer=it.layer||guessLayer(it);});
function guessLayer(it){if(it.gym)return 'gym';const n=it.name;if(/panel|meter|feeder|trench|Wall Connector|Powerwall|RV outlet|eBike charging/.test(n))return 'elec';if(/Solar/.test(n))return 'solar';if(it.tag==='future')return 'future';if(/ADU|Setback/.test(n))return 'plan';
  if(/Airstream|boat|Workbench|shelf|door|Overhead/.test(n))return 'barn';if(/bedroom|bath|Kitchen|Dining|Great|Loft|Stairs|family|Laundry/i.test(n))return 'house';if(/House|garage|barn|Shed|Deck|Second/i.test(n))return 'bldg';return 'site';}
const info_el=document.getElementById('info');
function showInfo(it){const t=TAGS[it.tag]||TAGS.inf;info_el.innerHTML=`<b>${it.name}</b> <span class="tag ${t[1]}">${t[0]}</span><div style="margin-top:6px">${it.text}</div><div style="text-align:right;margin-top:6px"><button onclick="document.getElementById('info').style.display='none'">close</button></div>`;info_el.style.display='block';}
// legend
{const own=items.filter(i=>i.gym&&i.tag==='own'),pn=items.filter(i=>i.gym&&(i.tag==='pnew')),pr=items.filter(i=>i.gym&&i.tag==='prop');
 const li=a=>a.map(i=>`<li><a href="#" data-n="${items.indexOf(i)}">${i.name}</a></li>`).join('');
 document.getElementById('legend').innerHTML=`<b>Gym — owned (Seabreeze inventory)</b><ul>${li(own)}</ul><b>Gym — proposed new gear</b><ul>${li(pn)}</ul><b>Gym — proposed build-out</b><ul>${li(pr)}</ul><b style="color:#d7a6ff">Future (2+ yrs)</b><ul>${li(items.filter(i=>i.tag==='future'))}</ul><b>Site / electrical</b><ul>${li(items.filter(i=>!i.gym&&i.pos&&['elec','solar','site','plan'].includes(i.layer)))}</ul><div class="note">Not modeled (not gym gear): Aeron chair (#20), cigar chairs (#15), white shelving (#35, contents TBD).</div>`;
 document.querySelectorAll('#legend a').forEach(a=>a.onclick=e=>{e.preventDefault();const it=items[+a.dataset.n];showInfo(it);if(it.pos)flyTo(it.pos,40);});}
// layers UI
const lay=document.getElementById('layers');for(const k in LAYERS){lay.insertAdjacentHTML('beforeend',`<label class="t"><input type="checkbox" checked data-l="${k}" onchange="refresh()"> ${LAYERS[k]}</label>`);}
window.refresh=function(){document.querySelectorAll('#layers input').forEach(c=>groups[c.dataset.l].visible=c.checked);
  const roofOn=document.getElementById('roofT').checked,x=document.getElementById('xrayT').checked;roofs.forEach(r=>r.visible=roofOn);
  extWalls.forEach(m=>{const M=Array.isArray(m.material)?m.material[0]:m.material;if(M.userData.o0===undefined)M.userData.o0=M.opacity;M.transparent=x||M.userData.o0<1;M.opacity=x?0.18:M.userData.o0;M.depthWrite=!M.transparent;});
  terrain.material=document.getElementById('satT').checked?satMat:plainMat;};
// ================= CONTROLS v2 =================
let mode='orbit';const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.enableZoom=false;controls.screenSpacePanning=false;controls.maxPolarAngle=Math.PI*0.495;
controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
const home={pos:[-20,190,210],tgt:[-150,20,-70]};
camera.position.set(...home.pos);controls.target.set(...home.tgt);
const player={x:0,z:0,feet:0,yaw:0,pitch:0,vy:0};const keys={};
function groundAt(x,z,feet){let best=elev(x,z);for(const s of surfaces){if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&s.y<=feet+2.6&&s.y>best)best=s.y;}return best;}
function blocked(x,z,feet){const r=0.85;for(const c of colliders){if(c.y1<feet+0.7||c.y0>feet+5.6)continue;if(x+r>c.x0&&x-r<c.x1&&z+r>c.z0&&z-r<c.z1)return true;}return false;}
function move(dx,dz){const n=Math.ceil(Math.hypot(dx,dz)/0.4)||1;for(let i=0;i<n;i++){const sx=dx/n,sz=dz/n;
  if(sx&&!blocked(player.x+sx,player.z,player.feet))player.x+=sx;if(sz&&!blocked(player.x,player.z+sz,player.feet))player.z+=sz;
  const g=groundAt(player.x,player.z,player.feet);if(g>player.feet)player.feet=g;}}
const inHouse=(x,z)=>x>H.x0-0.5&&x<H.x0+34.5&&z<H.z0+0.5&&z>H.z0-32.5;
// ---- camera animation (any mode -> any mode)
let anim=null;
function lookPoint(dist){if(mode==='orbit')return controls.target.clone();const d=new THREE.Vector3();camera.getWorldDirection(d);return camera.position.clone().add(d.multiplyScalar(dist||10));}
function flyCam(toP,toL,dur,done){const fromP=camera.position.clone(),fromL=lookPoint(Math.max(10,toP.distanceTo(toL)));
  const D=fromP.distanceTo(toP);dur=dur||Math.min(2600,Math.max(900,D*6));
  if(document.pointerLockElement)document.exitPointerLock();mode='fly';controls.enabled=false;
  anim={t0:performance.now(),dur,fromP,fromL,toP:toP.clone(),toL:toL.clone(),lift:D>90?Math.min(120,D*0.3):0,done};uiMode();}
function enterOrbit(t,fov){mode='orbit';controls.enabled=true;controls.target.copy(t);camera.near=0.8;camera.fov=fov||55;camera.updateProjectionMatrix();uiMode();}
function enterWalk(s){mode='walk';controls.enabled=false;player.x=s.x;player.z=s.z;player.feet=s.feet!==undefined?s.feet:groundAt(s.x,s.z,elev(s.x,s.z)+1);player.vy=0;
  player.yaw=s.yaw||0;player.pitch=s.pitch||0;camera.rotation.order='YXZ';camera.near=0.2;FOV=s.fov||55;camera.fov=FOV;camera.updateProjectionMatrix();uiMode();}
const walkPose=s=>{const feet=s.feet!==undefined?s.feet:groundAt(s.x,s.z,elev(s.x,s.z)+1);const p=new THREE.Vector3(s.x,feet+5.5,s.z);
  const d=new THREE.Vector3(-Math.sin(s.yaw||0)*Math.cos(s.pitch||0),Math.sin(s.pitch||0),-Math.cos(s.yaw||0)*Math.cos(s.pitch||0));return {p,l:p.clone().add(d.multiplyScalar(10)),feet};};
function goWalk(s,animate){const w=walkPose(s);const ss=Object.assign({},s,{feet:w.feet});if(animate===false){enterWalk(ss);return;}flyCam(w.p,w.l,null,()=>enterWalk(ss));}
function goOrbit(t,pos){const T=new THREE.Vector3(...t),Pp=new THREE.Vector3(...pos);flyCam(Pp,T,null,()=>enterOrbit(T));}
function flyTo(p,dist,dir){const t=new THREE.Vector3(...p);let off;if(dir)off=new THREE.Vector3(...dir).normalize().multiplyScalar(dist);else{const cur=mode==='orbit'?camera.position.clone().sub(controls.target):new THREE.Vector3(0.4,0.6,0.7);off=cur.normalize().multiplyScalar(dist);}
  if(off.y<dist*0.3)off.y=dist*0.5;flyCam(t.clone().add(off),t,null,()=>enterOrbit(t));}
window.flyTo=flyTo;
window.setMode=function(m,spawn){stopTour();
  if(m==='walk'){if(spawn){goWalk(spawn,true);return;}if(mode==='walk')return;const t=mode==='orbit'?controls.target:camera.position;
    const yaw=Math.atan2(-(controls.target.x-camera.position.x),-(controls.target.z-camera.position.z));goWalk({x:t.x,z:t.z,yaw},true);return;}
  if(m==='orbit'){if(mode==='orbit')return;if(mode==='walk'){const d=new THREE.Vector3();camera.getWorldDirection(d);d.y=0;d.normalize();const t=new THREE.Vector3(player.x,player.feet+2,player.z).add(d.clone().multiplyScalar(8));
      const pos=t.clone().add(d.clone().multiplyScalar(-60)).add(new THREE.Vector3(0,45,0));if(document.pointerLockElement)document.exitPointerLock();flyCam(pos,t,1100,()=>enterOrbit(t));}
    else{anim=null;enterOrbit(controls.target);}}};
window.resetView=function(){stopTour();goOrbit(home.tgt,home.pos);};
// ---- trackpad / wheel
let FOV=55;
canvas.parentElement.addEventListener('wheel',e=>{if(e.target.closest&&e.target.closest('#help,#info,#minimapWrap,#tb,#pad,#tourBar'))return;e.preventDefault();
  if(mode==='fly')return;
  if(mode==='walk'){if(e.ctrlKey){FOV=Math.max(28,Math.min(85,FOV+e.deltaY*0.15));camera.fov=FOV;camera.updateProjectionMatrix();return;}
    const f=-e.deltaY*0.035;const turn=e.deltaX*0.003;if(e.shiftKey){player.yaw-=e.deltaY*0.003;return;}
    player.yaw-=turn*(window.__swipeTurn?1:0);const s=window.__swipeTurn?0:e.deltaX*0.035;const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);move(-sy*f+cy*s,-cy*f-sy*s);return;}
  const off=camera.position.clone().sub(controls.target);
  if(e.ctrlKey||e.metaKey){const k=Math.exp(e.deltaY*0.012);off.multiplyScalar(Math.min(4,Math.max(0.25,k)));if(off.length()<4)off.setLength(4);if(off.length()>2500)off.setLength(2500);camera.position.copy(controls.target).add(off);}
  else if(e.shiftKey||e.altKey){const sp=new THREE.Spherical().setFromVector3(off);const dx=e.deltaX||(e.shiftKey?e.deltaY:0),dy=e.shiftKey&&!e.deltaX?0:e.deltaY;
    sp.theta-=dx*0.004;sp.phi=Math.min(Math.PI*0.495,Math.max(0.05,sp.phi+(e.altKey?e.deltaY:dy)*0.004));off.setFromSpherical(sp);camera.position.copy(controls.target).add(off);}
  else if(window.__scrollZoom){const k=Math.exp(e.deltaY*0.004);off.multiplyScalar(Math.min(3,Math.max(0.3,k)));if(off.length()<4)off.setLength(4);camera.position.copy(controls.target).add(off);}
  else{const d=off.length()*0.0016;const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);right.y=0;right.normalize();
    const fwd=new THREE.Vector3(-off.x,0,-off.z).normalize();const mv=right.multiplyScalar(e.deltaX*d).add(fwd.multiplyScalar(-e.deltaY*d));camera.position.add(mv);controls.target.add(mv);}
},{passive:false});
// Safari pinch gesture events (trackpad) for orbit zoom / walk FOV
let gs=1;addEventListener('gesturestart',e=>{e.preventDefault();gs=1;});addEventListener('gesturechange',e=>{e.preventDefault();const k=gs/e.scale;gs=e.scale;
  if(mode==='orbit'){const off=camera.position.clone().sub(controls.target).multiplyScalar(k);if(off.length()>4)camera.position.copy(controls.target).add(off);}else if(mode==='walk'){FOV=Math.max(28,Math.min(85,FOV*k));camera.fov=FOV;camera.updateProjectionMatrix();}});
// ---- drag look (mouse / touch) + pointer lock
let drag=null;canvas.style.touchAction='none';
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,moved:0,id:e.pointerId};});
addEventListener('pointerup',e=>{if(drag&&drag.moved<5&&!document.pointerLockElement)onClick(e);drag=null;});
addEventListener('pointermove',e=>{if(document.pointerLockElement===canvas){if(mode==='walk'){player.yaw-=e.movementX*0.0025;player.pitch=Math.max(-1.3,Math.min(1.3,player.pitch-e.movementY*0.0025));}return;}
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;
  if(mode==='walk'){const k=e.pointerType==='touch'?0.006:0.004;player.yaw-=dx*k;player.pitch=Math.max(-1.3,Math.min(1.3,player.pitch-dy*k));}});
window.lockMouse=function(){if(mode!=='walk')setMode('walk');setTimeout(()=>canvas.requestPointerLock&&canvas.requestPointerLock(),mode==='walk'?0:1500);};
document.addEventListener('pointerlockchange',()=>{const b=document.getElementById('bLock');if(b)b.classList.toggle('on',!!document.pointerLockElement);hud();});
// ---- keyboard
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;keys[e.code]=true;
  if(e.key==='h'||e.key==='?')toggleHelp();if(e.key==='Escape'){toggleHelp(false);stopTour();}
  if(e.key==='l'||e.key==='L'){if(mode==='walk'&&inHouse(player.x,player.z))goLevel(player.feet<HM-1?'main':'lower');}
  if(e.code==='PageUp'||e.key===']')levelStep(1);if(e.code==='PageDown'||e.key==='[')levelStep(-1);
  if(e.key==='o'||e.key==='O')setMode('orbit');if(e.key==='f'||e.key==='F')setMode('walk');if(e.key==='p'||e.key==='P')lockMouse();if(e.key==='t'||e.key==='T')toggleTour();
  if(e.key==='r'||e.key==='R')resetView();if(e.key==='m'||e.key==='M')cycleMini();
  if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();});
addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
// ---- levels in walk mode
const LV={lower:{feet:HL,spawn:[27,16]},main:{feet:HM,spawn:[14,10.6]},loft:{feet:HM+9.4,spawn:[10,15]}};
function curLevel(){if(!inHouse(player.x,player.z))return null;return player.feet<HM-1?'lower':player.feet<HM+5?'main':'loft';}
function goLevel(l){const L=LV[l];const [x,z]=H.P(...L.spawn);const yaw=l==='lower'?Math.PI/4:l==='main'?-Math.PI/2:0;goWalk({x,z,feet:L.feet,yaw},true);}
window.goLevel=goLevel;
function levelStep(d){const order=['lower','main','loft'];let c=mode==='walk'?curLevel():null;if(!c){goLevel(d>0?'main':'lower');return;}const i=Math.max(0,Math.min(2,order.indexOf(c)+d));if(order[i]!==c)goLevel(order[i]);}
window.levelStep=levelStep;
const ray=new THREE.Raycaster();function onClick(e){const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;const m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(m,camera);ray.far=Infinity;const hits=ray.intersectObjects(pickables.filter(p=>{let o=p;while(o){if(!o.visible)return false;o=o.parent;}return true;}),false);if(hits.length)showInfo(hits[0].object.userData.item);}
window.toggleHelp=function(v){const h=document.getElementById('help');h.style.display=(v===undefined?h.style.display!=='flex':v)?'flex':'none';};
// ================= PROPOSED FURNISHING (Seabreeze inventory #, 2026-10-26) =================
// Design intent: MAIN = entertaining lounge/club; LOWER = clean, modern, cozy master retreat; LOFT = guest loft (guests/kids)
window.__furn=[];
function FP(name,tag,text,u0,v0,u1,v1,h,color,y0){const t=tag||'prop';const m=lbox('house',H,Math.min(u0,u1),Math.min(v0,v1),Math.max(u0,u1),Math.max(v0,v1),h,color,t,info(name,t,text,null,{near:true}),y0,{collide:true});window.__furn.push({name,c:colliders[colliders.length-1],mesh:m});return m;}
// MAIN LEVEL — entertaining
FP('Great room lounge — MAIN level = entertaining (zone label)','prop','Lounge/club look: piano, cigar chairs, low sofa, back bar, art wall. Existing vaulted wood tongue-and-groove ceiling and wood character are KEPT (Clark, Oct 26); modern furnishings around it.',22,10.5,22.2,10.7,0.1,0xd19a5b,0);
FP('#5 Steinway Model B grand (6′11″ × 4′10″, ~760 lb)','own','Interior zone beside the stair, ~12 ft from the east glass and out of direct sun; keep off any heat register. Lid shown raised. Add a Dampp-Chaser humidity system (vaulted wood room). Keyboard faces the lounge.',15.0,3.0,21.92,7.83,3.3,0x111111,0);
FP('#5 Steinway lid (raised)','own','Lid prop ~45°.',13,1.2,13.01,1.21,0.01,0x222222,3.3);
FP('#5 Steinway artist bench','own','Placeholder 3 × 1.2 ft.',22.8,3.9,24.0,6.9,1.6,0x222222,0);
FP('#2 Carved dark-wood panel with mirrored mosaic inlay (art wall)','own','Inventory: ~4 ft wide (height not logged — placeholder 3 ft). Feature wall = interior west wall of the lounge: no sun, no heat, faces the vaulted space and the entry sightline. Hang on a French cleat into studs (add blocking if pine/paneling covers it); picture light or ceiling accent wash.',12.15,4,12.35,8,3,0x4a2e1a,5.2);
FP('#4 Tufted dark-leather bench / cocktail table','own','Placeholder 4 × 2 ft. Centered in the lounge group.',27.6,6.3,29.6,10.3,1.5,0x2a1c14,0);
FP('#15 Black leather cigar chair (1 of 2)','own','Placeholder 3 × 3 ft (dims not logged). Faces the sofa.',30.8,5.0,33.8,8.0,3,0x111111,0);
FP('#15 Black leather cigar chair (2 of 2)','own','Placeholder 3 × 3 ft.',30.8,8.6,33.8,11.6,3,0x111111,0);
FP('Back bar / bar cabinet (proposed new)','pnew','~7 ft bar cabinet on the south wall with display shelving above; bar cart alternative.',26,0.3,33,2,3.5,0x3a2a20,0);
FP('Kitchen island ~9 × 4.1 ft, quartz, seats 4, storage both sides (proposed)','prop','Replaces the dining area (no formal dining). 42-48 in work aisle to the north counters; 12-15 in seating overhang on the south; optional prep sink; required island outlet; 2-3 pendants.',21,23.0,30,26,3,0xf4f4f4,0);
for(let i=0;i<4;i++)FP('Counter stool '+(i+1)+' of 4 (proposed new)','pnew','24 in per stool; 36-44 in clear behind.',21.8+i*2.2,20.1,23.2+i*2.2,21.5,2.5,0x2b2b2b,0);
// deck
FP('Teak dining table 8 ft + 8 chairs on the deck (proposed new)','pnew','e.g. Country Casual Hudson 8 ft ($4,176) or Cascade 8 ft (95.75 × 41.5 in, $6,650). Long axis along the 10 ft deck; ~8.5 ft incl. chairs (tight on a 10 ft deck; better on the wider wrap section). Cover or store in the pole barn for winter.',36.7,12,40.2,20,2.5,0x9a6a3a,0);
// main bedroom 1 -> office
FP('#6 Glass-top desk, black frame (~5 ft)','own','Main bedroom 1 becomes the office.',1.5,1.5,6.5,4,2.5,0x9ad0e0,0);
FP('#20 Herman Miller Aeron chair','own','',3,4.3,5,6.3,3.5,0x555555,0);
// LOFT — guest loft
FP('LOFT = guest loft for guests / kids (zone label)','prop','',7,16,7.2,16.2,0.1,0xd19a5b,9.4);
FP('#13 Milan\'s full bed, navy tufted headboard (guest loft)','own','Full bed ~4.6 × 6.9 ft (std); headboard height must clear the roof slope — measure the knee wall.',4.5,20,9.1,26.9,3.5,0x22305a,9.4);
FP('#14 Milan\'s nightstand (white)','own','',9.4,25,11,26.5,2,0xffffff,9.4);
FP('#10 Kids desk with raised shelf + #11 white chair + #12 monitor (guest loft)','own','Under a skylight on the flat-ceiling side; measure before moving.',4.5,4,9,6.2,2.6,0xf2f2f2,9.4);
FP('Daybed / sleeper sofa — 2nd sleeping option (proposal only)','pnew','Twin daybed with trundle, ~3.3 × 6.6 ft.',4.5,9,11.1,12.3,2.5,0x8a8aa0,9.4);
// LOWER — master retreat
FP('LOWER = clean, modern, cozy master retreat (zone label)','prop','Primary bedroom + primary bath + sitting/TV room + morning-coffee spot at the walk-out.',30,20,30.2,20.2,0.1,0xd19a5b,-9);
FP('#3 Seabreeze gray sectional, large L — size to verify','own','Real dimensions are not in the move inventory or notes, so this is a 12 × 10 ft L, 40 in deep (SIZE TO VERIFY). In the NW corner of the lower level, facing a TV on a new media wall ~12 ft away; ≥3 ft walkways. 10 ft to the TV. Keeps a ~7 ft clear path from the walk-out to the bedroom/bath doors. Deliver through the walk-out sliders; confirm it splits into sections.',0.3,20,3.63,32,2.4,0x8a8f96,-9);
FP('#3 Sectional chaise (left)','own','',3.63,28.67,10.3,32,2,0x8a8f96,-9);
FP('#3 Sectional chaise (right)','own','',3.63,31.9,3.64,31.91,0.01,0x8a8f96,-9);
FP('#7 White media console (4-door) + #9 soundbar/sub','own','Placeholder 6 × 1.5 ft, on the north wall.',13.3,23,14.75,29,2.2,0xffffff,-9);
FP('#8 Samsung 75″ TV (wall-mounted)','own','~5.5 × 3.1 ft; on the new media wall, ~12 ft from the sectional main seat.',14.6,23.25,14.75,28.75,3.1,0x050505,-5.7);
FP('Coffee bar nook (proposed): counter, outlet for espresso, optional small sink','prop','~5.5 ft base cabinets + quartz on the wall shared with laundry (easy water/drain). Dedicated 20 A circuit.',18.5,12.3,24,14.3,3,0xe8e0d0,-9);
FP('Morning coffee: 2 chairs + café table at the walk-out patio (proposed new)','pnew','Under-deck concrete pad seen in p49. Upgrade: extend with pavers ~12 × 14 ft.',35.5,8,39.5,12,2.8,0x6a5040,-9);

// ================= v2 DETAIL PASS (2026-10-26 night) =================
// Approximate fixtures/finishes for the modern remodel concept. Positions/sizes are illustrative unless a note says otherwise.
const P=H.P, PL=(g,c,x,y,z,layer,opt)=>{const m=new THREE.Mesh(g,opt&&opt.mat?opt.mat:new THREE.MeshLambertMaterial(Object.assign({color:c},opt||{})));m.position.set(x,y,z);groups[layer||'house'].add(m);return m;};
const Dx=(u0,v0,u1,v1,h,c,y0,col,layer,F)=>lbox(layer||'house',F||H,Math.min(u0,u1),Math.min(v0,v1),Math.max(u0,u1),Math.max(v0,v1),h,c,'photo',null,y0,{collide:!!col,edges:false});
const BLK=0x1d1f22, WHT=0xf7f7f4, OAK=0xc9a97c, STL=0xc3c7ca;
const emis=c=>new THREE.MeshBasicMaterial({color:c});
function toilet(u,v,side,y0){const d={N:[0,1],S:[0,-1],E:[1,0],W:[-1,0]}[side];const y=HM+y0;
  const tk=P(u-d[0]*0.35,v-d[1]*0.35),bw=P(u-d[0]*1.45,v-d[1]*1.45);
  const t=PL(new THREE.BoxGeometry(d[0]?0.7:1.7,1.3,d[0]?1.7:0.7),WHT,tk[0],y+2.0,tk[1]);
  const b=PL(new THREE.CylinderGeometry(0.62,0.5,1.35,20),WHT,bw[0],y+0.68,bw[1]);b.scale.set(d[0]?1.35:1,1,d[0]?1:1.35);
  PL(new THREE.CylinderGeometry(0.64,0.64,0.1,20),WHT,bw[0],y+1.4,bw[1]).scale.set(d[0]?1.35:1,1,d[0]?1:1.35);
  PL(new THREE.BoxGeometry(0.3,0.06,0.12),BLK,tk[0],y+2.68,tk[1]);
  colliders.push({x0:Math.min(tk[0],bw[0])-0.8,x1:Math.max(tk[0],bw[0])+0.8,z0:Math.min(tk[1],bw[1])-0.8,z1:Math.max(tk[1],bw[1])+0.8,y0:y,y1:y+2.7});}
function vanity(u0,v0,u1,v1,y0,sinks,mirrorSide){Dx(u0,v0,u1,v1,2.75,OAK,y0,true);Dx(u0-0.05,v0-0.05,u1+0.05,v1+0.05,0.12,WHT,y0+2.75);
  const alongV=Math.abs(v1-v0)>Math.abs(u1-u0);for(let i=0;i<sinks;i++){const f=(i+0.5)/sinks;const u=alongV?(u0+u1)/2:u0+(u1-u0)*f,v=alongV?v0+(v1-v0)*f:(v0+v1)/2;const p=P(u,v);
    PL(new THREE.CylinderGeometry(0.62,0.5,0.35,24),WHT,p[0],HM+y0+3.02,p[1]);
    const fp=P(alongV?(mirrorSide==='W'?u0+0.25:u1-0.25):u,alongV?v:(mirrorSide==='S'?v0+0.25:v1-0.25));PL(new THREE.CylinderGeometry(0.05,0.05,0.9,8),BLK,fp[0],HM+y0+3.3,fp[1]);
    // mirror + sconce
    const mp=alongV?P(mirrorSide==='W'?u0-0.02:u1+0.02,v):P(u,mirrorSide==='S'?v0-0.02:v1+0.02);
    PL(new THREE.BoxGeometry(alongV?0.06:2,2.6,alongV?2:0.06),0x6f8796,mp[0],HM+y0+5.0,mp[1],'house',{mat:new THREE.MeshPhongMaterial({color:0x8fa7b5,shininess:150,specular:0xffffff})});
    PL(new THREE.BoxGeometry(alongV?0.08:2.1,2.7,alongV?2.1:0.08),BLK,mp[0]+(alongV?(mirrorSide==='W'?-0.03:0.03):0),HM+y0+5.0,mp[1]+(alongV?0:(mirrorSide==='S'?0.03:-0.03)));
    PL(new THREE.CylinderGeometry(0.12,0.12,0.5,10),0xfff2cc,mp[0],HM+y0+6.7,mp[1],'house',{mat:emis(0xfff2cc)});}}
function acrylicShower(u0,v0,u1,v1,y0){Dx(u0,v0,u1,v1,0.35,WHT,y0);const cx=(u0+u1)/2,cv=(v0+v1)/2;
  for(const [a,b,c,d] of [[u0,v0,u1,v0+0.06],[u0,v0,u0+0.06,v1],[u1-0.06,v0,u1,v1],[u0,v1-0.06,u1,v1]]){const [x,z]=P((a+c)/2,(b+d)/2);
    const m=PL(new THREE.BoxGeometry(Math.max(0.06,Math.abs(c-a)),6.4,Math.max(0.06,Math.abs(d-b))),0,x,HM+y0+3.55,z,'house',{mat:GLASS});panes.push(m);}
  for(const [a,b] of [[u0,v0],[u1,v0],[u0,v1],[u1,v1]]){const [x,z]=P(a,b);PL(new THREE.BoxGeometry(0.1,6.4,0.1),BLK,x,HM+y0+3.55,z);}
  const [x,z]=P(cx,cv);PL(new THREE.CylinderGeometry(0.45,0.45,0.05,20),BLK,x,HM+y0+7,z);
  colliders.push({x0:Math.min(P(u0,v0)[0],P(u1,v1)[0]),x1:Math.max(P(u0,v0)[0],P(u1,v1)[0]),z0:Math.min(P(u0,v0)[1],P(u1,v1)[1]),z1:Math.max(P(u0,v0)[1],P(u1,v1)[1]),y0:HM+y0,y1:HM+y0+7});}
function closet(u0,v0,u1,v1,y0,doorFace){Dx(u0,v0,u1,v1,7.6,0xfbfbf8,y0,true);const n=Math.max(2,Math.round(Math.max(Math.abs(u1-u0),Math.abs(v1-v0))/2.5));
  for(let i=1;i<n;i++){const f=i/n;const alongV=doorFace==='E'||doorFace==='W';const u=alongV?(doorFace==='E'?u1+0.02:u0-0.02):u0+(u1-u0)*f,v=alongV?v0+(v1-v0)*f:(doorFace==='N'?v1+0.02:v0-0.02);const p=P(u,v);
    PL(new THREE.BoxGeometry(alongV?0.04:0.03,7.2,alongV?0.03:0.04),0x9a9a9a,p[0],HM+y0+3.7,p[1]);
    const h=P(alongV?u:u-0.25,alongV?v-0.25:v);PL(new THREE.BoxGeometry(alongV?0.1:0.05,1.6,alongV?0.05:0.1),BLK,h[0],HM+y0+3.6,h[1]);}}
const RUGS=[];function rug(u0,v0,u1,v1,y0,c){const r=Dx(u0,v0,u1,v1,0.04,c,y0+0.005);RUGS.push([r,c,u1-u0,v1-v0]);return r;}
function pendant(u,v,yTop,y0){const p=P(u,v);PL(new THREE.CylinderGeometry(0.02,0.02,yTop-y0,6),BLK,p[0],HM+(y0+yTop)/2,p[1]);PL(new THREE.CylinderGeometry(0.35,0.55,0.6,16,1,true),BLK,p[0],HM+y0,p[1],'house',{side:THREE.DoubleSide});PL(new THREE.SphereGeometry(0.22,10,8),0,p[0],HM+y0-0.2,p[1],'house',{mat:emis(0xffe2a8)});}
function can(u,v,yC,layer,F){const p=(F||H).P(u,v);PL(new THREE.CylinderGeometry(0.28,0.28,0.04,14),0,p[0],(F||H).y+yC-0.03,p[1],layer||'house',{mat:emis(0xfff4d8)});}

// ---- stairs: lower flight (u12.5-14.5) rises south v19.5→12.5 from HL to HM; loft flight (u14.5-16.5) rises north v12.5→19.5 from HM to HM+9.4
{const tread=new THREE.MeshLambertMaterial({color:0xc9b08a}),riserM=new THREE.MeshLambertMaterial({color:0xf3f0ea});
 const step=(u0,u1,va,vb,yBot,yTop)=>{const a=P(u0,va),b=P(u1,vb);const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,w=Math.abs(b[0]-a[0]),d=Math.abs(b[1]-a[1]);
   const m=new THREE.Mesh(new THREE.BoxGeometry(w,yTop-yBot,d),[riserM,riserM,tread,riserM,riserM,riserM]);m.position.set(x,(yBot+yTop)/2,z);groups.house.add(m);occl.push(m);
   surf(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1]),yTop);colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:yBot,y1:yTop});};
 const N1=15;for(let k=1;k<=N1;k++){const va=19.5-(k-1)*7/N1,vb=19.5-k*7/N1;step(12.5,14.5,vb,va,HL,HL+k*9/N1);}
 const N2=16;for(let k=1;k<=N2;k++){const va=12.5+(k-1)*7/N2,vb=12.5+k*7/N2;step(14.5,16.5,va,vb,HM,HM+k*9.4/N2);}
 Dx(14.5,12.5,16.5,19.5,9,0xe9e4dc,-9,true); // enclosed under-stair storage below the loft flight
 const st=P(14.5,16);STAIR_INFO.pos=[st[0],HM+3,st[1]];
 // landing at loft level + rails (black steel, modern)
 {const a=P(13.5,19.5),b=P(16.5,21.2);floor('house',a[0],a[1],b[0],b[1],HM+9.4,0xc9b08a,'photo');}
 railing('house',P(12.5,12.6),P(12.5,19.5),HM,BLK);railing('house',P(12.5,19.5),P(14.5,19.5),HM,BLK);railing('house',P(16.5,12.6),P(16.5,19.5),HM,BLK);
 railing('house',P(14,0.5),P(14,19.5),HM+9.4,BLK);railing('house',P(14,21.2),P(14,31.5),HM+9.4,BLK);railing('house',P(16.5,19.5),P(16.5,21.2),HM+9.4,BLK);railing('house',P(13.5,21.2),P(16.5,21.2),HM+9.4,BLK);
 // loft walkable + headroom limits (invisible)
 surf(H.x0,H.z0-32,H.x0+14,H.z0,HM+9.4);
 for(const [a,b] of [[P(0,3.6),P(14,3.4)],[P(0,28.6),P(14,28.4)],[P(-0.4,0),P(0.2,32)]])colliders.push({x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1]),y0:HM+9.4,y1:HM+20});}

{const wood=new THREE.MeshLambertMaterial({color:0x9a6a3c});const a=H.P(0,16),b=H.P(34,16);const rb=new THREE.Mesh(new THREE.BoxGeometry(34,1.0,0.7),wood);rb.position.set((a[0]+b[0])/2,HM+28.4,a[1]);groups.house.add(rb);
 for(const v of [6,26]){const y=HM+9+20*(1-Math.abs(v-16)/16)-0.9;const p=H.P(17,v);const pb=new THREE.Mesh(new THREE.BoxGeometry(34,0.6,0.5),wood);pb.position.set(p[0],y,p[1]);groups.house.add(pb);}
 // wood trim around the east glass gable openings
 for(const [v0,v1,h] of [[1,7,8.4],[8,24,7.5],[25,31,8.4]]){const c=H.P(33.65,(v0+v1)/2);const t1=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.35,v1-v0+0.6),wood);t1.position.set(c[0],HM+h+0.15,c[1]);groups.house.add(t1);}}
// ---- LOWER: master suite
rug(1.2,1.2,9.2,10.8,-9,0xd8d2c6);
Dx(0.4,3,7.4,9.7,1.1,0x6b4f3a,-9,true);Dx(0.6,3.1,7.3,9.6,0.9,0xf4f2ee,-7.9);Dx(3.6,3.0,7.4,9.7,0.35,0x9aa3ad,-7.0); // platform king, duvet throw
Dx(0.4,2.8,0.95,9.9,4.2,0x8a7a6a,-9);Dx(1.0,3.6,2.2,5.9,0.45,WHT,-7.0);Dx(1.0,6.8,2.2,9.1,0.45,WHT,-7.0); // headboard + pillows
Dx(0.4,1.1,2.1,2.7,2,0x6b4f3a,-9,true);Dx(0.4,10.0,2.1,11.6,2,0x6b4f3a,-9,true);
for(const v of [1.9,10.8]){const p=P(1.2,v);PL(new THREE.CylinderGeometry(0.35,0.45,0.8,14),0xf2e6cc,p[0],HL+2.6,p[1],'house',{mat:emis(0xf6e7c8)});}
closet(9.7,0.5,11.75,7.2,-9,'W');
info('Lower MASTER bedroom (concept)','prop','King platform bed on the west wall, two nightstands, finished reach-in closet with flat white doors (remodel: finish closets + add doors). Light oak floor, warm-white walls, black hardware. Egress window size to be measured at the visit.',[P(5,6)[0],HL+5,P(5,6)[1]],{near:true,layer:'house'});
// lower PRIMARY bath — Option B concept
{const p=P(15,1.85);const tub=PL(new THREE.CylinderGeometry(1,0.92,1.9,28),WHT,p[0],HL+0.95,p[1]);tub.scale.set(2.45,1,1.15);
 const inn=PL(new THREE.CylinderGeometry(0.9,0.9,0.05,28),0xdfe8ee,p[0],HL+1.86,p[1]);inn.scale.set(2.3,1,1.0);
 colliders.push({x0:p[0]-2.5,x1:p[0]+2.5,z0:p[1]-1.2,z1:p[1]+1.2,y0:HL,y1:HL+1.9});
 const f=P(17.5,1.85);PL(new THREE.CylinderGeometry(0.05,0.05,3.2,8),BLK,f[0]-0.3,HL+1.6,f[1]);}
acrylicShower(15,3.6,17.75,6.6,-9);vanity(12.3,4.0,14.1,9.6,-9,2,'W');toilet(17.75,8.3,'E',-9);
Dx(12.3,0.3,17.7,11.7,0.03,0xe6e6e2,-9+0.01);
info('Lower PRIMARY bath concept (Option B)','prop','Freestanding tub + 36×60-style acrylic shower + double vanity + matching toilet. The existing room is only ~5×9 (long and narrow) — this layout needs space borrowed from the craft/storage room (Option B, mid ~$50K). Measure at the visit.',[P(15,6)[0],HL+8,P(15,6)[1]],{near:true,layer:'house'});
// lower sitting / TV + coffee nook details
rug(4.2,20.5,12.8,28.2,-9,0xcfc8bb);Dx(14.75,21.5,15.3,30.5,8,0xe9e6df,-9,true);info('Proposed media wall (TV + console)','prop','Short new partition (~9 ft) so the TV faces the corner sectional at ~12 ft. Walkway ≥4.5 ft between the sectional end and the media wall; the walk-out path behind it stays open.',[H.P(15,26)[0],HL+9,H.P(15,26)[1]],{near:true,layer:'house'});can(17,24,0,'house');can(26,20,0,'house');can(6,6,0,'house');can(15,6,0,'house');
// walk-out patio pavers under the deck + coffee spot
{const a=P(34.3,1),b=P(44,14);const pv=box('site',(a[0]+b[0])/2,HL-0.18,(a[1]+b[1])/2,Math.abs(b[0]-a[0]),0.2,Math.abs(b[1]-a[1]),0xbab3a6,'photo',null,{edges:false});texMat(pv.material,'tile',3,3);surf(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1]),HL);}

// ---- MAIN: kitchen, baths, bedrooms, lounge
Dx(17,29.9,34,32,0.15,WHT,3);                       // quartz on existing perimeter run
Dx(17,29.2,19.9,32,6.9,STL,0,true);                  // fridge (stainless, seen p05)
Dx(20,30.9,23,32,2.6,WHT,4.7);Dx(27.2,30.9,34,32,2.6,WHT,4.7); // uppers
Dx(28.2,30.1,30.7,32,0.1,0x111111,3.16);Dx(28.4,30.6,30.5,32,1.2,STL,5.6); // range top + hood
{const p=P(25,31.4);PL(new THREE.BoxGeometry(2.2,0.1,1.2),0x333333,p[0],HM+3.12,p[1]);PL(new THREE.CylinderGeometry(0.05,0.05,1.1,8),BLK,p[0],HM+3.7,p[1]-0.4);}
Dx(20.8,21.9,30.2,26.2,0.15,WHT,3);Dx(21,22.95,30,23.05,2.85,0x3b4048,0.05);for(let i=0;i<6;i++){Dx(21.1+i*1.48,22.9,21.1+i*1.48+0.04,22.95,2.7,0x2a2d33,0.12);Dx(21.55+i*1.48,22.86,22.15+i*1.48,22.9,0.06,0x111111,2.45);}info('Island seating-side storage: shallow 13 in cabinets','prop','Seating side gets 13 in-deep flat-panel cabinets (charcoal) under a 12-13 in quartz overhang. Island grows to ~49 in deep (24 in base + 13 in cabinets + 12 in overhang) so knees still fit. Work aisle to the perimeter run stays ~46 in.',[H.P(25.5,22.5)[0],HM+4.5,H.P(25.5,22.5)[1]],{near:true,layer:'house'}); // island quartz + charcoal seating face
for(const u of [23,25.5,28])pendant(u,24.25,9.5,6.6);
// main bath (fiberglass tub/shower unit, new vanity, matching toilet)
Dx(0.3,12.3,5.3,14.9,1.7,WHT,0,true);Dx(0.3,12.3,5.3,12.5,6.6,WHT,0);Dx(0.3,12.3,0.5,14.9,6.6,WHT,0);Dx(5.1,12.3,5.3,14.9,6.6,WHT,0);
{const p=P(2.8,14.95);PL(new THREE.BoxGeometry(5,0.04,0.04),BLK,p[0],HM+6.6,p[1]);}
vanity(0.3,15.4,1.9,18.6,0,1,'W');toilet(7.75,14,'E',0);
info('Main bath concept','prop','One-piece fiberglass/acrylic tub-shower unit, new vanity + quartz top if the existing one reads dated (p27/p28), black fixtures, toilet matching the other two baths.',[P(4,16)[0],HM+7,P(4,16)[1]],{near:true,layer:'house'});
closet(9.6,0.5,11.75,6,0,'W');closet(9.6,26,11.75,31.5,0,'W');
rug(14,1.5,27,10,0,0x8e8174);
{const p=P(13,10.6);PL(new THREE.CylinderGeometry(0.04,0.04,5.5,8),BLK,p[0],HM+2.75,p[1]);PL(new THREE.CylinderGeometry(0.4,0.5,0.8,14),0,p[0],HM+5.6,p[1],'house',{mat:emis(0xffe9c0)});}
// ---- LOFT: guest loft with shower-only ¾ bath
lwall('house',H,0,13,4.4,13,9.4,7.5,iw,'photo',[]);lwall('house',H,0,19.2,4.4,19.2,9.4,7.5,iw,'photo',[]);lwall('house',H,4.4,13,4.4,19.2,9.4,7.5,iw,'photo',[[3.4,5.9,6.8]]);
acrylicShower(0.3,13.3,3.3,16.3,9.4);toilet(0.3,17.9,'W',9.4);
info('Loft ¾ bath: shower only (concept)','prop','Acrylic shower enclosure (no tub), small vanity, matching toilet. Location in the loft is inferred.',[P(2,16)[0],HM+18,P(2,16)[1]],{near:true,layer:'house'});
rug(4.6,17.5,11.5,27.8,9.4,0xc9c3d6);

// ---- Barn + gym LED strips, apron details
for(const [F,y,w,d,n] of [[PB,PBy+11.6,32,38,4],[GY,GYy+9.6,28,30,3]]){for(let i=1;i<=n;i++){const u=w*i/(n+1);const a=F.P(u,d/2);PL(new THREE.BoxGeometry(0.4,0.1,d-6),0,a[0],y,a[1],F===PB?'barn':'gym',{mat:emis(0xf4f8ff)});}}
// gym: wall mirror + rubber tile texture
{const a=GY.P(8,29.8);PL(new THREE.BoxGeometry(8,6,0.08),0,a[0],GYy+4,a[1],'gym',{mat:new THREE.MeshPhongMaterial({color:0x9fb3bf,shininess:150,specular:0xffffff})});}

// ---- landscaping: shrubs + boulders around the house (illustrative)
{let s=11;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};const sg=new THREE.SphereGeometry(1,10,8),sm=new THREE.MeshLambertMaterial({color:0x3f6e35}),bm=new THREE.MeshLambertMaterial({color:0x9a958c});
 const n=46,im=new THREE.InstancedMesh(sg,sm,n),bi=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1),bm,30),o=new THREE.Object3D();
 for(let i=0;i<n;i++){const side=i%3;let u,v;if(side===0){u=-2-rnd()*2;v=rnd()*20;}else if(side===1){u=rnd()*33;v=-2-rnd()*2.5;}else{u=46+rnd()*4;v=17+rnd()*15;}
   const [x,z]=P(u,v);const sc=1+rnd()*1.4;o.position.set(x,elev(x,z)+sc*0.7,z);o.scale.set(sc,sc*0.8,sc);o.updateMatrix();im.setMatrixAt(i,o.matrix);}
 for(let i=0;i<30;i++){const a=i/30*Math.PI*2;const x=W(345)+Math.cos(a)*(26+rnd()*4),z=Zs(296)+Math.sin(a)*(17+rnd()*3);const sc=0.8+rnd()*1.3;o.position.set(x,rawElev(x,z)+sc*0.4,z);o.scale.set(sc,sc*0.7,sc);o.rotation.set(rnd(),rnd(),0);o.updateMatrix();bi.setMatrixAt(i,o.matrix);}
 groups.site.add(im);groups.site.add(bi);}

// ---- lighting: interior warm fills (no shadows) + sun shadows near the buildings
const ilights=[];for(const [x,y,z] of [[...P(24,10),HM+8],[...P(25,24),HM+7],[...P(20,22),HL+7.5],[...P(6,6),HL+7.5],[...P(8,20),HM+16],[GY.x0+14,GYy+9,GY.z0-15],[PB.x0+16,PBy+11,PB.z0-19]]){const l=new THREE.PointLight(0xffe6c4,0.55,30,1.2);l.position.set(x,y,z);scene.add(l);ilights.push(l);}
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);{const c=sun.shadow.camera;c.left=-170;c.right=170;c.top=170;c.bottom=-170;c.near=10;c.far=1500;}
sun.shadow.bias=-0.0008;sun.shadow.normalBias=0.4;sun.target.position.set(W(240),HM,Zs(220));scene.add(sun.target);sun.position.set(W(240)-260,HM+520,Zs(220)+340);
for(const k of ['bldg','house','barn','gym','trees','site'])groups[k].traverse(o=>{if(o.isMesh||o.isInstancedMesh){if(o.material===GLASS||(o.material&&o.material.isMeshBasicMaterial))return;o.castShadow=k!=='site';o.receiveShadow=true;}});
terrain.receiveShadow=true;
// ---- GYM polish: full rubber floor, loaded barbell, plates, recovery zone, wall-ball zone
window.__gymLeg0=groups.gym.children.length;
{const g=groups.gym,F=GY,add=(geo,c,u,v,yy,m)=>{const p=F.P(u,v);const o=new THREE.Mesh(geo,m||new THREE.MeshLambertMaterial({color:c}));o.position.set(p[0],GYy+yy,p[1]);g.add(o);return o;};
 const fl=lbox('gym',GY,0.25,0.25,27.75,29.75,0.04,0x262626,'photo',null,0.02,{edges:false});texMat(fl.material,'tile',7,7.5);
 const bar=new THREE.CylinderGeometry(0.08,0.08,7.2,10);bar.rotateZ(Math.PI/2);const plate=new THREE.CylinderGeometry(1.48,1.48,0.25,24);plate.rotateZ(Math.PI/2);
 for(const [v,c] of [[9.3,0xc23b3b],[20.8,0x2f6fb5]]){add(bar,0xbfc4c8,16,v,1.48);for(const sd of [-1,1])add(plate,c,16+sd*2.9,v,1.48);}
 add(new THREE.CylinderGeometry(0.08,0.08,9.6,10).rotateZ(Math.PI/2),0xbfc4c8,16,12.6,4.6); // bar in the J-cups on the rig
 lbox('gym',GY,0.2,26,7.2,29.8,0.05,0x6c7a86,'photo',null,0.07,{edges:false}); // recovery zone floor (light gray)
 add(new THREE.BoxGeometry(5.2,0.05,2.4),0x5ec8ff,9.75,28.65,2.0,new THREE.MeshPhongMaterial({color:0x6fd0ff,shininess:120,transparent:true,opacity:.85}));
 info('Recovery corner: cold plunge + mobility (owned #36 plunge)','own','Cold plunge (owned, "take to Michigan"), mobility mats, foam rollers; optional sauna concept beside it. Light gray floor zone.',[GY.P(5,27)[0],GYy+8,GY.P(5,27)[1]],{gym:true,near:true});
 lbox('gym',GY,0.3,19.5,0.35,24.5,6,0x9fb3bf,'photo',null,1,{edges:false}); // second mirror, west wall
 for(const u of [6,14,22])for(const v of [8,22])can(u,v,9.9,'gym',GY);}

// ---- Proposed extras (each labelled with a published cost range)
const EXTRAS=[];
{// fire pit + paver patio by the walk-out
 const c=H.P(52,6);const y=rawElev(c[0],c[1]);const pv=new THREE.Mesh(new THREE.CylinderGeometry(8,8,0.25,40),new THREE.MeshLambertMaterial({color:0xb8afa2}));pv.position.set(c[0],y+0.1,c[1]);texMat(pv.material,'tile',4,4);groups.site.add(pv);
 const ring=new THREE.Mesh(new THREE.CylinderGeometry(2,2.2,1.4,24,1,true),new THREE.MeshLambertMaterial({color:0x6d6a66,side:THREE.DoubleSide}));ring.position.set(c[0],y+0.9,c[1]);groups.site.add(ring);
 const fire=new THREE.Mesh(new THREE.ConeGeometry(1,1.6,10),new THREE.MeshBasicMaterial({color:0xff8a2a}));fire.position.set(c[0],y+1.2,c[1]);groups.site.add(fire);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const cm2=new THREE.MeshLambertMaterial({color:0x8a6a48});const grp=new THREE.Group();const st=new THREE.Mesh(new THREE.BoxGeometry(2,0.25,2),cm2);st.position.y=1.3;grp.add(st);const bk=new THREE.Mesh(new THREE.BoxGeometry(0.25,2.4,2),cm2);bk.position.set(1,2.3,0);bk.rotation.z=-0.25;grp.add(bk);for(const [lx,lz] of [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(0.2,1.3,0.2),cm2);lg.position.set(lx,0.65,lz);grp.add(lg);}grp.position.set(c[0]+Math.cos(a)*5.6,y+0.2,c[1]+Math.sin(a)*5.6);grp.rotation.y=-a;groups.site.add(grp);}
 const it=info('Proposed: fire pit + 16 ft paver circle by the walk-out','prop','Wood-burning stone fire pit on a paver circle, a short walk from the lower-level coffee spot. Published: pro-installed block kit + 12×12 paver patio $5,700-9,600; custom stone pit + patio $7,700-13,100 (Green Industry Report fire pit cost guide, 2026). Keep ≥25 ft from structures.',[c[0],y+6,c[1]],{near:false});pv.userData.item=it;pickables.push(pv);EXTRAS.push(it);}
{// propane standby generator pad beside the garage
 const p=G.P(-4,6);const y=elev(p[0],p[1]);const gen=box('elec',p[0],y,p[1],2.3,2.4,4,0xd9dcd2,'prop',null);
 const it=info('Proposed: 22-26 kW propane standby generator','prop','Concrete pad beside the garage, automatic transfer switch at the main service; runs off the existing propane. Published: $7,000-14,300 installed for liquid propane (Caudill\'s 2026 generator cost guide). Solar notes: winter backup is more practical with propane than with batteries.',[p[0],y+5,p[1]]);gen.userData.item=it;pickables.push(gen);EXTRAS.push(it);}
{// driveway / path lighting bollards
 const it=info('Proposed: low-voltage landscape & driveway lighting','prop','Bollards along the drive from the barns to the house, plus path lights to the walk-out and fire pit. Published average $3,800 (range $2,000-6,000) (Cost to Renovate, outdoor living).',null);
 const pts=[[W(236),Zs(112)],[W(250),Zs(148)],[W(268),Zs(205)],[W(278),Zs(240)]];let first=null;
 for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];for(let t=0;t<1;t+=0.34){const x=a[0]+(b[0]-a[0])*t+7,z=a[1]+(b[1]-a[1])*t;const y=elev(x,z);
   const m=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,2.6,8),new THREE.MeshLambertMaterial({color:0x1d1f22}));m.position.set(x,y+1.3,z);groups.site.add(m);
   const l=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.3,8),new THREE.MeshBasicMaterial({color:0xffe2a0}));l.position.set(x,y+2.4,z);groups.site.add(l);m.userData.item=it;pickables.push(m);if(!first)first=[x,y+6,z];}}
 it.pos=first;EXTRAS.push(it);}
{// gym-barn mini-split + van/EV charging note at the big barn
 const it=info('Proposed: Level-2 charger + 14-50 at the big barn','prop','The van uses the 30 A shore outlet; a NEMA 14-50 (50 A) on the barn subpanel also serves a portable EV charger. Published $600-1,800 installed on a longer run (electrical-guide.com, Oct 2026); feeder upgrade extra.',[PB.x0+12.6,PBy+8,PB.z0-24]);EXTRAS.push(it);}

// ---- furniture shape upgrade: replace placeholder boxes with simple modeled shapes (same footprint, same info/picking)
// ================= v7 FURNITURE LIBRARY (procedural, inventory sizes) =================
const V8HI=(()=>{let q=null;try{q=localStorage.getItem('samelsQ');}catch(e){}const Q=new URLSearchParams(location.search);if(Q.get('clean')==='1')q='high';if(Q.get('q'))q=Q.get('q');if(!q)q=(matchMedia('(pointer:coarse)').matches||innerWidth<900)?'low':'high';return q==='high'&&!!THREE.GLTFLoader;})();window.__V8HI=V8HI;window.__swaps=[];
function SW(G,m,o){if(!V8HI||!G)return G;G.traverse(c=>{c.userData.noMerge=true;});window.__swaps.push(Object.assign({G,m},o||{}));return G;}
const FX=(()=>{const tex=(w,h,fn,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=4;return t;};
 const noise=(g,w,h,n,cols,a)=>{for(let i=0;i<n;i++){g.fillStyle=cols[i%cols.length];g.globalAlpha=a;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2);}g.globalAlpha=1;};
 const leatherT=c=>{const t=tex(128,128,(g,w,h)=>{g.fillStyle=c;g.fillRect(0,0,w,h);noise(g,w,h,1800,['#000','#fff'],0.06);});t.__pbr='leather';return t;};
 const fabricT=c=>{const t=tex(128,128,(g,w,h)=>{g.fillStyle=c;g.fillRect(0,0,w,h);g.globalAlpha=0.08;for(let i=0;i<w;i+=2){g.fillStyle=i%4?'#000':'#fff';g.fillRect(i,0,1,h);g.fillRect(0,i,w,1);}g.globalAlpha=1;noise(g,w,h,600,['#000','#fff'],0.05);});t.__pbr='fabric';return t;};
 const mats={};const M=(k,f)=>mats[k]||(mats[k]=f());
 const leather=c=>M('lea'+c,()=>new THREE.MeshPhongMaterial({color:0xffffff,map:leatherT('#'+c.toString(16).padStart(6,'0')),shininess:38,specular:0x3a3a3a}));
 const fabric=c=>M('fab'+c,()=>new THREE.MeshLambertMaterial({color:0xffffff,map:fabricT('#'+c.toString(16).padStart(6,'0'))}));
 const lam=c=>M('l'+c,()=>new THREE.MeshLambertMaterial({color:c}));const ph=(c,s,sp)=>M('p'+c+'_'+s,()=>new THREE.MeshPhongMaterial({color:c,shininess:s||60,specular:sp||0x444444}));
 const brass=()=>ph(0xb08d57,90,0x886633),chrome=()=>ph(0xd8dde2,140,0xffffff),black=()=>ph(0x111111,60,0x333333);
 const box=(G,x,y,z,w,h,d,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.castShadow=o.receiveShadow=true;G.add(o);return o;};
 const cyl=(G,x,y,z,r,h,m,ax,r2,seg)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r2===undefined?r:r2,h,seg||16),m);o.position.set(x,y,z);if(ax==='x')o.rotation.z=Math.PI/2;if(ax==='z')o.rotation.x=Math.PI/2;o.castShadow=o.receiveShadow=true;G.add(o);return o;};
 const blob=(G,x,y,z,sx,sy,sz,m,seg)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,seg||12,Math.max(6,(seg||12)*0.6|0)),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;G.add(o);return o;};
 // rounded cushion: box + softened edges using a capsule-ish shape (scaled sphere on top edge)
 const cushion=(G,x,y,z,w,h,d,m)=>{box(G,x,y,z,w-0.08,h-0.06,d-0.08,m);blob(G,x,y+h-0.06,z,w/2-0.04,0.07,d/2-0.04,m,14);};
 const studs=(G,pts,m)=>{const im=new THREE.InstancedMesh(new THREE.SphereGeometry(0.028,6,4),m,pts.length),o=new THREE.Object3D();pts.forEach((p,i)=>{o.position.set(p[0],p[1],p[2]);o.updateMatrix();im.setMatrixAt(i,o.matrix);});G.add(im);return im;};
 // place a local group (front -z, back +z, width x) into a world collider box k with back side b
 const place=(G,k,b,layer)=>{const cx=(k.x0+k.x1)/2,cz=(k.z0+k.z1)/2;G.position.set(cx,k.y0,cz);G.rotation.y={s:0,n:Math.PI,e:Math.PI/2,w:-Math.PI/2}[b]||0;groups[layer||'house'].add(G);return G;};
 const dims=(k,b)=>{const W=k.x1-k.x0,D=k.z1-k.z0;return (b==='e'||b==='w')?[D,W]:[W,D];};
 return {tex,leather,fabric,lam,ph,brass,chrome,black,box,cyl,blob,cushion,studs,place,dims,noise};})();
window.__FX=FX;
// cigar / club chair: roll arms, nailheads, loose seat cushion, bun feet
function fxClubChair(k,b,col){const [W,D]=FX.dims(k,b),G=new THREE.Group(),L=FX.leather(col||0x1a1410),hw=W/2,hd=D/2;
 FX.box(G,0,0.35,0,W-0.1,0.95,D-0.1,L);FX.cushion(G,0,1.25,-0.15,W-1.2,0.38,D-0.75,L);
 FX.box(G,0,0.35,hd-0.33,W-0.1,2.45,0.55,L);FX.blob(G,0,2.8,hd-0.33,hw-0.06,0.22,0.3,L,16);FX.cushion(G,0,1.3,hd-0.75,W-1.2,1.3,0.35,L);
 for(const s of [-1,1]){const x=s*(hw-0.3);FX.box(G,x,0.35,0,0.55,1.6,D-0.1,L);FX.cyl(G,x+s*0.04,1.98,0,0.31,D-0.1,L,'z',undefined,18);
  FX.blob(G,x+s*0.04,1.98,-hd+0.06,0.31,0.31,0.08,L,14);const p=[];for(let i=0;i<14;i++){const a=i/13*Math.PI;p.push([x+s*0.04+Math.cos(a)*0.33*s,1.98+Math.sin(a)*0.33-0.02,-hd+0.02]);}for(let i=0;i<9;i++)p.push([x+s*0.3,0.55+i*0.15,-hd+0.02]);FX.studs(G,p,FX.brass());}
 const pf=[];for(let i=0;i<=24;i++)pf.push([-hw+0.06+i*(W-0.12)/24,0.5,-hd+0.02]);FX.studs(G,pf,FX.brass());
 for(const [x,z] of [[-hw+0.3,-hd+0.3],[hw-0.3,-hd+0.3],[-hw+0.3,hd-0.3],[hw-0.3,hd-0.3]])FX.blob(G,x,0.18,z,0.17,0.18,0.17,FX.ph(0x2a1a10,40));
 return FX.place(G,k,b);}
// chesterfield-style tufted bench: diamond button tufting, turned legs
function fxTuftBench(k,col){const W=k.x1-k.x0,D=k.z1-k.z0,G=new THREE.Group(),L=FX.leather(col||0x2a1c14);FX.box(G,0,0.45,0,W,0.55,D,L);FX.blob(G,0,1.0,0,W/2-0.03,0.12,D/2-0.03,L,18);
 const p=[];const nx=Math.max(2,Math.round(W/0.55)),nz=Math.max(2,Math.round(D/0.55));for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){if((i+j)%2)continue;p.push([-W/2+(i+0.5)*W/nx,1.1,-D/2+(j+0.5)*D/nz]);}FX.studs(G,p,FX.ph(0x120c08,30));
 const pf=[];for(let i=0;i<=Math.round(W*5);i++){pf.push([-W/2+i/(W*5)*W,0.55,-D/2-0.01]);pf.push([-W/2+i/(W*5)*W,0.55,D/2+0.01]);}FX.studs(G,pf,FX.brass());
 for(const [x,z] of [[-W/2+0.2,-D/2+0.2],[W/2-0.2,-D/2+0.2],[-W/2+0.2,D/2-0.2],[W/2-0.2,D/2-0.2]]){FX.cyl(G,x,0.22,z,0.07,0.45,FX.ph(0x2a1a10,50),null,0.1,10);FX.blob(G,x,0.3,z,0.11,0.07,0.11,FX.ph(0x2a1a10,50));}
 G.position.set((k.x0+k.x1)/2,k.y0,(k.z0+k.z1)/2);groups.house.add(G);return G;}
// sectional piece: low modern, individual seat/back cushions, tufted backs, throw pillows
function fxSofa(k,b,col,opt){opt=opt||{};const [W,D]=FX.dims(k,b),G=new THREE.Group(),F=FX.fabric(col||0x9a9fa6),hw=W/2,hd=D/2;const arm=opt.arm===undefined?0.5:opt.arm;
 FX.box(G,0,0.12,0,W,0.5,D,F);FX.box(G,0,0,0,W-0.3,0.12,D-0.3,FX.black());
 const n=Math.max(1,Math.round((W-2*arm)/2.6)),cw=(W-2*arm)/n;for(let i=0;i<n;i++){const x=-hw+arm+cw*(i+0.5);FX.cushion(G,x,0.62,-0.3+(opt.deep?0:0),cw-0.06,0.55,D-1.1,F);
  if(!opt.noBack){const bk=new THREE.Group();FX.cushion(bk,0,0,0,cw-0.08,1.45,0.55,F);bk.position.set(x,1.12,hd-0.55);bk.rotation.x=-0.12;G.add(bk);const tp=[];for(const tx of [-cw*0.25,cw*0.25])for(const ty of [0.5,1.0])tp.push([x+tx,1.12+ty,hd-0.84]);FX.studs(G,tp,FX.ph(0x6f747a,10));}}
 if(!opt.noBack)FX.box(G,0,0.62,hd-0.3,W,1.75,0.3,F);
 for(const s of opt.arms||[-1,1])if(arm>0){FX.box(G,s*(hw-arm/2),0.62,0,arm,1.05,D,F);FX.blob(G,s*(hw-arm/2),1.67,0,arm/2,0.08,hd,F,12);}
 const pc=opt.pillows||[0xe9e4da,0x4a5a6a,0xc9a27a];if(!opt.noBack)pc.forEach((c,i)=>{if(i>=n+1)return;const x=-hw+arm+0.7+i*((W-2*arm-1.4)/Math.max(1,pc.length-1));const p=FX.blob(G,x,1.75,hd-1.05,0.62,0.55,0.18,FX.fabric(c),12);p.rotation.z=(i%2?0.15:-0.12);p.rotation.x=-0.25;});
 if(opt.throwC){const t=FX.box(G,hw-arm-1.2,1.17,-0.2,1.6,0.05,D-1.2,FX.fabric(opt.throwC));t.rotation.y=0.08;}
 return FX.place(G,k,b);}
// Aeron: mesh seat/back, Y-arms, 5-star base, casters
function fxAeron(k){const x=(k.x0+k.x1)/2,z=(k.z0+k.z1)/2,y=k.y0,G=new THREE.Group(),mesh=FX.ph(0x26292c,20,0x111111),fr=FX.ph(0x18191b,70,0x555555);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const leg=FX.box(G,Math.cos(a)*0.55,0.2,Math.sin(a)*0.55,0.12,0.09,1.1,fr);leg.rotation.y=-a+Math.PI/2;FX.blob(G,Math.cos(a)*1.05,0.1,Math.sin(a)*1.05,0.1,0.1,0.1,fr,8);}
 FX.cyl(G,0,0.85,0,0.07,1.2,FX.chrome());const s=new THREE.Group();s.position.y=1.5;G.add(s);FX.box(s,0,0,0,1.65,0.12,1.55,fr);FX.box(s,0,0.1,0,1.5,0.04,1.4,mesh);
 const bk=new THREE.Group();bk.position.set(0,1.55,0.78);bk.rotation.x=0.18;G.add(bk);FX.box(bk,0,0,0,1.45,2.3,0.08,mesh);FX.box(bk,0,-0.05,-0.02,1.6,0.12,0.14,fr);FX.box(bk,0,2.2,-0.02,1.5,0.12,0.12,fr);for(const sx of [-0.78,0.78])FX.box(bk,sx,0,0,0.1,2.3,0.12,fr);FX.box(bk,0,0.55,-0.06,1.1,0.4,0.08,fr);
 for(const sx of [-0.85,0.85]){FX.box(G,sx,1.55,0.35,0.09,0.9,0.12,fr);FX.box(G,sx,2.4,-0.05,0.22,0.08,1.0,fr);}
 G.position.set(x,y,z);G.rotation.y=Math.PI;groups.house.add(G);return G;}
// bed: upholstered tufted headboard, mattress, duvet with fold-over, pillows, throw
function fxBed(k,hb,headCol,duvet,throwC){const [W,D]=FX.dims(k,hb),G=new THREE.Group(),hw=W/2,hd=D/2;const HB=FX.fabric(headCol||0x22305a);
 FX.box(G,0,0,0,W,0.95,D-0.35,FX.ph(0x3a2f28,30));FX.box(G,0,0.95,-0.05,W-0.15,0.75,D-0.55,FX.lam(0xf6f4ef));
 FX.box(G,0,1.65,-0.35,W-0.05,0.18,D-1.6,FX.fabric(duvet||0xf2f0ea));FX.blob(G,0,1.75,-0.35,hw-0.02,0.1,(D-1.6)/2,FX.fabric(duvet||0xf2f0ea),16);FX.box(G,0,1.72,hd-1.75,W-0.05,0.24,0.55,FX.fabric(duvet||0xf2f0ea));
 for(const s of [-1,1]){FX.box(G,s*(hw-0.02),0.9,-0.4,0.05,0.85,D-1.7,FX.fabric(duvet||0xf2f0ea));}
 if(throwC)FX.box(G,0,1.86,-hd+1.6,W+0.1,0.06,1.4,FX.fabric(throwC));
 FX.box(G,0,0,hd-0.2,W+0.25,4.2,0.35,HB);const tp=[];for(let i=1;i<Math.round(W/0.6);i++)for(let j=0;j<3;j++){if((i+j)%2)continue;tp.push([-hw+i*0.6,2.6+j*0.5,hd-0.4]);}FX.studs(G,tp,FX.ph(0x0d1530,10));
 const np=W>5.5?2:1;for(let i=0;i<np;i++){const x=np===1?0:(i?hw/2:-hw/2);FX.blob(G,x,1.95,hd-1.0,np===1?hw*0.55:hw*0.42,0.24,0.45,FX.fabric(0xffffff),14);FX.blob(G,x,2.1,hd-1.55,np===1?hw*0.4:hw*0.3,0.22,0.12,FX.fabric(headCol?0x9aa8c0:0xc9b8a0),12).rotation.x=-0.4;}
 return FX.place(G,k,hb);}
function fxLamp(x,y,z,h,shadeC,layer){const G=new THREE.Group();FX.cyl(G,0,0.06,0,0.45,0.12,FX.black());FX.cyl(G,0,h/2,0,0.035,h,FX.ph(0x1d1d1d,80));const s=FX.cyl(G,0,h+0.15,0,0.6,0.9,new THREE.MeshLambertMaterial({color:shadeC||0xf3ead8,emissive:0x6a5a40,side:THREE.DoubleSide}),null,0.75,20);s.castShadow=false;G.position.set(x,y,z);groups[layer||'house'].add(G);return h<2.2?SW(G,'desk_lamp_arm_01',{fit:'h',ry:Math.PI,k:0.95}):G;}
function fxPlant(x,y,z,s,kind,layer){const G=new THREE.Group(),pot=FX.ph(kind==='snake'?0xe9e6df:0x2b2b2b,30);FX.cyl(G,0,0.65*s,0,0.55*s,1.3*s,pot,null,0.42*s,18);FX.cyl(G,0,1.28*s,0,0.5*s,0.04,FX.lam(0x3a2a1c),null,undefined,14);
 const lf=FX.lam(kind==='snake'?0x3f6a35:0x2f5d2a),lf2=FX.lam(0x4f7f38);
 if(kind==='snake'){for(let i=0;i<9;i++){const a=i*2.3,r=0.12*s;const l=FX.box(G,Math.cos(a)*r,1.3*s,Math.sin(a)*r,0.16*s,(1.6+(i%3)*0.5)*s,0.04*s,i%2?lf:lf2);l.rotation.set(Math.sin(i)*0.15,a,Math.cos(i)*0.15);}}
 else{FX.cyl(G,0,(1.3+1.6)*s,0,0.05*s,3.2*s,FX.lam(0x5a4330));for(let i=0;i<22;i++){const a=i*2.4,hh=(2.2+(i%7)*0.4)*s,r=(0.35+(i%4)*0.15)*s;const l=FX.blob(G,Math.cos(a)*r,1.3*s+hh,Math.sin(a)*r,0.32*s,0.05*s,0.42*s,i%3?lf:lf2,8);l.rotation.set(0.5*Math.cos(a),a,0.4);}}
 G.position.set(x,y,z);groups[layer||'house'].add(G);return SW(G,kind==='snake'?'potted_plant_04':'potted_plant_02',{fit:'h',ry:0});}
function fxRugTex(base,border,pattern){return FX.tex(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);FX.noise(g,w,h,3000,['#000','#fff'],0.05);g.strokeStyle=border;g.lineWidth=10;g.strokeRect(14,14,w-28,h-28);g.lineWidth=2;g.strokeRect(30,30,w-60,h-60);
 if(pattern==='geo'){g.globalAlpha=0.25;g.strokeStyle=border;for(let i=40;i<w-40;i+=24){g.beginPath();g.moveTo(i,40);g.lineTo(i+12,h-40);g.stroke();}g.globalAlpha=1;}});}
{const byName=re=>window.__furn.filter(f=>re.test(f.name));
 const hideBox=f=>{const m=f.mesh;if(!m)return;m.layers.set(1);m.userData.noMerge=true;m.children.forEach(c=>{c.visible=false;});};
 const B=(x0,x1,z0,z1,y0,h,c,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05,x1-x0),h,Math.max(0.05,z1-z0)),m||new THREE.MeshLambertMaterial({color:c}));o.position.set((x0+x1)/2,y0+h/2,(z0+z1)/2);o.castShadow=o.receiveShadow=true;groups.house.add(o);return o;};
 // back: 'n','s','e','w' world side where the backrest sits (n = -z)
 function uph(f,back,c,seatH,backH,arm){const k=f.c,y=k.y0;const x0=k.x0,x1=k.x1,z0=k.z0,z1=k.z1;const M=new THREE.MeshLambertMaterial({color:c});const bt=Math.min(0.9,(back==='n'||back==='s'?(z1-z0):(x1-x0))*0.28);
   B(x0+0.1,x1-0.1,z0+0.1,z1-0.1,y,0.35,0x222222);B(x0,x1,z0,z1,y+0.35,seatH-0.35,0,M);
   if(back==='n')B(x0,x1,z0,z0+bt,y,backH,0,M);if(back==='s')B(x0,x1,z1-bt,z1,y,backH,0,M);if(back==='w')B(x0,x0+bt,z0,z1,y,backH,0,M);if(back==='e')B(x1-bt,x1,z0,z1,y,backH,0,M);
   if(arm){const at=0.55,ah=seatH+0.7;if(back==='n'||back==='s'){B(x0,x0+at,z0,z1,y,ah,0,M);B(x1-at,x1,z0,z1,y,ah,0,M);}else{B(x0,x1,z0,z0+at,y,ah,0,M);B(x0,x1,z1-at,z1,y,ah,0,M);}}
   // cushion seams
   const n=Math.max(1,Math.round(((back==='n'||back==='s')?(x1-x0):(z1-z0))/2.6));for(let i=1;i<n;i++){const t=i/n;if(back==='n'||back==='s')B(x0+(x1-x0)*t-0.02,x0+(x1-x0)*t+0.02,z0,z1,y+seatH,0.02,0x111111);else B(x0,x1,z0+(z1-z0)*t-0.02,z0+(z1-z0)*t+0.02,y+seatH,0.02,0x111111);}}
 window.__furn.forEach(f=>{f.mesh=f.mesh||null;});
 const want=[[/cigar chair \(1/,'e',0x15110e,1.5,3.2,1],[/cigar chair \(2/,'e',0x15110e,1.5,3.2,1],[/club sofa/,'e',0x6b5442,1.5,2.7,1],[/#3 Seabreeze gray sectional/,'w',0x9a9fa6,1.5,2.7,1]];
 for(const f of byName(/cigar chair/)){hideBox(f);SW(fxClubChair(f.c,'e',0x17120e),'modern_arm_chair_01',{ry:Math.PI});}
 for(const f of byName(/club sofa/)){hideBox(f);SW(fxSofa(f.c,'e',0x6b5442),'sofa_02',{ry:Math.PI});}
 for(const f of byName(/#3 Seabreeze gray sectional/)){hideBox(f);fxSofa(f.c,'w',0x8f959c,{arms:[1],pillows:[0xe9e4da,0x3f4d5c,0xb88a5a,0xe9e4da],throwC:0xd8d0c2});}
 for(const f of byName(/#3 Sectional chaise \(left/)){hideBox(f);fxSofa(f.c,'n',0x8f959c,{arms:[-1],noBack:false,pillows:[0x3f4d5c,0xe9e4da]});}
 for(const f of byName(/#3 Sectional chaise \(right/)){hideBox(f);}
 // tufted bench
 for(const f of byName(/#4 Tufted/)){hideBox(f);fxTuftBench(f.c,0x2a1c14);}
 // Steinway: curved case approximation (body + tail taper), lid, legs, keyboard, music desk
 for(const f of byName(/Steinway Model B/)){hideBox(f);const k=f.c,y=k.y0;const blk=new THREE.MeshPhongMaterial({color:0x0b0b0b,shininess:120,specular:0x555555,side:THREE.DoubleSide});
   const L=k.x1-k.x0,Wd=k.z1-k.z0;const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(Wd,0);sh.lineTo(Wd,0.27*L);sh.bezierCurveTo(Wd,0.52*L,0.58*Wd,0.5*L,0.5*Wd,0.78*L);sh.quadraticCurveTo(0.44*Wd,L,0.2*Wd,L);sh.quadraticCurveTo(0,L,0,0.86*L);sh.lineTo(0,0);
   const G=new THREE.Group();const g=new THREE.ExtrudeGeometry(sh,{depth:1.0,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:2,curveSegments:28});g.rotateX(Math.PI/2);const cs=new THREE.Mesh(g,blk);cs.position.y=3.3;cs.castShadow=true;G.add(cs);
   const inner=new THREE.Mesh(new THREE.ShapeGeometry(sh,28),new THREE.MeshPhongMaterial({color:0xb8913f,shininess:60,specular:0x664422,side:THREE.DoubleSide}));inner.rotation.x=Math.PI/2;inner.position.y=3.05;inner.scale.set(0.96,0.96,1);inner.position.x=Wd*0.02;G.add(inner); // gold plate visible under the lid
   const str=new THREE.Mesh(new THREE.PlaneGeometry(Wd*0.7,L*0.75),new THREE.MeshPhongMaterial({color:0x9a9a96,shininess:100,transparent:true,opacity:0.5}));str.rotation.x=-Math.PI/2;str.position.set(Wd*0.42,3.12,L*0.42);G.add(str);
   const lp=new THREE.Group();lp.position.set(0,3.32,0);lp.rotation.z=0.72;const lid=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.06,bevelEnabled:false,curveSegments:28}),blk);lid.rotation.x=Math.PI/2;lp.add(lid);G.add(lp);
   {const px=Wd*0.86,pz=L*0.42,top=Math.sin(0.72)*px;const stick=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,top+0.05,8),blk);stick.position.set(px*Math.cos(0.72)*0.98,3.32+top/2,pz);stick.rotation.z=0.18;G.add(stick);}
   const bx=(x0,x1,z0,z1,y0,h,c,mm)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,h,z1-z0),mm||(c?new THREE.MeshLambertMaterial({color:c}):blk));o.position.set((x0+x1)/2,y0+h/2,(z0+z1)/2);o.castShadow=true;G.add(o);return o;};
   // legs: tapered with brass casters
   for(const [x,z] of [[0.45,0.35],[Wd-0.45,0.35],[Wd*0.42,L*0.82]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.13,2.2,12),blk);lg.position.set(x,1.25,z);G.add(lg);bx(x-0.24,x+0.24,z-0.24,z+0.24,2.25,0.12);const cst=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),new THREE.MeshPhongMaterial({color:0xb08d57,shininess:90}));cst.position.set(x,0.1,z);G.add(cst);}
   // keyboard: key bed with key texture, cheek blocks, fallboard, key slip
   const kt=(()=>{const c=document.createElement('canvas');c.width=1024;c.height=64;const q=c.getContext('2d');q.fillStyle='#f6f4ec';q.fillRect(0,0,1024,64);const ww=1024/52;q.fillStyle='#222';for(let i=0;i<52;i++)q.fillRect(i*ww,0,1,64);for(let i=0;i<52;i++){const n=(i+5)%7;if(n===2||n===6)continue;q.fillRect(i*ww+ww*0.65,0,ww*0.7,38);}const t=new THREE.CanvasTexture(c);t.anisotropy=8;return t;})();
   const kb=new THREE.Mesh(new THREE.BoxGeometry(Wd-0.7,0.08,0.55),[blk,blk,new THREE.MeshPhongMaterial({map:kt,shininess:80}),blk,blk,blk]);kb.geometry.rotateY(Math.PI/2);kb.rotation.y=-Math.PI/2;kb.position.set(Wd/2,2.48,-0.3);G.add(kb);
   bx(0.05,0.35,-0.65,0.05,2.3,0.5);bx(Wd-0.35,Wd-0.05,-0.65,0.05,2.3,0.5);bx(0.2,Wd-0.2,-0.7,-0.58,2.3,0.18);bx(0.2,Wd-0.2,0,0.25,2.3,1.0);
   // music desk (angled) + lyre with 3 brass pedals
   const md=new THREE.Mesh(new THREE.BoxGeometry(Wd*0.62,0.95,0.06),blk);md.position.set(Wd/2,3.85,0.35);md.rotation.x=-0.25;G.add(md);
   const lyre=new THREE.Group();lyre.position.set(Wd*0.5,0,0.15);G.add(lyre);for(const sx of [-0.28,0.28]){const r=new THREE.Mesh(new THREE.BoxGeometry(0.08,2.1,0.1),blk);r.position.set(sx,1.25,0);lyre.add(r);}const lb=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.35),blk);lb.position.set(0,0.2,0);lyre.add(lb);
   for(const sx of [-0.22,0,0.22]){const pd=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.04,0.42),new THREE.MeshPhongMaterial({color:0xc9a35a,shininess:120,specular:0x886633}));pd.position.set(sx,0.32,-0.3);lyre.add(pd);}
   // STEINWAY & SONS fallboard decal
   {const c=document.createElement('canvas');c.width=256;c.height=32;const q=c.getContext('2d');q.fillStyle='#0b0b0b';q.fillRect(0,0,256,32);q.fillStyle='#c9a35a';q.font='bold 18px serif';q.textAlign='center';q.fillText('STEINWAY & SONS',128,22);const dm=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.18),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));dm.position.set(Wd/2,2.95,-0.005);dm.rotation.y=Math.PI;dm.scale.x=-1;G.add(dm);}
   G.scale.x=-1;G.rotation.y=-Math.PI/2;G.position.set(k.x1,y,k.z1);groups.house.add(G);}
 for(const f of byName(/Steinway lid/)){hideBox(f);}
 // stools
 for(const f of byName(/Counter stool/)){hideBox(f);const k=f.c,x=(k.x0+k.x1)/2,z=(k.z0+k.z1)/2;const SG=new THREE.Group();SG.position.set(x,k.y0,z);groups.house.add(SG);const s=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.25,18),new THREE.MeshLambertMaterial({color:0x6b4f3a}));s.position.set(0,2.4,0);SG.add(s);
   const pst=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.3,0.14),new THREE.MeshLambertMaterial({color:0x111111}));pst.position.y=1.15;SG.add(pst);const r=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.04,6,18),new THREE.MeshLambertMaterial({color:0x111111}));r.rotation.x=Math.PI/2;r.position.set(0,0.9,0);SG.add(r);SW(SG,'bar_chair_round_01',{fit:'h',ry:0});}
 // teak dining table + 8 chairs on the deck
 for(const f of byName(/Teak dining table/)){hideBox(f);const k=f.c,y=k.y0,cx=(k.x0+k.x1)/2;const teak=new THREE.MeshLambertMaterial({color:0xa8733f});
   const tx0=cx-1.7,tx1=cx+1.7,tz0=k.z0+0.6,tz1=k.z1-0.6;B(tx0,tx1,tz0,tz1,y+2.35,0.15,0,teak);for(const [x,z] of [[tx0+.2,tz0+.2],[tx1-.2,tz0+.2],[tx0+.2,tz1-.2],[tx1-.2,tz1-.2]])B(x-.15,x+.15,z-.15,z+.15,y,2.35,0,teak);
   for(let i=0;i<3;i++){const z=tz0+1+(tz1-tz0-2)*i/2;for(const s of [-1,1]){const x=cx+s*2.35;B(x-0.75,x+0.75,z-0.75,z+0.75,y+1.4,0.12,0,teak);B(s<0?x-0.75:x+0.63,s<0?x-0.63:x+0.75,z-0.75,z+0.75,y+1.4,1.6,0,teak);for(const [dx,dz] of [[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]])B(x+dx-.06,x+dx+.06,z+dz-.06,z+dz+.06,y,1.4,0,teak);}}
   for(const z of [tz0-0.9,tz1+0.9]){B(cx-0.75,cx+0.75,z-0.75,z+0.75,y+1.4,0.12,0,teak);}}
 // loft bed (navy tufted headboard), nightstand, daybed
 for(const f of byName(/full bed/)){hideBox(f);fxBed(f.c,'n',0x22305a,0xf2f0ea,0x9aa8c0);continue;const k=f.c,y=k.y0;B(k.x0,k.x1,k.z0+0.5,k.z1,y,1.0,0x3a2f28);B(k.x0+0.1,k.x1-0.1,k.z0+0.6,k.z1-0.1,y+1,0.8,0xf4f2ee);B(k.x0+0.1,k.x1-0.1,k.z0+2.6,k.z1-0.05,y+1.75,0.25,0x7d8fa8);B(k.x0,k.x1,k.z0,k.z0+0.5,y,4,0x22305a);
   B(k.x0+0.4,(k.x0+k.x1)/2-0.1,k.z0+0.7,k.z0+1.9,y+1.8,0.45,0xffffff);B((k.x0+k.x1)/2+0.1,k.x1-0.4,k.z0+0.7,k.z0+1.9,y+1.8,0.45,0xffffff);}
 for(const f of byName(/Daybed/)){hideBox(f);fxBed(f.c,'w',0x8a96a6,0xeef1f4,0x2f4d6a);}
 for(const f of byName(/Glass-top desk/)){hideBox(f);const k=f.c,y=k.y0;B(k.x0,k.x1,k.z0,k.z1,y+2.4,0.06,0,new THREE.MeshPhongMaterial({color:0xbfe3ee,transparent:true,opacity:.45}));for(const x of [k.x0+.1,k.x1-.1])B(x-.05,x+.05,k.z0,k.z1,y,2.4,0x111111);}
 for(const f of byName(/Aeron/)){hideBox(f);fxAeron(f.c);continue;const k=f.c,x=(k.x0+k.x1)/2,z=(k.z0+k.z1)/2,y=k.y0;B(x-0.9,x+0.9,z-0.9,z+0.9,y+1.5,0.25,0x333333);B(x-0.9,x+0.9,z+0.7,z+0.85,y+1.7,2,0x2a2a2a);B(x-0.06,x+0.06,z-0.06,z+0.06,y+0.3,1.2,0x111111);B(x-1,x+1,z-0.08,z+0.08,y,0.25,0x111111);B(x-0.08,x+0.08,z-1,z+1,y,0.25,0x111111);}
 // massage chair
 for(const f of byName(/Massage chair/)){hideBox(f);uph(f,'s',0x2e2e2e,1.8,4.2,1);}
 // coffee chairs + cafe table at walk-out
 {const n0=groups.house.children.length; for(const f of byName(/Morning coffee/)){hideBox(f);const k=f.c,y=k.y0,cx=(k.x0+k.x1)/2+0.6,cz=(k.z0+k.z1)/2;const t=new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.08,24),new THREE.MeshLambertMaterial({color:0x2a2a2a}));t.position.set(cx,y+2.4,cz);groups.house.add(t);B(cx-.05,cx+.05,cz-.05,cz+.05,y,2.4,0x222222);
   const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.12,0.3,12),new THREE.MeshLambertMaterial({color:0xf4f1ea}));cup.position.set(cx-0.3,y+2.6,cz+0.2);groups.house.add(cup);const cup2=cup.clone();cup2.position.set(cx+0.35,y+2.6,cz-0.25);groups.house.add(cup2);
   for(const s2 of [-1,1]){const z=cz+s2*1.7;B(cx-0.85,cx+0.85,z-0.85,z+0.85,y+1.5,0.12,0x2a2a2a);B(cx-0.85,cx+0.85,s2<0?z-0.85:z+0.73,s2<0?z-0.73:z+0.85,y+1.5,1.5,0x2a2a2a);for(const [dx,dz] of [[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]])B(cx+dx-.05,cx+dx+.05,z+dz-.05,z+dz+.05,y,1.5,0x2a2a2a);B(cx-0.8,cx+0.8,z-0.8,z+0.8,y+1.62,0.2,0xd9cfbf);}}
 const nw=groups.house.children.slice(n0);if(nw.length){const MG=new THREE.Group();nw.forEach(o=>MG.add(o));groups.house.add(MG);SW(MG,'outdoor_table_chair_set_01',{ry:0});}}
 // back bar: cabinet + shelves + bottles
 for(const f of byName(/Back bar/)){const k=f.c,y=k.y0;for(let i=0;i<14;i++){const x=k.x0+0.4+i*(k.x1-k.x0-0.8)/13;const b=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.9,8),new THREE.MeshPhongMaterial({color:[0x7a3b12,0x2f5d2a,0xc9b27a,0x5a1a1a][i%4],shininess:90}));b.position.set(x,y+3.95,(k.z0+k.z1)/2);groups.house.add(b);}
   B(k.x0,k.x1,k.z1-0.4,k.z1,y+5,0.1,0x3a2a20);}}

// ---- v3 GYM premium pass: wall linings + accent wall, rubber speckle floor, plate tree, dumbbells, recovery bench + towel hooks, warm lights
{const g=groups.gym,F=GY,yb=GYy;const LM=c=>new THREE.MeshLambertMaterial({color:c});
 const pan=(u0,v0,u1,v1,y0,h,c)=>{const a=F.P(u0,v0),b=F.P(u1,v1);const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.06,Math.abs(b[0]-a[0])),h,Math.max(0.06,Math.abs(b[1]-a[1]))),LM(c));o.position.set((a[0]+b[0])/2,yb+y0+h/2,(a[1]+b[1])/2);o.receiveShadow=true;g.add(o);return o;};
 const UP=0xd9d6cf,WA=0x2f3338,ACC=0x23394d;
 // wall runs (inside face) with gaps: south v=0.3 (door u22-25), north v=29.7 (door u13-16), east u=27.7 (overhead v11-19), west u=0.3 = accent
 const runs=[['S',[[0.3,22],[25,27.7]]],['N',[[0.3,13],[16,27.7]]],['E',[[0.3,11],[19,29.7]]]];
 for(const [side,segs] of runs)for(const [a,b] of segs){if(side==='S'){pan(a,0.28,b,0.32,0.08,3.9,WA);pan(a,0.28,b,0.32,4,6,UP);}if(side==='N'){pan(a,29.68,b,29.72,0.08,3.9,WA);pan(a,29.68,b,29.72,4,6,UP);}if(side==='E'){pan(27.68,a,27.72,b,0.08,3.9,WA);pan(27.68,a,27.72,b,4,6,UP);}}
 pan(0.28,0.3,0.32,29.7,0.08,9.9,ACC); // logo-free accent wall (deep blue-slate)
 for(let i=0;i<5;i++)pan(0.33,3+i*5.5,0.36,3.15+i*5.5,0.08,9.9,0x1b2c3c); // vertical batten lines on the accent wall
 // speckled rubber floor texture
 const rt=ctex(256,(c,n)=>{c.fillStyle='#2a2a2a';c.fillRect(0,0,n,n);let r=5;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647;};for(let i=0;i<2600;i++){const v=60+Math.floor(rnd()*80);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(rnd()*n,rnd()*n,1.6,1.6);}c.fillStyle='#161616';c.fillRect(0,0,n,2);c.fillRect(0,0,2,n);});
 rt.repeat.set(7,7.5);const fl=pan(0.3,0.3,27.7,29.7,0.03,0.04,0xffffff);fl.material.map=rt;fl.material.needsUpdate=true;
 // plate tree with bumpers (west wall, near the barbell tree)
 {const [x,z]=F.P(2.6,23.6);const post=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,4.2,10),LM(0x1d1f22));post.position.set(x,yb+2.1,z);g.add(post);
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.2,2.4),LM(0x1d1f22));base.position.set(x,yb+0.1,z);g.add(base);
  const cols=[0xc23b3b,0x2f6fb5,0xd9b23a,0x3b8f4a,0x222222];for(let i=0;i<8;i++){const r=[1.48,1.48,1.48,1.48,1.2,1.2,0.9,0.9][i];const pg=new THREE.CylinderGeometry(r,r,0.22,26);pg.rotateZ(Math.PI/2);const p=new THREE.Mesh(pg,LM(cols[i%5]));const side=i%2?1:-1;p.position.set(x+side*(0.3+Math.floor(i/2)*0.24),yb+[3.2,3.2,2.2,2.2,1.6,1.6,1.1,1.1][i],z);g.add(p);}}
 // dumbbells on the 3-tier rack (south wall, u23.5-27.5)
 {const dg=new THREE.CylinderGeometry(0.28,0.28,0.35,6);dg.rotateZ(Math.PI/2);const hg=new THREE.CylinderGeometry(0.07,0.07,0.6,8);hg.rotateZ(Math.PI/2);
  for(let t=0;t<3;t++)for(let i=0;i<5;i++){const [x,z]=F.P(24+i*0.75,0.6+t*0.35);const y=yb+1.0+t*1.05;for(const s of [-1,1]){const d=new THREE.Mesh(dg,LM(0x1a1a1a));d.position.set(x+s*0.32,y,z);d.rotation.x=Math.PI/6;g.add(d);}const h=new THREE.Mesh(hg,LM(0xbfc4c8));h.position.set(x,y,z);g.add(h);}}
 // recovery corner: cedar bench + towel hooks + towels by the plunge (north wall)
 {pan(13,27.6,16.6,29.0,1.4,0.15,0xb07a4a);for(const u of [13.3,16.3])pan(u-0.1,27.8,u+0.1,28.8,0.04,1.4,0x1d1f22);
  for(let i=0;i<4;i++){const u=13.2+i*1.0;pan(u-0.05,29.55,u+0.05,29.66,5.2,0.12,0x1d1f22);pan(u-0.35,29.48,u+0.35,29.6,3.6,1.6,[0xf2efe8,0x9fb3bf,0xf2efe8,0x9fb3bf][i]);}
  colliders.push((()=>{const a=F.P(13,27.6),b=F.P(16.6,29);return {x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1]),y0:yb,y1:yb+1.6};})());}
 // warm wall-wash lights along the accent wall + 2 extra soft fills
 for(let i=0;i<5;i++){const [x,z]=F.P(0.7,3+i*5.8);const l=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.15,0.8),new THREE.MeshBasicMaterial({color:0xfff0d0}));l.position.set(x,yb+9.6,z);g.add(l);}
 for(const [u,v] of [[7,8],[20,22]]){const [x,z]=F.P(u,v);const pl=new THREE.PointLight(0xfff1dc,0.45,26,1.3);pl.position.set(x,yb+9,z);scene.add(pl);ilights.push(pl);}}

window.__gymLeg1=groups.gym.children.length;
// ================= v4: vehicles, barn fit, modern doors, network, cameras, smart home, offices =================
const NEWITEMS=[];const NI=(name,tag,text,pos,layer,extra)=>{const it=info(name,tag,text,pos,Object.assign({layer,near:false},extra||{}));NEWITEMS.push(it);return it;};
const LMv=c=>new THREE.MeshLambertMaterial({color:c});
function car(layer,cx,cz,y,L,Wd,Hh,color,kind,it,rot){ // simple car: body + cabin + wheels; L along z (nose toward -z unless rot)
  const g=new THREE.Group();const paint=new THREE.MeshPhongMaterial({color,shininess:110,specular:0x666666}),glass=new THREE.MeshPhongMaterial({color:0x111a22,shininess:150}),blk=LMv(0x151515);
  const lowH=kind==='sport'?Hh*0.55:Hh*0.5;const b=new THREE.Mesh(new THREE.BoxGeometry(Wd,lowH,L),paint);b.position.y=0.55+lowH/2;g.add(b);
  const cl=kind==='sport'?L*0.42:L*0.62,ch=Hh-0.55-lowH;const cab=new THREE.Mesh(new THREE.BoxGeometry(Wd*0.86,ch,cl),glass);cab.position.set(0,0.55+lowH+ch/2,kind==='sport'?L*0.05:L*0.06);g.add(cab);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(Wd*0.8,0.12,cl*0.8),paint);roof.position.set(0,Hh-0.06,cab.position.z);g.add(roof);
  const tg=new THREE.CylinderGeometry(1.15,1.15,0.8,20);tg.rotateZ(Math.PI/2);const wb=kind==='sport'?L*0.27:L*0.3;for(const s of [-1,1])for(const z of [-wb,wb]){const w=new THREE.Mesh(tg,blk);w.position.set(s*(Wd/2-0.3),1.15,z);g.add(w);}
  for(const s of [-1,1]){const hl=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.25,0.08),new THREE.MeshBasicMaterial({color:0xfff6dc}));hl.position.set(s*Wd*0.33,0.55+lowH*0.8,-L/2-0.02);g.add(hl);const tl=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.2,0.08),new THREE.MeshBasicMaterial({color:0xb01010}));tl.position.set(s*Wd*0.33,0.55+lowH*0.85,L/2+0.02);g.add(tl);}
  g.position.set(cx,y,cz);if(rot)g.rotation.y=rot;groups[layer].add(g);g.traverse(o=>{if(o.isMesh){o.castShadow=true;if(it){o.userData.item=it;pickables.push(o);}}});
  colliders.push({x0:cx-Wd/2,x1:cx+Wd/2,z0:cz-L/2,z1:cz+L/2,y0:y,y1:y+Hh});return g;}
const IN=v=>v/12;
// --- main garage: Tesla Model Y + Cadillac XT5 (manufacturer specs)
{const y=HM;const MY=NI('Tesla Model Y (Clark)','own','Tesla spec: 188.7 in L × 75.6 in W (83.8 in with mirrors, 78.0 folded) × 63.8 in H. West bay, next to the Tesla Wall Connector (west wall). Source: tesla.com owner\'s manual (Model Y dimensions).',null,'cars',{short:'Tesla Model Y',pri:8});
 const XT=NI('Cadillac XT5 (Jenny)','own','Cadillac spec: 189.6 in L × 74.9 in W × 66.1 in H. East bay. Source: cadillac.com XT5 specifications. 24 × 24 garage (record): two SUVs side by side leave ~10 ft of width for walkways between and beside them.',null,'cars',{short:'Cadillac XT5',pri:8});
 const a=G.P(6.2,11.5),b=G.P(17.4,11.5);
 car('cars',a[0],a[1],y,IN(188.7),IN(75.6),IN(63.8),0xe8e8ea,'suv',MY);car('cars',b[0],b[1],y,IN(189.6),IN(74.9),IN(66.1),0x1c2a3a,'suv',XT);
 MY.pos=[a[0],y+8,a[1]];XT.pos=[b[0],y+8,b[1]];}
// --- pole barn small section: future sports car test-fit (Porsche 911 992)
{const y=PBy;const it=NI('Future sports car test-fit: Porsche 911 (992) in the smaller section','prop','Porsche spec (992.2 Carrera): 178.8 in L × 72.9 in W (80.0 in with mirrors) × 51.1 in H (newsroom.porsche.com tech specs). Alternative Shelby GT350: 188.9 × 75.9 in (caranddriver.com). Fits the ~11.5 ft-wide smaller section with a 3+ ft walkway, but NOT through the old ~7 ft wooden double door: replace it with a 9 × 7 ft modern overhead door (proposed). It does not fit in the large section with the van + pontoon.',null,'cars',{short:'Porsche 911 (future) test-fit',pri:8});
 const p=PB.P(5.4,10.5);car('cars',p[0],p[1],y,IN(178.8),IN(72.9),IN(51.1),0xb3121a,'sport',it,Math.PI);it.pos=[p[0],y+7,p[1]];}
// --- riding mower + lawn gear: large section behind the van
{const it=NI('Riding mower + lawn gear (relocated)','own','Behind the van in the large section (~12 ft spare behind the 24.5 ft van). The smaller section is too narrow for a car + mower side by side: ~11.2 ft − 7.0 ft (Model Y with mirrors) = ~4.2 ft vs a ~4 ft-wide rider with a 42–46 in deck.',null,'cars',{short:'Riding mower',pri:6});
 const p=PB.P(15.8,31.5);const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.6,5.8),LMv(0x2f7a2f));b.position.y=1.5;g.add(b);const st=new THREE.Mesh(new THREE.BoxGeometry(2,1.2,1.2),LMv(0x222222));st.position.set(0,2.8,1.2);g.add(st);
 const tg=new THREE.CylinderGeometry(0.9,0.9,0.7,14);tg.rotateZ(Math.PI/2);for(const [x,z] of [[-1.7,1.8],[1.7,1.8],[-1.6,-2],[1.6,-2]]){const w=new THREE.Mesh(tg,LMv(0x111111));w.position.set(x,0.9,z);g.add(w);}
 g.position.set(p[0],PBy,p[1]);groups.cars.add(g);b.userData.item=it;pickables.push(b);it.pos=[p[0],PBy+5,p[1]];
 for(let k=0;k<3;k++){const q=PB.P(19.5+k*0.9,35.6);const t=new THREE.Mesh(new THREE.BoxGeometry(0.5,4.5,0.3),LMv(0x8b6b4a));t.position.set(q[0],PBy+2.25,q[1]);groups.cars.add(t);}}
// --- barn-fit variants
{const it=NI('Tandem variant: Model Y behind the 911 (smaller section)','prop','Smaller section ~11.5 ft wide (divider position estimated) × ~37.3 ft deep. 911 (14.9 ft) + Model Y (15.7 ft) = 30.6 ft, leaving ~6.7 ft for the door end, the gap and the back wall (e.g. 3 + 2 + 1.7 ft). The existing workbench along the back wall (~2.5 ft deep) must move, or end clearance drops to ~1.4 ft. Width: Model Y 7.0 ft with mirrors → ~4.5 ft side walkway. Door: 9×7 or 9×8 is fine (Model Y 5.3 ft tall).',null,'tandem',{short:'Tandem: 911 + Model Y',pri:8});
 const p=PB.P(5.4,27.7);car('tandem',p[0],p[1],PBy,IN(188.7),IN(75.6),IN(63.8),0xe8e8ea,'suv',it,Math.PI);it.pos=[p[0],PBy+7,p[1]];colliders.pop();
 const it2=NI('Divider removed: van + pontoon + sports car (only if non-structural; no structural work)','prop','Only if the wall is non-structural; no structural work. Full ~31.3 ft width: van 7.7 ft with mirrors + pontoon 8.5 ft + 911 6.7 ft with mirrors = 22.9 ft, leaving ~8.4 ft for walkways (about 3 ft between each). Lengths all fit in 37.3 ft. The 911 still enters through the new 9×7 door.',[PB.P(12,19)[0],PBy+14,PB.P(12,19)[1]],'nowall',{short:'Divider removed (if non-structural)',pri:8});
 const Qv=new URLSearchParams(location.search);setTimeout(()=>{const set=(l,on)=>{const c=document.querySelector('#layers input[data-l="'+l+'"]');if(c)c.checked=on;};set('tandem',Qv.get('tandem')==='1');set('nowall',Qv.get('nowall')==='1');if(Qv.get('door')==='B'){set('optA',false);set('optB',true);}if(Qv.get('nowall')==='1'&&window.toggleDivider)toggleDivider();refresh();},0);
 document.addEventListener('change',e=>{if(e.target&&e.target.dataset&&e.target.dataset.l==='nowall'&&window.toggleDivider)toggleDivider();});}
// --- modern barn doors (Hanna look: black flush insulated steel + cedar accent above + black up/down sconces)
{const it=NI('Proposed modern doors (concept): full-view glass, brown frame','prop','Full-view aluminum sectional doors with frosted glass lites (clear optional), frame in brown to match the trim (toggle black/brown/cream), set in the existing cream steel siding with a brown trim border. Pole barn: keep the tall ~10 × 11.5 ft van opening; replace the old wooden double door with a 9 × 7; gym barn: 8 ft-wide door. E.g. Clopay Avante or Amarr Vista. myQ-ready openers.',null,'barn',{short:'Proposed modern doors (concept)',pri:7});
 const DGLASS=new THREE.MeshPhongMaterial({color:0xc9d6dc,shininess:90,specular:0x888888,transparent:true,opacity:0.82}),DFRAME=new THREE.MeshPhongMaterial({color:0x5a3e2a,shininess:40}),DTRIM=new THREE.MeshLambertMaterial({color:0x6b4a2e});
 window.setDoorFrame=k=>{const C={black:[0x1a1a1a,0x2a2a2a],brown:[0x5a3e2a,0x6b4a2e],cream:[0xe9dfc8,0xdccfb0]}[k]||[0x5a3e2a,0x6b4a2e];DFRAME.color.setHex(C[0]);DTRIM.color.setHex(C[1]);};
 {const lay=document.getElementById('layers');if(lay){const w=document.createElement('label');w.innerHTML='Door frame: <select id="dfSel"><option value="brown">brown</option><option value="black">black</option><option value="cream">cream</option></select>';lay.appendChild(w);w.querySelector('select').onchange=e=>setDoorFrame(e.target.value);}const qf=new URLSearchParams(location.search).get('frame');if(qf){setDoorFrame(qf);const e=document.getElementById('dfSel');if(e)e.value=qf;}}
 const doorTex=ctex(256,(c,n)=>{c.fillStyle='#262729';c.fillRect(0,0,n,n);for(let i=0;i<32;i++){c.fillStyle=i%8===7?'#121314':'#1e1f21';c.fillRect(0,i*n/32,n,1.5);}});
 const cedar=new THREE.MeshLambertMaterial({color:0xc99a62});texMat(cedar,'plank',1,1);
 const mk=(F,y0,uA,uB,v,h,side,acc,grp)=>{const GG=grp||groups.barn;const L=uB-uA;const mat=DGLASS;
   let a,b;if(side==='S'){a=F.P(uA,v);b=F.P(uB,v);}else{a=F.P(v,uA);b=F.P(v,uB);}
   const horiz=side==='S';const d=new THREE.Mesh(new THREE.BoxGeometry(horiz?L:0.2,h,horiz?0.2:L),mat);d.position.set((a[0]+b[0])/2,y0+h/2,(a[1]+b[1])/2+(horiz?(v>30?-0.42:0.42):0));if(!horiz)d.position.x+=0.42;GG.add(d);d.userData.item=it;pickables.push(d);
   {const nc=Math.max(3,Math.round(L/2.6)),nr=Math.max(4,Math.round(h/1.8));const bar=(w,hh,x,y)=>{const m=new THREE.Mesh(horiz?new THREE.BoxGeometry(w,hh,0.26):new THREE.BoxGeometry(0.26,hh,w),DFRAME);m.position.set(d.position.x+(horiz?x:0.04),y,d.position.z+(horiz?(v>30?-0.04:0.04):x));GG.add(m);};
    for(let i=0;i<=nc;i++)bar(0.28,h,-L/2+i*L/nc,y0+h/2);for(let j=0;j<=nr;j++)bar(L,j===0?0.6:0.3,0,y0+(j===0?0.3:j*h/nr));}
   // frame
   const fr=new THREE.Mesh(new THREE.BoxGeometry(horiz?L+1.2:0.3,h+0.6,horiz?0.3:L+1.2),DTRIM);fr.position.copy(d.position);fr.position.y=y0+(h+0.4)/2;if(horiz)fr.position.z+=(v>30?0.06:-0.06);else fr.position.x-=0.06;GG.add(fr);
   if(acc){const ah=acc;const cb=new THREE.Mesh(new THREE.BoxGeometry(horiz?L+0.8:0.1,ah,horiz?0.1:L+0.8),cedar);cb.position.set(d.position.x+(horiz?0:0.05),y0+h+0.5+ah/2,d.position.z+(horiz?0.05:0));GG.add(cb);
     const sc=new THREE.Mesh(new THREE.BoxGeometry(horiz?0.35:0.5,0.9,horiz?0.5:0.35),LMv(0x111111));sc.position.set(d.position.x+(horiz?0:0.3),y0+h+0.5+ah*0.45,d.position.z+(horiz?0.3:0));GG.add(sc);}
   // hide/disable the old white door slab at the same place if any
   };
 // pole barn south face (v=0): tall van door u14-24 h11.5 with cedar band to eave; small-section door u2-8 h7 (proposed 9 x 7 when widened)
 mk(PB,PBy,14,24,-0.3,11.5,'S',0);mk(PB,PBy,1.2,10.2,-0.3,8,'S',0,groups.optA);
 mk(PB,PBy,1.2,10.2,38.3,8,'S',0,groups.optB);
 {const sw=new THREE.MeshLambertMaterial({color:0x7a5a3a});texMat(sw,'plank',1,1);const a=PB.P(2.7,-0.35);const d=new THREE.Mesh(new THREE.BoxGeometry(4.2,6.4,0.2),sw);d.position.set(a[0],PBy+3.2,a[1]);groups.optB.add(d);
  const cr=new THREE.Mesh(new THREE.BoxGeometry(5.6,8.2,0.15),LMv(0xd9d3b8));const b=PB.P(7.6,-0.25);cr.position.set(b[0],PBy+4.1,b[1]);groups.optB.add(cr);
  const cr2=new THREE.Mesh(new THREE.BoxGeometry(9.2,1.8,0.15),LMv(0xd9d3b8));const c2=PB.P(5.7,-0.25);cr2.position.set(c2[0],PBy+7.3,c2[1]);groups.optB.add(cr2);
  const bf=new THREE.Mesh(new THREE.BoxGeometry(9.2,8.2,0.15),LMv(0xd9d3b8));const c3=PB.P(5.7,38.25);bf.position.set(c3[0],PBy+4.1,c3[1]);groups.optA.add(bf);
  const ap=PB.P(5.7,46);const g=new THREE.Mesh(new THREE.PlaneGeometry(12,15),LMv(0x8f8a80));g.rotation.x=-Math.PI/2;g.position.set(ap[0],PBy+0.06,ap[1]);groups.optB.add(g);}
 NI('Option A: replace the swing door with a 9×8 glass overhead door (front)','prop','Existing double swing door ≈ 4–4.5 ft W × 6–6.5 ft H (estimated from listing photo p51 against the 3 ft man door). A 9×8 needs the opening roughly doubled: cut siding/girts, new header between posts (a post may need relocating → engineering + likely a building permit). Straight-in tandem from the front drive. Mower then shares the 9 ft door; store it behind the van.',[PB.P(5.7,0)[0],PBy+10,PB.P(5.7,0)[1]+2],'optA',{short:'Option A: 9×8 door (front)',pri:8});
 NI('Option B: add a NEW 9×8 glass overhead door on the rear gable, keep the swing door','prop','Front wall has no room for a 9 ft door beside the swing door (section ~11.5 ft; swing door ~4.2 ft). The rear (north) gable end gives a straight-in tandem: new opening + header between posts, gravel apron/drive around the barn to the back (rear access and grade not verified). Swing door stays for the mower/walk-in.',[PB.P(5.7,38)[0],PBy+10,PB.P(5.7,38)[1]-2],'optB',{short:'Option B: new rear 9×8 door',pri:8});
 // gym barn east face (u=28): v11-19 h8
 mk(GY,GYy,11,19,28.0,8,'E',0);
 it.pos=[PB.P(19,0)[0],PBy+14.5,PB.P(19,0)[1]+4];
 // remove the old white overhead/door slabs from view
 groups.barn.children.forEach(o=>{const n=o.userData&&o.userData.item&&o.userData.item.name;if(n&&/^Overhead door \(with opener\)|^Old wooden double door/.test(n))o.visible=false;});}
// --- UniFi network (prosumer)
const NET=[];
{const add=(name,txt,x,y,z,r,kind)=>{const col=kind==='gw'?0x2a7fff:kind==='out'?0x00b0a0:kind==='br'?0xffa000:0x3a8fff;
  const m=new THREE.Mesh(kind==='br'?new THREE.BoxGeometry(0.8,0.8,0.4):new THREE.CylinderGeometry(0.55,0.55,0.18,20),new THREE.MeshBasicMaterial({color:col}));m.position.set(x,y,z);groups.net.add(m);
  const it=NI(name,'prop',txt,[x,y+2.5,z],'net',{short:name.split(' (')[0],pri:6});m.userData.item=it;pickables.push(m);
  if(r){const ring=new THREE.Mesh(new THREE.RingGeometry(r-1.2,r,64),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,(kind==='out'?elev(x,z):y-5)+1.2,z);groups.netcov.add(ring);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(r,64),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.09,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.copy(ring.position);groups.netcov.add(disc);}};
 const h=(u,v)=>H.P(u,v);
 {const p=h(27,6);add('UniFi Cloud Gateway Ultra + Switch Lite 8 PoE (gateway)','House network core in the lower mechanical room next to the ISP modem: Cloud Gateway Ultra ($129) + Switch Lite 8 PoE ($109) powering the APs (store.ui.com list, Oct 2026).',p[0],HL+4,p[1],0,'gw');}
 {const p=h(20,20);add('UniFi U7 Pro AP — lower level','Ceiling AP, WiFi 7, ~1,500 sf each ($189, store.ui.com).',p[0],HL+8.6,p[1],45,'ap');}
 {const p=h(24,14);add('UniFi U7 Pro AP — main level','Great room ceiling ($189).',p[0],HM+8.6,p[1],50,'ap');}
 {const p=h(7,15);add('UniFi U7 Pro AP — loft','Loft ceiling ($189).',p[0],HM+17,p[1],40,'ap');}
 {const p=h(44,30);add('UniFi U7 Outdoor AP — deck / yard / pond','Mounted at the NE deck corner ($199, store.ui.com); covers the deck, walk-out, pond and fire pit.',p[0],HM+7,p[1],150,'out');}
 {const x=W(330),z=Zs(330);add('UniFi U7 Outdoor AP — field / solar (on a post)','Post-mounted outdoor AP fed by PoE in the solar trench conduit ($199).',x,elev(x,z)+9,z,170,'out');}
 {const p=G.P(-0.3,20);add('UniFi Building Bridge (UBB) — house end','60 GHz point-to-point bridge, house → pole barn (~200 ft line of sight). UBB kit $279 (store.ui.com; out of stock as of Oct 2026 — alternative: Device Bridge or a 2nd outdoor AP in mesh). Alternative: bury Cat6/fiber in the planned barn trench.',p[0],HM+10,p[1],0,'br');}
 {const p=PB.P(16,0);add('UBB — pole barn end + U7 Pro inside','Bridge on the barn gable; U7 Pro inside for the van and shop ($189).',p[0],PBy+12.5,p[1]+0.6,60,'br');}
 {const p=GY.P(28,26);add('UBB / mesh link — gym barn + U7 Pro inside','Second bridge (or mesh from the pole-barn AP) to the gym; U7 Pro inside for the Peloton/TV/cameras ($189).',p[0]+0.4,GYy+9.5,p[1],55,'br');}
}
// --- Ring cameras (hard-wired power, Wi-Fi data) + doorbell
{const cam=(name,x,y,z,yaw,txt)=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.7,0.5),LMv(0x111111));g.add(b);const l=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.1,14),new THREE.MeshBasicMaterial({color:0x3399ff}));l.rotation.x=Math.PI/2;l.position.z=-0.28;g.add(l);
   const cone=new THREE.Mesh(new THREE.ConeGeometry(9,26,24,1,true),new THREE.MeshBasicMaterial({color:0xff5050,transparent:true,opacity:0.08,side:THREE.DoubleSide,depthWrite:false}));cone.rotation.x=Math.PI/2+0.35;cone.position.set(0,-4,-13);groups.camcov.add(cone);
   g.position.set(x,y,z);g.rotation.y=yaw;groups.cams.add(g);cone.parent=null;const cw=new THREE.Group();cw.position.copy(g.position);cw.rotation.y=yaw;cw.add(cone);groups.camcov.add(cw);
   const it=NI('Ring camera — '+name,'prop',txt||'Ring Spotlight Cam Pro Plug-In ($229.99, Macy\'s/Ring), hard-wired to a junction box (Wi-Fi data).',[x,y+2,z],'cams',{short:'Ring cam: '+name,pri:5});b.userData.item=it;pickables.push(b);};
 const h=(u,v)=>H.P(u,v);let p;
 p=G.P(2,24.3);cam('garage / front entry',p[0],HM+8.5,p[1],0);
 p=h(44.3,16);cam('deck + sliders',p[0],HM+8,p[1],-Math.PI/2);
 p=h(34.3,8);cam('walk-out patio',p[0],HL+8,p[1],-Math.PI/2);
 cam('driveway',W(236),elev(W(236),Zs(112))+12,Zs(112),Math.PI*0.8,'Ring Spotlight Cam Pro Plug-In on a light post at the drive bend, facing the approach from Samels Rd.');
 p=PB.P(30,0);cam('pole barn doors',p[0],PBy+11,p[1]+0.5,Math.PI);
 p=GY.P(28,4);cam('gym barn',p[0]+0.5,GYy+9,p[1],-Math.PI/2);
 cam('solar field',SOLAR.x-30,elev(SOLAR.x-30,SOLAR.z)+10,SOLAR.z-20,Math.PI*0.85,'Ring Spotlight Cam Pro Plug-In on the AP post, powered from the array conduit.');
 p=G.P(-0.3,12);{const d=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.5,0.25),LMv(0x111111));d.position.set(p[0]-0.1,HM+4.2,p[1]);groups.cams.add(d);const it=NI('Ring Wired Doorbell Pro (entry)','prop','Ring Wired Doorbell Pro, $199.99 (Ring/Amazon list), on the main entry by the garage (entry location inferred).',[p[0],HM+6.5,p[1]],'cams',{short:'Ring doorbell',pri:5});d.userData.item=it;pickables.push(d);}}
// --- smart home labels
{const lock=(name,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.5,0.25),new THREE.MeshBasicMaterial({color:0x40c060}));m.position.set(x,y,z);groups.smart.add(m);const it=NI('Smart lock — '+name,'prop','Yale Assure Lock 2 with Wi-Fi ($259.99 list; often ~$140-195 on sale), works with Ring/Alexa. Level Lock+ is the alternative.',[x,y+2,z],'smart',{short:'Smart lock: '+name,pri:4});m.userData.item=it;pickables.push(m);};
 let p=G.P(-0.3,12);lock('main entry',p[0]-0.2,HM+3.4,p[1]-1.5);
 p=H.P(34.3,5.2);lock('walk-out door',p[0]+0.2,HL+3.4,p[1]);
 p=PB.P(27.5,0);lock('pole barn walk-in',p[0],PBy+3.4,p[1]+0.5);
 p=GY.P(23.5,0);lock('gym man door',p[0],GYy+3.4,p[1]+0.5);
 const th=(name,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.4,0.4),new THREE.MeshBasicMaterial({color:0xf0f0f0}));m.position.set(x,y,z);groups.smart.add(m);const it=NI('Smart thermostat — '+name,'prop','ecobee Smart Thermostat Premium ($259.99, ecobee.com); Nest Learning is the alternative. Alexa/Ring-compatible.',[x,y+2,z],'smart',{short:'ecobee: '+name,pri:4});m.userData.item=it;pickables.push(m);};
 p=H.P(12.2,8);th('main level',p[0],HM+5,p[1]);p=H.P(12.2,18);th('lower level',p[0]+0.2,HL+5,p[1]+6);
 const mq=(name,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.3,0.5),new THREE.MeshBasicMaterial({color:0xffb000}));m.position.set(x,y,z);groups.smart.add(m);const it=NI('myQ opener — '+name,'prop','Chamberlain myQ Smart Garage Control ($59.99-64.99, Amazon list) or a myQ-built-in opener; Alexa/Ring integrations.',[x,y+1.5,z],'smart',{short:'myQ: '+name,pri:3});m.userData.item=it;pickables.push(m);};
 p=G.P(12,20);mq('main garage',p[0],HM+8.5,p[1]);p=PB.P(19,4);mq('pole barn tall door',p[0],PBy+11.5,p[1]);p=PB.P(5,3);mq('pole barn small door',p[0],PBy+8,p[1]);p=GY.P(25,15);mq('gym door',p[0],GYy+9,p[1]);}
// --- main-floor offices
{const Bx=(u0,v0,u1,v1,h,c,y0,col)=>Dx(u0,v0,u1,v1,h,c,y0===undefined?0:y0,col);
 // Office (bedroom 1): existing Seabreeze desk + Aeron; add shelving on the west wall
 Bx(0.3,5.2,0.45,11.2,7,0xe8e2d6,0);for(const v of [5.2,11.05])Bx(0.3,v,1.5,v+0.15,7,0xd9d4c8,0);for(let i=1;i<6;i++)Bx(0.35,5.3,1.45,11.1,0.08,0xd9d4c8,i*1.3);
 for(let i=0;i<14;i++){const v=5.6+i*0.4;Bx(0.5,v,1.3,v+0.25,0.9+(i%3)*0.15,[0x7a3b22,0x2f4d6a,0xc9b27a,0x444444][i%4],1.3*(1+(i%4)));}
 info('Office','prop','Smaller main-floor bedroom = pure office: Seabreeze #6 glass-top desk + #20 Aeron chair, wall shelving. Listing (Real Estate One): 11 × 9 ft. Model room is ~12 × 12 (kept so the main bath and closets line up).',[H.P(6,6)[0],HM+7,H.P(6,6)[1]],{near:true,layer:'house'});
 // Office / guest (bedroom 2, larger, direct door to the main bath)
 const futonIt=info('Office / guest (futon)','prop','Larger main-floor bedroom (sellers\' master, direct door to the main bath kept): second desk (Jenny/guest), queen sleeper sofa/futon (~7 ft × 3 ft closed, ~7 × 6.5 ft open) with ≥3 ft clearance when open, small side table. Listing: 13 × 13 ft. Model room is ~12 × 12 (the house footprint and bath wall fix it).',[H.P(5,26)[0],HM+7,H.P(5,26)[1]],{near:true,layer:'house'});
 {const a=H.P(0.6,28.6),b=H.P(7.6,31.6);const k={x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1]),y0:HM};fxSofa(k,'n',0x3c4a5a,{arm:0.35,pillows:[0xe9e4da,0xc9a27a,0xe9e4da]});colliders.push({x0:k.x0,x1:k.x1,z0:k.z0,z1:k.z1,y0:HM,y1:HM+3});} // futon (queen sleeper)
 Bx(0.6,25.1,7.6,28.6,0.04,0x8a96a6,0.02); // ghost of the opened bed footprint (rug-like marker)
 Bx(7.9,30.0,9.3,31.5,1.9,0x6b4f3a,0,true); // side table
 Bx(0.3,21.0,2.6,25.0,0.12,0xeeeeee,2.4);for(const v of [21.2,24.8])Bx(0.4,v-0.1,2.5,v+0.1,2.4,0x1d1f22,0); // desk 2
 Bx(2.9,22.3,4.5,23.9,1.6,0x3a3a3a,0); // task chair (simple)
 const it2=NI('Office / guest — open futon needs ~3 ft clearance','prop','Opened queen footprint shown as the pale marker; ~3.5 ft remains between it and the desk/door.',null,'house');it2.pos=null;
 // direct door bedroom 2 -> main bath is the opening at v=20, u4.5-7 (see wall)
}


// --- floor finish toggle (default: long gray porcelain wood-look plank, like 339 Sandbar)
{const F=[];const seen=new Set();scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m||!m.color||seen.has(m))continue;const h=m.color.getHex();if(h===0xe2cfae||h===0xd9ccb6||h===0xf3efe6&&false){seen.add(m);F.push([m,h]);}}});
 window.setFloor=k=>{F.forEach(([m,h])=>m.color.setHex(k==='wood'?h:0xb4b4b0));};
 const lay=document.getElementById('layers');if(lay){const w=document.createElement('label');w.innerHTML='Floor: <select id="flSel"><option value="gray">gray plank tile</option><option value="wood">wood</option></select>';lay.appendChild(w);w.querySelector('select').onchange=e=>setFloor(e.target.value);}
 const qf=new URLSearchParams(location.search).get('floor')||'gray';setFloor(qf);const e=document.getElementById('flSel');if(e)e.value=qf;}

// --- deck & rail color (default brown = matches the barn door trim); house siding unchanged
{const D=[],R=[];const seen=new Set();groups.bldg.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m||!m.color||seen.has(m))continue;const h=m.color.getHex();if(h===0x8a6242&&m.map){seen.add(m);D.push(m);}else if(h===0x5a3f2c){seen.add(m);R.push(m);}}});
 const C={current:[0x8a6242,0x5a3f2c],brown:[0x6b4a2e,0x5a3e2a],cream:[0xe6dcc4,0xdccfb0]};
 window.setDeck=k=>{const c=C[k]||C.brown;D.forEach(m=>m.color.setHex(c[0]));R.forEach(m=>m.color.setHex(c[1]));const e=document.getElementById('dkSel');if(e)e.value=k;};
 const lay=document.getElementById('layers');if(lay){const w=document.createElement('label');w.innerHTML='Deck &amp; rail color: <select id="dkSel"><option value="brown">brown (matches door trim)</option><option value="cream">cream</option><option value="current">current</option></select>';lay.appendChild(w);w.querySelector('select').onchange=e=>setDeck(e.target.value);}
 const _df=window.setDoorFrame;window.setDoorFrame=k=>{_df(k);if(k==='brown'||k==='cream')setDeck(k);};
 const q=new URLSearchParams(location.search);setDeck(q.get('deck')||(q.get('frame')==='cream'?'cream':'brown'));
 info('Deck & railings: solid stain to match the barn door trim (concept)','prop','~320 sf deck (10 × 32 ft in the model) + ~55 LF of rail. Pro clean + solid stain $1.50–5.50/sf, railings $4–14/LF (RemodelCalculators 2026) → ~$1–4K. Optional alternative: replace wood rails with black/bronze aluminum or cable rail (by quote). House siding color unchanged.',[H.P(39,16)[0],HM+6,H.P(39,16)[1]],{layer:'bldg',short:'Deck: solid stain to match trim',pri:4});}
// --- big pole barn: freeze protection note (van bay)
info('Van bay freeze protection (options)','prop','(a) Winterize the Interstate 24X (Timberline system: drain or RV antifreeze in the domestic water; coolant needs none — Airstream Support) and/or keep it on the 30 A shore outlet so the 12 V fresh/gray tank pads (on at 44°F, off at 64°F — 2022 24X owner\'s manual) work. (b) Recommended: insulate the van bay (~2,000 sf closed-cell, $1.80–3.50/sf) + Modine Hot Dawg HD45 LP heater ($963–1,429) on a thermostat at 40°F → ~$6–11K. (c) Insulate the whole barn ~$5–16K + heater. Propane heaters must be vented (power-vent) and the barn needs a CO alarm.',[PB.P(16,20)[0],PBy+13,PB.P(16,20)[1]],{layer:'barn',short:'Van bay freeze protection',pri:5});
// --- new layers' default state + labels for items created after the label pass
{const lay=document.getElementById('layers');
 NEWITEMS.concat(items.filter(i=>!i.el&&i.pos)).forEach(it=>{if(it.el||!it.pos)return;const d=document.createElement('div');d.className='lbl'+(it.tag==='own'?' own':soft(it.tag)?' prop':'');it.layer=it.layer||guessLayer(it);
   d.textContent=it.short||it.name.split(/\s+\(|\s+—\s+|:\s+/)[0].slice(0,30);it.pri=it.pri!==undefined?it.pri:4;d.title=it.name;d.onclick=()=>showInfo(it);lblDiv.appendChild(d);it.el=d;});
 lay.querySelectorAll('input').forEach(c=>{if(['netcov','camcov','tandem','nowall','optB'].includes(c.dataset.l))c.checked=false;});}

// jump-to
const J=[['🏡 Whole site',()=>{flyTo(home.tgt,560,[-0.3,0.65,0.8]);}],
 ['🏠 House (orbit)',()=>flyTo([H.x0+17,HM,H.z0-25],110,[1,0.5,0.6])],
 ['🚪 Walk in house',()=>setMode('walk',{x:G.x0+12,z:G.z0-32,feet:HM,yaw:Math.PI})],
 ['⬇ Lower level',()=>setMode('walk',{x:H.x0+40,z:H.z0-21,feet:HL+0.1,yaw:Math.PI/2})],
 ['🚗 Garage: EV + Powerwall',()=>setMode('walk',{x:G.x0+14,z:G.z0-10,feet:HM,yaw:Math.PI/2})],
 ['🛖 Pole barn',()=>flyTo([PB.x0+16,PBy,PB.z0-19],90,[0.2,0.6,1])],
 ['🚐 Walk: Airstream bay',()=>setMode('walk',{x:PB.x0+15.2,z:PB.z0+16,feet:PBy,yaw:0})],
 ['🏋 Gym (orbit, x-ray)',()=>{document.getElementById('roofT').checked=false;refresh();flyTo([GY.x0+14,GYy,GY.z0-17],60,[0.6,1.1,0.7]);}],
 ['🏋 Walk into gym',()=>setMode('walk',{x:GY.x0+34,z:GY.z0-15,feet:GYy,yaw:Math.PI/2})],
 ['🚲 Gym: bike wall + eBike',()=>setMode('walk',{x:GY.x0+16,z:GY.z0-9,feet:GYy,yaw:Math.PI})],
 ['🚿 Gym: outdoor shower',()=>setMode('walk',{x:GY.x0+22,z:GY.z0-42,feet:GYy,yaw:Math.PI*0.75})],
 ['🧖 Gym: sauna + plunge',()=>setMode('walk',{x:GY.x0+10,z:GY.z0-22,feet:GYy,yaw:Math.PI*0.25})],
 ['🛠 Shed',()=>flyTo([SH.x0+5,SHy,SH.z0-6],50)],
 ['🪷 Pond',()=>flyTo([W(345),rawElev(W(345),Zs(296)),Zs(296)],60,[1,0.6,0.4])],
 ['⚡ Electrical',()=>flyTo([W(230),HM,Zs(220)],170,[0.2,1,0.7])],
 ['☀ Solar areas',()=>flyTo([W(370),HM,Zs(300)],200,[0,0.8,1])],
 ['🏘 ADU spot',()=>flyTo([W(470),rawElev(W(470),Zs(330)),Zs(330)],140,[0.4,0.7,1])],
 ['🟪 Future consideration (~2 yrs out): Guest suite — orbit',()=>{flyTo([SU.x0+10,HM,SU.z0-14],75,[-0.9,0.8,0.7]);}],
 ['🟪 Future consideration (~2 yrs out): Guest suite — walk in',()=>setMode('walk',{x:SU.x0-11,z:SU.z0-11.5,feet:HM,yaw:-Math.PI/2})],
 ['🍸 Great room lounge',()=>setMode('walk',{x:H.x0+31,z:H.z0-6,feet:HM,yaw:Math.PI/2})],
 ['🛋 Lower sitting room (master retreat)',()=>setMode('walk',{x:H.x0+31,z:H.z0-16,feet:HL+0.1,yaw:Math.PI/4})],
 ['🧱 Barn divider: remove only if non-structural',()=>{const on=window.toggleDivider();flyTo([PB.x0+16,PBy,PB.z0-19],70,[0.2,1.2,0.8]);document.getElementById('roofT').checked=false;refresh();}],
 ['🔥 Septic/well/propane/firepit',()=>flyTo([W(300),HM,Zs(290)],160,[0.3,0.9,1])]];
// ================= VIEWPOINTS + TOUR =================
const yawTo=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z));
const hp=(u,v)=>H.P(u,v);
const VP=[];const vw=(n,cap,u,v,feet,tu,tv,pitch,F)=>{F=F||H;const [x,z]=F.P(u,v),[tx,tz]=F.P(tu,tv);VP.push({n,cap,walk:{x,z,feet,yaw:yawTo(x,z,tx,tz),pitch:pitch||0}});};
const vo=(n,cap,t,pos)=>VP.push({n,cap,orbit:{t,pos}});
vo('🛰 Aerial overview','Whole 6-acre parcel: house, pole barn, gym barn, pond, field.',[-125,15,-60],[-20,300,95]);
{const x=W(150),z=Zs(71);VP.push({id:'arrival',n:'🚗 Arrival — driveway',cap:'Coming up the paved drive from Samels Rd; pole barn ahead, house beyond.',walk:{x,z,yaw:yawTo(x,z,W(262),Zs(200)),pitch:-0.02}});}
{const t=[H.x0+20,HM+6,H.z0-26];vo('🏠 Front exterior (garage side)','Chalet with attached 24×24 garage; steep gray metal roof, light lap siding, black-frame windows.',t,[t[0]-70,t[1]+30,t[2]-75]);}
{const t=[H.x0+22,HM+4,H.z0-14];vo('🌊 Pond-side elevation','East glass gable, wraparound deck above the walk-out, pond in front.',t,[t[0]+95,t[1]+22,t[2]+30]);}
vw('🪵 Deck — teak dining table','8-ft teak table on the ~10 ft deck; cocktails and dinners outside.',39,26.5,HM,38.5,14,-0.18);VP[VP.length-1].walk.fov=68;
{const c=H.P(35.2,10.2),t=H.P(47,8);vo('☕ Walk-out patio — morning coffee','From the patio chairs: bistro table for two, looking out to the pond; fire pit circle (proposed) to the right.',[t[0]+20,HL+3.2,t[1]+20],[c[0]+4.4,HL+4.9,c[1]-0.6]);VP[VP.length-1].orbit.fov=72;}
vw('🍸 Great room — lounge/club','Steinway B centered as the focal piece, 2 cigar chairs + #4 bench by the glass, art panel #2 on the inner west wall, back bar; existing warm wood vaulted ceiling kept.',33,15.5,HM,13,4,-0.07);VP[VP.length-1].walk.fov=68;
vw('🍳 Kitchen island','9 × 3.5 ft quartz island with 4 stools; no formal dining.',25.5,15.8,HM,25.5,31,-0.2);VP[VP.length-1].walk.fov=68;
vw('💻 Office (main floor)','Smaller main-floor bedroom: Seabreeze glass desk + Aeron, wall shelving.',10.2,10.6,HM,2,3,-0.12);VP[VP.length-1].walk.fov=72;
vw('🛋 Office / guest (futon)','Larger main-floor bedroom: second desk, queen sleeper sofa, side table; direct door to the main bath.',10.4,21.4,HM,2,29,-0.12);VP[VP.length-1].walk.fov=72;
vw('🛏 Lower master bedroom','King bed, finished closet with doors, light oak floor, warm white walls.',10.6,10.8,HL,2,5,-0.12);VP[VP.length-1].walk.fov=68;
vw('🛁 Lower primary bath','Freestanding tub, acrylic shower, double vanity (Option B: borrows craft-room space).',15.2,11.2,HL,15,2,-0.3);VP[VP.length-1].walk.fov=68;
vw('📺 Lower sitting / TV room','Large L sectional in the NW corner (size to verify) facing the 75″ TV on a new media wall ~12 ft away.',13.6,16.2,HL,2,30,-0.12);VP[VP.length-1].walk.fov=68;
vw('🛌 Guest loft','Guest loft for guests or the kids; shower-only ¾ bath.',12.6,10,HM+9.4,6,24,-0.2);VP[VP.length-1].walk.fov=68;
{const t=PB.P(20,18),c=PB.P(38,-7);vo('🚐 Big barn — van + pontoon','Airstream Interstate 24X camper van (Sprinter 3500 dually) and the pontoon on its trailer in the large section.',[t[0],PBy+1,t[1]],[c[0],PBy+31,c[1]]);VP[VP.length-1].orbit.fov=55;VP[VP.length-1].noRoof=true;}
{const t=GY.P(11,18),c=GY.P(27.2,0.8);vo('🏋 Gym barn — CrossFit + recovery','4-station rig with lifting zones, turf sled lane, rower/SkiErg, Peloton, storage wall, wall balls, and the recovery corner (Plunge, sauna, massage chair).',[t[0],GYy+2,t[1]],[c[0],GYy+8.6,c[1]]);VP[VP.length-1].orbit.fov=70;}
{const t=[SOLAR.x,rawElev(SOLAR.x,SOLAR.z)+4,SOLAR.z];vo('☀ Ground-mount solar (concept)','~20 kW in two racked rows at ~40°, facing south; trench to the house.',t,[t[0]+75,t[1]+48,t[2]+62]);}
vo('🟪 Guest suite site (future, ~2 yrs)','Future guest suite footprint beside the chalet (purple layer).',[SU.x0+10,HM,SU.z0-14],[SU.x0-55,HM+48,SU.z0+45]);
['aerial','arrival','front','pond','deck','coffee','great_room','kitchen','office','office_guest','lower_master','lower_bath','tv_room','loft','big_barn','gym','solar','guest_suite'].forEach((id,i)=>{if(VP[i])VP[i].id=id;});
{const a=VP.find(v=>v.id==='arrival');if(a&&a.orbit){const t=a.orbit.t,p=a.orbit.pos;p[0]+=(p[0]-t[0])*0.25;p[2]+=(p[2]-t[2])*0.25;p[1]+=16;}}
{const t=GY.P(9,15.5),c=GY.P(25.6,4.2);VP.push({id:'gym_beauty',n:'🏋 Gym — 4-station rig',cap:'Compact 2-sided rig with 4 barbell stations, each on its own 8 × 6 ft lifting zone; pull-up bars at 7.5–9 ft, high and low rings, turf sled lane alongside, storage wall with dumbbells, kettlebells, bumpers and bars.',orbit:{t:[t[0],GYy+3.2,t[1]],pos:[c[0],GYy+7.2,c[1]],fov:68}});}
{const t=GY.P(6.5,27.8),c=GY.P(9.2,20.6);VP.push({id:'recovery',n:'🧊 Recovery — Plunge + Sauna',cap:'The Plunge tub (66⅝ × 31½ × 26 in) at 39°F, Plunge The Sauna Standard (cedar, glass front, HUUM heater), massage chair, cedar slat wall.',orbit:{t:[t[0],GYy+3.4,t[1]],pos:[c[0],GYy+6.2,c[1]],fov:72}});}
{const PD=[W(345),rawElev(W(345),Zs(296)),Zs(296)],HC=H.P(17,16),d=new THREE.Vector2(PD[0]-HC[0],PD[2]-HC[1]).normalize(),pb=PB.P(16,19),gy=GY.P(14,15);
 const ctr=[(HC[0]+pb[0]+gy[0])/3,HM-6,(HC[1]+pb[1]+gy[1])/3];
 VP.push({id:'drone',n:'🛸 Drone: whole parcel',cap:'High drone view over the 6 acres: house and pond, both barns, the drive, the south field and the treeline.',orbit:{t:ctr,pos:[ctr[0]+d.x*260+120,ctr[1]+330,ctr[2]+d.y*260+60],fov:55}});
 VP.push({id:'aerial_p09',n:'🛸 Aerial like listing p09',cap:'Drone view from beyond the pond toward the chalet, with the barns behind (matches listing photo p09).',orbit:{t:[(HC[0]*2+pb[0])/3,HM,(HC[1]*2+pb[1])/3],pos:[PD[0]+d.x*120+d.y*30,PD[1]+105,PD[2]+d.y*120-d.x*30],fov:52}});
 const gp=G.P(12,12);VP.push({id:'aerial_p07',n:'🛸 Aerial like listing p07',cap:'Low drone over the garage roof looking down at the pond and gardens (matches listing photo p07).',orbit:{t:[PD[0],PD[1],PD[2]],pos:[gp[0]-d.x*18,HM+42,gp[1]-d.y*18],fov:60}});
 VP.push({id:'front_p01',n:'📷 Front like listing p01',cap:'From the lawn beyond the pond: east glass gable, covered deck and the stone-edged pond (matches listing photo p01).',orbit:{t:[HC[0],HM+10,HC[1]],pos:[PD[0]+d.x*55,PD[1]+9,PD[2]+d.y*55],fov:55}});
 VP.push({id:'pond_p08',n:'📷 Pond like listing p08',cap:'Ground-level view across the stacked-stone pond with the evergreen treeline behind (matches listing photo p08).',orbit:{t:[PD[0]-d.y*10,PD[1]+4,PD[2]+d.x*10],pos:[PD[0]+d.y*40,PD[1]+5.5,PD[2]-d.x*40],fov:58}});
 const sm=[(pb[0]+gy[0]+SOLAR.x)/3,(PBy+GYy)/2,(pb[1]+gy[1]+SOLAR.z)/3];{const bc=[(pb[0]+gy[0])/2,(PBy+GYy)/2,(pb[1]+gy[1])/2],dx=SOLAR.x-bc[0],dz=SOLAR.z-bc[2],dl=Math.hypot(dx,dz)||1,t=[bc[0]+dx*0.35,bc[1],bc[2]+dz*0.35];VP.push({id:'barns_solar',n:'🛸 Aerial: barns + solar',cap:'Drone over the pole barn, the gym barn and the south-field solar array.',orbit:{t,pos:[t[0]-dx/dl*120-dz/dl*70,t[1]+120,t[2]-dz/dl*120+dx/dl*70],fov:55}});}
 window.__flyCtr=ctr;}
{const fz=re=>window.__furn.find(f=>re.test(f.name));const fv=(id,n,cap,re,off,dy,fov)=>{const f=fz(re);if(!f)return;const k=f.c,t=[(k.x0+k.x1)/2,k.y0+(dy||2.5),(k.z0+k.z1)/2];VP.push({id,n,cap,noRoof:false,orbit:{t,pos:[t[0]+off[0],k.y0+off[1],t[2]+off[2]],fov:fov||60}});};
 fv('f_piano','🎹 Steinway B close-up','Steinway Model B (6′11″ × 4′10″): curved rim, lid on its prop, music desk, pedal lyre and artist bench, centered in the great room.',/Steinway Model B/,[9,6.2,-6],2.6,55);
 fv('f_lounge','🥃 Lounge seating','Two black leather cigar chairs with roll arms and brass nailheads, the tufted leather bench and the back bar.',/#4 Tufted/,[-9,6.5,-7],1.2,62);
 fv('f_sectional','🛋 Lower TV room sectional','The gray Seabreeze sectional with chaise, cushions and pillows facing the 75″ TV and white console.',/#3 Seabreeze gray sectional/,[11,5.5,10],1.5,64);
 fv('f_office','🖥 Office desk + Aeron','Glass-top desk with a monitor and lamp, Herman Miller Aeron, wall shelving.',/Glass-top desk/,[5,5.8,-7],2.4,60);
 fv('f_loft','🛏 Loft: Milan\'s bed','Full bed with the navy tufted headboard, white nightstand and lamp, kids desk and daybed.',/full bed/,[12,7.2,13],1.8,60);
 fv('f_kitchen','🍳 Kitchen island + stools','Quartz island with seating-side cabinets and four stools under the pendants.',/Kitchen island/,[-6,6.5,9],2.8,62);}
{const t=PB.P(16,19),c=PB.P(16,19);VP.push({id:'barn_fit',n:'📐 Barn fit test (plan view)',cap:'Van + pontoon in the large section with a ~3 ft walkway; Porsche 911 test-fit in the smaller section.',orbit:{t:[t[0],PBy,t[1]-0.01],pos:[c[0],PBy+60,c[1]+0.01],fov:50},noRoof:true});}
{const t=G.P(12,11),c=G.P(12,40);VP.push({id:'garage_cars',n:'🚗 Garage: Model Y + XT5',cap:'Tesla Model Y (west bay, by the Wall Connector) and Cadillac XT5 in the 24×24 garage.',orbit:{t:[t[0],HM+2,t[1]],pos:[c[0]+10,HM+30,c[1]],fov:55},noRoof:true});}
{VP.push({id:'network',n:'📶 Network + cameras',cap:'UniFi gateway + 3 indoor APs, 2 outdoor APs, bridges to both barns; Ring cameras.',orbit:{t:[-110,10,-10],pos:[-60,330,160],fov:55},showNet:true});}
{const t=PB.P(18,0),c=PB.P(20,-40);VP.push({id:'barn_doors',n:'🚪 Modern glass barn doors',cap:'Full-view glass doors, brown frames, cream siding kept (concept).',orbit:{t:[t[0],PBy+7,t[1]],pos:[c[0],PBy+8,c[1]],fov:50}});}
{const t=PB.P(6,38),c=PB.P(10,72);VP.push({id:'barn_rear',n:'🚪 Option B: new rear door (pole barn)',cap:'New 9×8 glass overhead door on the rear gable of the smaller section; gravel apron around the barn.',orbit:{t:[t[0],PBy+5,t[1]],pos:[c[0],PBy+12,c[1]],fov:50}});}
{const c=H.P(52,6);VP.push({id:'firepit',n:'🔥 Fire pit',cap:'Stone fire pit on a paver circle near the walk-out (proposed).',orbit:{t:[c[0],HL,c[1]],pos:[c[0]-26,HL+16,c[1]+30],fov:55}});}
function goVP(v,instant){{const set=(l,on)=>{const c=document.querySelector('#layers input[data-l="'+l+'"]');if(c&&c.checked!==on){c.checked=on;}};if(v.showNet){set('netcov',true);set('camcov',true);set('net',true);set('cams',true);}else{set('netcov',false);set('camcov',false);}refresh();}const rt=document.getElementById('roofT');if(v.noRoof&&rt.checked){rt.checked=false;refresh();}else if(!v.noRoof&&!rt.checked&&v.orbit){rt.checked=true;refresh();}if(instant){anim=null;if(v.walk){const w=walkPose(v.walk);enterWalk(Object.assign({},v.walk,{feet:w.feet}));}else{camera.position.set(...v.orbit.pos);enterOrbit(new THREE.Vector3(...v.orbit.t),v.orbit.fov);camera.lookAt(...v.orbit.t);}return;}
  if(v.walk)goWalk(v.walk,true);else{const T=new THREE.Vector3(...v.orbit.t);flyCam(new THREE.Vector3(...v.orbit.pos),T,null,()=>enterOrbit(T,v.orbit.fov));}caption(v);}
function caption(v){const c=document.getElementById('caption');if(!c)return;c.innerHTML=`<b>${v.n}</b><span>${v.cap||''}</span>`;c.style.opacity=1;clearTimeout(caption.t);caption.t=setTimeout(()=>c.style.opacity=0,tour?5200:4200);}
let tour=null;
const TOUR=[
 ['drone','From above','Six quiet wooded acres in Whitewater Township: the chalet and pond, two barns, the south field and a wall of pines.'],
['arrival','Welcome to 5312 Samels Road','Six quiet wooded acres in Whitewater Township. The drive winds up past the barns to the house on the rise.'],
 ['front','The house','A sage-gray chalet with a standing-seam metal roof, brown trim and a covered wraparound deck. Big gable windows face the trees.'],
 ['great_room','The great room','The warm knotty-pine vaulted ceiling stays. The Steinway B sits at the center of the lounge as the focal piece, with a quiet conversation corner by the glass.'],
 ['kitchen','Kitchen island','A long quartz island seats four, with storage on both sides and an easy aisle to the counters and range.'],
 ['office','Main-floor offices','A focused office with the glass desk and Aeron chair, and across the hall a second office that doubles as a guest room with a fold-out futon.'],
 ['tv_room','Lower level: lounge and movies','The big L sectional settles into the corner facing the TV, steps from the walk-out patio and the morning-coffee spot.'],
 ['lower_master','Lower-level master retreat','A calm primary bedroom with a finished closet and a new full bath, its own floor away from the main living space.'],
 ['loft','The loft','A bright guest and kids space under the roof, with Milan\'s bed, a desk under the skylight and room for a daybed.'],
 ['deck','The deck','The covered wraparound deck, stained to match the barn trim, with a teak table for long summer dinners.'],
 ['aerial_p09','The chalet from the air','Like the listing drone shot: the chalet on its rise, the stone-edged pond in front and the barns tucked behind.'],
['pond','The pond','A landscaped lily pond ringed with stacked stone and plantings, just below the deck.'],
 ['big_barn','The big pole barn','Room for the Airstream Interstate and the pontoon, with a proposed glass overhead door and a tandem bay for a future sports car.'],
 ['gym_beauty','The small barn: CrossFit gym','An open room built around a compact rig with four barbell stations, each on its own lifting zone. A turf sled lane runs alongside, with the rower, SkiErg and Peloton, a storage wall for dumbbells, kettlebells and bumper plates, and a wall-ball target.'],
 ['recovery','Recovery corner','The Plunge cold tub at thirty-nine degrees beside a cedar Plunge sauna, with the massage chair and a warm cedar slat wall.'],
 ['barns_solar','Barns and solar from above','The pole barn, the gym barn and the south-field array, all linked by the gravel drive.'],
['solar','The solar field','A ground-mount array in the south field, angled for winter sun and clear of snow sliding off the roofs.'],
 ['firepit','The fire pit','A stone fire pit on a paver circle near the walk-out, made for evenings under the pines.'],
 ['guest_suite','Phase 2: the guest suite','A future guest suite with its own entry, planned for a couple of years out.']];
const NARR={on:false,voice:null};
function pickVoice(){try{const vs=speechSynthesis.getVoices()||[];const pref=[/Samantha/,/Google US English/,/Microsoft (Aria|Jenny|Guy).*Online/,/Daniel/,/Karen/,/en-US/];for(const re of pref){const v=vs.find(v=>re.test(v.name)||re.test(v.lang));if(v)return v;}return vs.find(v=>/^en/.test(v.lang))||null;}catch(e){return null;}}
if(window.speechSynthesis){try{speechSynthesis.addEventListener('voiceschanged',()=>{NARR.voice=pickVoice();});}catch(e){}}
const SS=window.speechSynthesis||null;window.__utt=[];let ssKA=null,ssGen=0;
function ssMsg(t){const c=document.getElementById('caption');if(!c)return;c.innerHTML='<b>🔇 '+t+'</b>';c.style.opacity=1;clearTimeout(caption.t);caption.t=setTimeout(()=>c.style.opacity=0,4500);}
function sayNow(t,onend){ // synchronous speak (safe inside a tap handler)
 if(!SS){ssMsg('Voice not supported on this browser');onend&&onend();return null;}
 try{const u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=1.0;u.pitch=1;u.volume=1;if(!NARR.voice)NARR.voice=pickVoice();if(NARR.voice)u.voice=NARR.voice;u.onend=()=>onend&&onend();u.onerror=()=>onend&&onend();window.__utt.push(u);if(window.__utt.length>30)window.__utt.shift();SS.speak(u);return u;}catch(e){onend&&onend();return null;}}
function speak(t,done){if(!NARR.on||!SS){done&&done();return;}const gen=++ssGen;try{SS.cancel();}catch(e){}
 const parts=(t.match(/[^.!?]+[.!?]*/g)||[t]).map(s=>s.trim()).filter(Boolean);let i=0;
 const nx=()=>{if(gen!==ssGen)return;if(i>=parts.length){clearInterval(ssKA);ssKA=null;done&&done();return;}sayNow(parts[i++],nx);};
 clearInterval(ssKA);ssKA=setInterval(()=>{try{if(SS.speaking&&!SS.paused){SS.pause();SS.resume();}}catch(e){}},10000);nx();}
function tcap(title,txt){const c=document.getElementById('caption');if(!c)return;c.classList.add('tourcap');c.innerHTML=`<b>${title}</b><span>${txt}</span>`;c.style.opacity=0;requestAnimationFrame(()=>{c.style.opacity=1;});clearTimeout(caption.t);caption.t=setTimeout(()=>c.style.opacity=0,Math.max(5200,txt.length*60));}
function stopTour(){if(!tour)return;clearTimeout(tour.t);tour.gen++;try{window.speechSynthesis&&speechSynthesis.cancel();}catch(e){}document.getElementById('lblT').checked=tour.lbl;tour=null;const b=document.getElementById('bTour');if(b){b.classList.remove('on');b.textContent='▶ Tour';}const tb=document.getElementById('tourBar');if(tb)tb.style.display='none';const c=document.getElementById('caption');if(c)c.classList.remove('tourcap');}
function stops(){return TOUR.map(([id,t,x])=>({v:VP.find(v=>v.id===id),t,x})).filter(s=>s.v);}
function tourStep(){if(!tour)return;const S=stops(),s=S[tour.i];const gen=++tour.gen;tourGo(s.v);const tb=document.getElementById('tourBar');tb.style.display='flex';document.getElementById('tourTxt').textContent=`Tour ${tour.i+1}/${S.length} · ${s.t}`;
  setTimeout(()=>{if(!tour||tour.gen!==gen)return;tcap(s.t,s.x);let spoke=!NARR.on,dwell=false;const next=()=>{if(!tour||tour.gen!==gen||tour.paused)return;if(spoke&&dwell){tour.i++;if(tour.i>=S.length){stopTour();return;}tourStep();}};tour.next=next;
   speak(s.t+'. '+s.x,()=>{spoke=true;setTimeout(next,700);});tour.t=setTimeout(()=>{dwell=true;next();},Math.max(5500,s.x.length*55));},1600);}
window.toggleTour=function(){if(tour){stopTour();return;}const lt=document.getElementById('lblT');tour={i:0,lbl:lt.checked,gen:0,paused:false};lt.checked=false;const b=document.getElementById('bTour');b.classList.add('on');b.textContent='■ Stop tour';
  if(NARR.on){ssGen++;try{SS&&SS.cancel();}catch(e){}sayNow('Starting the tour.');} // synchronous speak inside the tap unlocks iOS audio
  tourStep();};
window.tourNav=function(d){if(!tour)return;clearTimeout(tour.t);try{window.speechSynthesis&&speechSynthesis.cancel();}catch(e){}const n=stops().length;tour.i=(tour.i+d+n)%n;tour.paused=false;tourStep();};
// ===== tourfix: fit-to-viewport framing, Enter/Go-outside transitions, places bar =====
const TF=(()=>{const V3=THREE.Vector3,B3=THREE.Box3;
 const fB=(re,pad,hgt)=>{const b=new B3();let y0=null;for(const f of window.__furn||[]){if(!re.test(f.name))continue;const c=f.c;b.expandByPoint(new V3(c.x0,c.y0,c.z0));b.expandByPoint(new V3(c.x1,c.y0+1,c.z1));y0=y0===null?c.y0:Math.min(y0,c.y0);}if(b.isEmpty())return null;for(const k of ['x','z']){const w=b.max[k]-b.min[k];if(w<12){b.min[k]-=(12-w)/2;b.max[k]+=(12-w)/2;}}b.min.x-=pad;b.min.z-=pad;b.max.x+=pad;b.max.z+=pad;b.min.y=y0;b.max.y=y0+(hgt||8);return b;};
 const fr=(F,u0,v0,u1,v1,y0,y1)=>{const a=F.P(u0,v0),c=F.P(u1,v1);return new B3(new V3(Math.min(a[0],c[0]),y0,Math.min(a[1],c[1])),new V3(Math.max(a[0],c[0]),y1,Math.max(a[1],c[1])));};
 const pt=(x,y,z,r,h)=>new B3(new V3(x-r,y,z-r),new V3(x+r,y+(h||8),z+r));
 const house=()=>fr(H,0,0,34,32,HL,HM+21).union(fr(G,0,0,24,24,HM,HM+16));
 const lvl={main:()=>fr(H,0,0,34,32,HM,HM+9),lower:()=>fr(H,0,0,34,32,HL,HL+9),loft:()=>fr(H,0,0,34,32,HM+9,HM+17)};
 const gym=()=>fr(GY,0,0,28,30,GYy,GYy+10),barn=()=>fr(PB,0,0,32,38,PBy,PBy+15);
 // camera pose that fits box b (all 8 corners) inside the viewport with ~20% margin, from azimuth az / elevation el
 function fit(b,az,el,fov){fov=fov||50;const c=b.getCenter(new V3()),dir=new V3(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az));
  const cam=new THREE.PerspectiveCamera(fov,camera.aspect||1,0.5,8000);let d=b.getSize(new V3()).length();const P=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])P.push(new V3(x,y,z));
  for(let i=0;i<12;i++){cam.position.copy(c).addScaledVector(dir,d);cam.lookAt(c);cam.updateMatrixWorld();let m=0;for(const p of P){const q=p.clone().applyMatrix4(cam.matrixWorldInverse);if(-q.z<0.5){m=9;break;}const n=q.applyMatrix4(cam.projectionMatrix);m=Math.max(m,Math.abs(n.x),Math.abs(n.y));}d*=Math.max(0.6,Math.min(2.5,1+(m/0.8-1)*0.9));}
  return {pos:cam.position.clone(),t:c,fov};}
 const setL=(lv,roof)=>{const s=(l,v)=>{const e=document.getElementById('lv_'+l);if(e)e.checked=v;};const rt=document.getElementById('roofT');
  if(!lv||lv==='all'){s('lower',true);s('main',true);s('loft',true);}else{s('lower',true);s('main',lv!=='lower');s('loft',lv==='loft');}if(rt)rt.checked=roof!==false;refresh();};
 const azOf=v=>{if(v.orbit){return Math.atan2(v.orbit.pos[0]-v.orbit.t[0],v.orbit.pos[2]-v.orbit.t[2]);}return v.walk.yaw||0;};
 const elOf=v=>{if(!v.orbit)return 0.35;const p=v.orbit.pos,t=v.orbit.t;return Math.atan2(p[1]-t[1],Math.hypot(p[0]-t[0],p[2]-t[2]));};
 const vpT=v=>v.orbit?v.orbit.t:[v.walk.x,(v.walk.feet!==undefined?v.walk.feet:HM)+2,v.walk.z];
 // per-stop subject boxes + view (interiors: high corner cutaway, roof/upper floors hidden)
 const S={
  arrival:{box:()=>house().union(barn()),el:0.42},
  front:{box:house,el:0.38},
  great_room:{box:()=>fB(/Steinway|cigar chair|#4 Tufted|Back bar|Carved dark/,3),lv:'main',el:1.12},
  kitchen:{box:()=>fB(/Kitchen island|Counter stool/,5),lv:'main',el:1.12},
  office:{box:()=>fB(/Glass-top desk|Aeron|futon|Futon/,5),lv:'main',el:1.12},
  tv_room:{box:()=>fB(/sectional|chaise|media console|75″ TV/,2.5),lv:'lower',el:1.12},
  lower_master:{box:v=>{const t=vpT(v);return pt(t[0],HL,t[2],10,8);},lv:'lower',el:1.12},
  loft:{box:()=>fB(/Milan's|Kids desk|Daybed/,2.5),lv:'loft',el:1.12},
  deck:{box:()=>fB(/Teak dining/,7,5),el:0.6},
  pond:{box:v=>{const t=vpT(v);return pt(t[0],t[1]-3,t[2],20,6);},el:0.6},
  big_barn:{box:barn,roof:false,el:0.95},
  gym_beauty:{box:gym,roof:false,el:1.0},
  recovery:{box:()=>fr(GY,0,22,21,30,GYy,GYy+8.5),roof:false,el:0.95},
  firepit:{box:v=>{const t=vpT(v);return pt(t[0],t[1],t[2],10,4);},el:0.6},
  guest_suite:{box:v=>{const t=vpT(v);return pt(t[0],t[1]-4,t[2],16,12);}},
  aerial_p09:{box:()=>house().union(barn()).union(gym()),keepAz:true},
  barns_solar:{keep:true},solar:{keep:true},drone:{keep:true}};
 let cur=null;
 function go(pose,lv,roof,done,dur){setL(lv,roof);flyCam(pose.pos,pose.t,dur||1500,()=>{enterOrbit(pose.t,pose.fov);done&&done();});}
 function stopPose(v){const s=S[v.id];if(!s||s.keep||!v)return null;const b=s.box(v);if(!b)return null;const el=s.el!==undefined?s.el:Math.max(0.3,elOf(v));return {pose:fit(b,azOf(v),el),lv:s.lv||'all',roof:s.roof===undefined?!s.lv:s.roof};}
 function tourGo(v){cur=null;ui();const p=stopPose(v);if(!p){goVP(v);return;}caption(v);go(p.pose,p.lv,p.roof,null,1700);}
 // buildings: door point (just outside), outward azimuth, interior and exterior views
 const BLD={
  house:{door:()=>{const p=H.P(21,32);return new V3(p[0],HM+3.5,p[1]);},az:Math.PI,inside:()=>({pose:fit(lvl.main(),Math.PI*0.8,0.95),lv:'main',roof:false}),outside:()=>({pose:fit(house(),Math.PI*0.85,0.38),lv:'all',roof:true})},
  gym:{door:()=>{const p=GY.P(28,15);return new V3(p[0],GYy+4,p[1]);},az:Math.PI/2,inside:()=>({pose:fit(gym(),Math.PI*0.6,1.0),lv:'all',roof:false}),outside:()=>({pose:fit(gym(),Math.PI*0.62,0.35),lv:'all',roof:true})},
  barn:{door:()=>{const p=PB.P(16,0);return new V3(p[0],PBy+5,p[1]);},az:0,inside:()=>({pose:fit(barn(),0.35,1.0),lv:'all',roof:false}),outside:()=>({pose:fit(barn(),0.3,0.33),lv:'all',roof:true})}};
 function busy(){if(tour)stopTour();}
 function enter(k){busy();const B=BLD[k],d=B.door(),o=new V3(Math.sin(B.az),0,Math.cos(B.az)),I=B.inside();
  const p1=d.clone().addScaledVector(o,9);p1.y+=1;flyCam(p1,d.clone().addScaledVector(o,-6),800,()=>{setL(I.lv,I.roof);flyCam(I.pose.pos,I.pose.t,900,()=>{enterOrbit(I.pose.t,I.pose.fov);cur=k;ui();});});}
 function exit(){const k=cur;if(!k)return;busy();const B=BLD[k],d=B.door(),o=new V3(Math.sin(B.az),0,Math.cos(B.az)),O=B.outside();cur=null;ui();
  const p1=d.clone().addScaledVector(o,-4);flyCam(p1,d.clone().addScaledVector(o,8),700,()=>{setL('all',true);flyCam(O.pose.pos,O.pose.t,900,()=>enterOrbit(O.pose.t,O.pose.fov));});}
 const PL=[['aerial','🛸 Aerial'],['outside','🏡 Outside'],['main','Main floor'],['lower','Lower level'],['loft','Loft'],['gym','🏋 Gym barn'],['barn','🚐 Big barn']];
 function place(k){busy();if(k==='aerial'){cur=null;ui();const v=VP.find(x=>x.id==='drone');setL('all',true);if(v){const T=new V3(...v.orbit.t);flyCam(new V3(...v.orbit.pos),T,1600,()=>enterOrbit(T,v.orbit.fov));}return;}
  if(k==='outside'){cur=null;ui();const O=BLD.house.outside();go(O.pose,'all',true);return;}
  if(k==='gym'||k==='barn'){const I=BLD[k].inside();go(I.pose,I.lv,I.roof,()=>{cur=k;ui();});return;}
  go(fit(lvl[k](),Math.PI*0.8,k==='loft'?1.05:0.95),k,false,()=>{cur='house';ui();});}
 // UI: places bar (collapses to a menu on phones), Enter hotspots, Go-outside button
 const css=document.createElement('style');css.textContent=`#tfBar{position:absolute;bottom:66px;left:50%;transform:translateX(-50%);z-index:40;display:flex;gap:4px;background:rgba(20,24,28,.82);padding:4px;border-radius:10px;font:13px system-ui,sans-serif}
body.clean #tfBar,body.clean .tfHot,body.clean #tfOut{display:none!important}#tfBar button{background:#2b3138;color:#fff;border:0;border-radius:7px;padding:7px 10px;cursor:pointer;white-space:nowrap;touch-action:manipulation}#tfBar button:hover{background:#3d4752}#tfBar #tfTog{display:none}
@media (max-width:700px){#tfBar{flex-direction:column;left:auto;right:8px;transform:none;top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 128px)}#tfBar #tfTog{display:block}#tfBar:not(.open) .tfp{display:none}#tfBar button{padding:10px 12px;font-size:14px}}
.tfHot{position:absolute;z-index:35;transform:translate(-50%,-100%);background:#ffcc33;color:#111;border:2px solid #fff;border-radius:16px;padding:6px 11px;font:bold 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.45);touch-action:manipulation;white-space:nowrap}
.tfHot:after{content:'';position:absolute;left:50%;bottom:-8px;margin-left:-6px;border:6px solid transparent;border-top-color:#fff;border-bottom:0}
#tfOut{position:absolute;z-index:41;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 112px);background:#ffcc33;color:#111;border:2px solid #fff;border-radius:20px;padding:9px 16px;font:bold 14px system-ui,sans-serif;display:none;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5);touch-action:manipulation}`;document.head.appendChild(css);
 const bar=document.createElement('div');bar.id='tfBar';bar.innerHTML='<button id="tfTog">📍 Places</button>'+PL.map(([k,n])=>`<button class="tfp" data-k="${k}">${n}</button>`).join('');const host=document.getElementById('c3d').parentElement;if(getComputedStyle(host).position==='static')host.style.position='relative';host.appendChild(bar);
 bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='tfTog'){bar.classList.toggle('open');return;}bar.classList.remove('open');place(b.dataset.k);});
 const hot={};for(const [k,n] of [['house','🚪 Enter house'],['gym','🚪 Enter gym'],['barn','🚪 Enter big barn']]){const b=document.createElement('button');b.className='tfHot';b.textContent=n;b.style.display='none';b.onclick=e=>{e.stopPropagation();enter(k);};host.appendChild(b);hot[k]=b;}
 const out=document.createElement('button');out.id='tfOut';out.textContent='⬅ Go outside';out.onclick=e=>{e.stopPropagation();exit();};host.appendChild(out);
 function ui(){out.style.display=cur&&!tour?'block':'none';}
 const v=new V3();(function hl(){requestAnimationFrame(hl);const cv=document.getElementById('c3d'),W=cv.clientWidth,Hh=cv.clientHeight,ox=cv.offsetLeft,oy=cv.offsetTop;for(const k in hot){const b=hot[k];if(tour||cur===k||mode==='walk'){b.style.display='none';continue;}const d=BLD[k].door();d.y+=1.5;if(camera.position.distanceTo(d)>420){b.style.display='none';continue;}v.copy(d).project(camera);if(v.z>1||v.z<-1||Math.abs(v.x)>0.95||Math.abs(v.y)>0.95){b.style.display='none';continue;}b.style.display='block';b.style.left=(ox+(v.x+1)/2*W)+'px';b.style.top=(oy+(1-v.y)/2*Hh)+'px';}if(tour&&out.style.display!=='none')ui();})();
 window.__tf={fit,enter,exit,place,tourGo,S,BLD};return {tourGo};})();
function tourGo(v){TF.tourGo(v);}
window.tourPause=function(){if(!tour)return;tour.paused=!tour.paused;const b=document.getElementById('bPause');if(b)b.textContent=tour.paused?'▶ Resume':'⏸ Pause';try{if(window.speechSynthesis){tour.paused?speechSynthesis.pause():speechSynthesis.resume();}}catch(e){}if(!tour.paused&&tour.next){setTimeout(()=>{tour&&tour.next&&tour.next();},300);}};
window.setNarrate=function(on){NARR.on=!!on;const b=document.getElementById('bNarr');if(b){b.classList.toggle('on',NARR.on);b.textContent=NARR.on?'🔊 Narrate: on':'🔈 Narrate: off';}const b2=document.getElementById('bNarr2');if(b2){b2.classList.toggle('on',NARR.on);b2.textContent=NARR.on?'🔊 Narrate':'🔈 Narrate';}if(NARR.on){ssGen++;try{SS&&SS.cancel();}catch(e){}sayNow('Narration on.');}else{ssGen++;clearInterval(ssKA);try{SS&&SS.cancel();}catch(e){}}};
window.__tour={TOUR,NARR,stops};
{const vd=document.getElementById('views');VP.forEach(v=>{const b=document.createElement('button');b.textContent=v.n;b.title=v.cap;b.onclick=()=>{stopTour();goVP(v);document.body.classList.remove('menu');};vd.appendChild(b);});}
const jd=document.getElementById('jumps');J.forEach(([n,f])=>{const b=document.createElement('button');b.textContent=n;if(n.includes('Future'))b.title=FUTNAME;b.onclick=()=>{stopTour();f();};jd.appendChild(b);});

// ================= LEVELS / CUTAWAY / PRESENTATION =================
const levelOf=new Map();
{const bb=new THREE.Box3(),c=new THREE.Vector3();for(const k of ['house','bldg'])for(const o of groups[k].children){if(roofs.includes(o))continue;bb.setFromObject(o);if(bb.isEmpty())continue;bb.getCenter(c);
  if(c.x<H.x0-1||c.x>H.x0+45||c.z>H.z0+1||c.z<H.z0-33)continue;levelOf.set(o,c.y<HM-0.4?'lower':c.y<HM+9.2?'main':'loft');}}
const houseRoofs=roofs.filter(r=>{const b=new THREE.Box3().setFromObject(r),c=b.getCenter(new THREE.Vector3());return c.x>H.x0-3&&c.x<H.x0+37&&c.z<H.z0+3&&c.z>H.z0-35;});
items.forEach(it=>{if(it.pos&&inHouse(it.pos[0],it.pos[2])&&it.pos[1]<HM+24){it.lvl=it.pos[1]<HM-0.5?'lower':it.pos[1]<HM+9.3?'main':'loft';}});
const LVON={lower:true,main:true,loft:true};let occlActive=[];
const visChain=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
window.refresh=function(){document.querySelectorAll('#layers input').forEach(c=>groups[c.dataset.l].visible=c.checked);
  const roofOn=document.getElementById('roofT').checked,x=document.getElementById('xrayT').checked,pres=document.getElementById('presT').checked;
  for(const k in LVON){const el=document.getElementById('lv_'+k);if(el)LVON[k]=el.checked;}
  roofs.forEach(r=>r.visible=roofOn);houseRoofs.forEach(r=>r.visible=roofOn&&LVON.loft);
  levelOf.forEach((l,o)=>o.visible=LVON[l]);
  softMats.forEach(({m,tag})=>{if(tag==='future'||m.userData.keepSoft){return;}m.transparent=!pres;m.opacity=pres?1:0.5;m.depthWrite=pres;m.needsUpdate=true;});
  softLines.forEach(l=>{if(l.userData.soft)l.visible=!pres;});
  extWalls.forEach(m=>{(Array.isArray(m.material)?m.material:[m.material]).forEach(M=>{if(M.userData.o0===undefined)M.userData.o0=M.opacity;M.transparent=x||M.userData.o0<1;M.opacity=x?0.15:M.userData.o0;M.depthWrite=!M.transparent;});});
  terrain.material=document.getElementById('satT').checked?satMat:plainMat;
  const sh=document.getElementById('shT');renderer.shadowMap.enabled=sh?sh.checked:true;sun.castShadow=renderer.shadowMap.enabled;
  const il=document.getElementById('ilT');ilights.forEach(l=>l.visible=il?il.checked:true);
  occlActive=occl.filter(o=>visChain(o)&&!((Array.isArray(o.material)?o.material[0]:o.material).transparent&&(Array.isArray(o.material)?o.material[0]:o.material).opacity<0.9));
  scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(M=>M.needsUpdate=true);});};
window.cutaway=function(which){const set=(l,v)=>{const e=document.getElementById('lv_'+l);if(e)e.checked=v;};
  if(which==='all'){set('lower',1);set('main',1);set('loft',1);document.getElementById('roofT').checked=true;}
  else{document.getElementById('roofT').checked=false;set('loft',which==='loft');set('main',which==='main'||which==='loft');set('lower',true);}
  refresh();if(which!=='all'&&mode!=='walk'){const t=[H.x0+20,which==='lower'?HL:HM,H.z0-16];goOrbit(t,[t[0]+38,t[1]+62,t[2]+48]);}};

// ================= HUD =================
function hud(){const el=document.getElementById('hud');const lv=mode==='walk'?curLevel():null;
  el.innerHTML=mode==='orbit'?'<b>Orbit</b> · drag = rotate · two-finger swipe = pan · pinch = zoom · ⇧+swipe = rotate/tilt · WASD pan · <b>F</b> walk · <b>T</b> tour · <b>H</b> help':
   mode==='walk'?`<b>Walk</b>${lv?' · '+lv+' level':''} · WASD/arrows (⇧ run) · drag = look${document.pointerLockElement?' (mouse locked: Esc)':' · P = mouse-look'} · swipe = move · pinch = zoom · <b>[ ]</b> level · <b>O</b> orbit · <b>H</b> help`:'<b>Flying…</b>';}
function uiMode(){const m=mode==='fly'?(anim&&anim.done&&anim.done.name==='walkDone'?'walk':'orbit'):mode;
  document.getElementById('bOrbit').classList.toggle('on',mode==='orbit');document.getElementById('bWalk').classList.toggle('on',mode==='walk');
  const tb=document.querySelectorAll('[data-mode]');tb.forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
  document.getElementById('pad').style.display=(mode==='walk'||matchMedia('(pointer:coarse)').matches)?'grid':'none';hud();}

// ================= MINIMAP (site / house plan) =================
const mm=document.getElementById('minimap'),mc=mm.getContext('2d'),mimg=new Image();mimg.src=window.SAT_IMG;
let miniMode='auto';window.cycleMini=function(){miniMode=miniMode==='auto'?'site':miniMode==='site'?'plan':'auto';document.getElementById('mmMode').textContent='Map: '+miniMode;};
const PLAN={x0:H.x0-8,x1:H.x0+56,z0:H.z0-60,z1:H.z0+8};
function miniView(){const px=mode==='walk'?player.x:controls.target.x,pz=mode==='walk'?player.z:controls.target.z;
  const plan=miniMode==='plan'||(miniMode==='auto'&&mode==='walk'&&px>PLAN.x0&&px<PLAN.x1&&pz>PLAN.z0&&pz<PLAN.z1);
  return plan?{plan:true,x0:PLAN.x0,z0:PLAN.z0,sx:mm.width/(PLAN.x1-PLAN.x0),sz:mm.height/(PLAN.z1-PLAN.z0)}:{plan:false,x0:-CX,z0:-CY,sx:mm.width/S.bboxW,sz:mm.height/S.bboxH};}
function drawMini(){const w=mm.width,h=mm.height,V=miniView(),X=x=>(x-V.x0)*V.sx,Z=z=>(z-V.z0)*V.sz;
  if(!V.plan){if(mimg.complete)mc.drawImage(mimg,0,0,w,h);mc.strokeStyle='#ffe14a';mc.lineWidth=1.5;mc.beginPath();S.ring.forEach((p,i)=>{const a=X(W(p[0])),b=Z(Zs(p[1]));i?mc.lineTo(a,b):mc.moveTo(a,b);});mc.stroke();
    mc.fillStyle='rgba(255,255,255,.85)';mc.font='9px sans-serif';for(const [t,x,z] of [['House',H.x0+10,H.z0-34],['Barn',PB.x0,PB.z0+14],['Gym',GY.x0,GY.z0+10],['Solar',SOLAR.x-10,SOLAR.z+18]])mc.fillText(t,X(x),Z(z));}
  else{mc.fillStyle='#e9e5dc';mc.fillRect(0,0,w,h);const fy=mode==='walk'?player.feet:HM;
    mc.fillStyle='#d9cdb5';mc.fillRect(X(H.x0),Z(H.z0-32),34*V.sx,32*V.sz);mc.fillStyle='#bfa98a';mc.fillRect(X(H.x0+34),Z(H.z0-32),10*V.sx,32*V.sz);mc.fillStyle='#cfcfcf';mc.fillRect(X(G.x0),Z(G.z0-24),24*V.sx,24*V.sz);
    for(const c of colliders){if(c.y1<fy+0.5||c.y0>fy+5.5)continue;if(c.x1<PLAN.x0||c.x0>PLAN.x1||c.z1<PLAN.z0||c.z0>PLAN.z1)continue;const ww=(c.x1-c.x0),dd=(c.z1-c.z0);mc.fillStyle=(ww<0.7||dd<0.7)?'#333':'rgba(90,80,70,.55)';mc.fillRect(X(c.x0),Z(c.z0),Math.max(1,ww*V.sx),Math.max(1,dd*V.sz));}
    mc.fillStyle='#555';mc.font='bold 9px sans-serif';const lv=fy<HM-1?'LOWER':fy<HM+5?'MAIN':'LOFT';mc.fillText('House plan · '+lv+' level',6,12);}
  const px=mode==='walk'?player.x:controls.target.x,pz=mode==='walk'?player.z:controls.target.z;const dir=new THREE.Vector3();camera.getWorldDirection(dir);const L=Math.hypot(dir.x,dir.z)||1;
  mc.fillStyle='rgba(255,64,64,.25)';mc.beginPath();mc.moveTo(X(px),Z(pz));const a=Math.atan2(dir.z,dir.x);mc.arc(X(px),Z(pz),26,a-0.5,a+0.5);mc.closePath();mc.fill();
  mc.fillStyle='#ff3030';mc.strokeStyle='#fff';mc.lineWidth=1.5;mc.beginPath();mc.arc(X(px),Z(pz),4.5,0,7);mc.fill();mc.stroke();
  document.getElementById('narrow').setAttribute('transform',`rotate(${Math.atan2(dir.x,-dir.z)*-180/Math.PI})`);}
mm.addEventListener('click',e=>{const r=mm.getBoundingClientRect(),V=miniView();const x=(e.clientX-r.left)*(mm.width/r.width)/V.sx+V.x0,z=(e.clientY-r.top)*(mm.height/r.height)/V.sz+V.z0;stopTour();
  if(mode==='walk'){let feet=V.plan&&inHouse(x,z)?(player.feet<HM-1?HL:player.feet<HM+5?HM:HM+9.4):groundAt(x,z,elev(x,z)+1);if(!inHouse(x,z))feet=groundAt(x,z,elev(x,z)+1);goWalk({x,z,feet,yaw:player.yaw,pitch:0},true);}
  else flyTo([x,elev(x,z),z],Math.max(60,camera.position.distanceTo(controls.target)));});

// ================= ON-SCREEN PAD =================
document.querySelectorAll('#pad [data-k]').forEach(b=>{const k=b.dataset.k;const on=e=>{e.preventDefault();keys[k]=true;b.classList.add('on');},off=e=>{keys[k]=false;b.classList.remove('on');};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off);});

// ================= LABELS: distance fade + wall occlusion =================
const lblRay=new THREE.Raycaster();let lblRR=0;
function updateLabels(){const show=document.getElementById('lblT').checked,r=canvas.getBoundingClientRect();const walk=mode==='walk';const lv=walk?curLevel():null;const cand=[];
  for(const it of items){if(!it.el)continue;let vis=show&&groups[it.layer]&&groups[it.layer].visible;
    if(vis&&it.lvl&&!LVON[it.lvl])vis=false;
    let d=0,op=1;if(vis){v3.set(...it.pos);d=camera.position.distanceTo(v3);
      const far=walk?(it.near?28:60):(it.near?80:['house','elec','barn','gym'].includes(it.layer)?240:900);if(d>far)vis=false;else op=Math.min(1,(far-d)/(far*0.35));
      if(walk&&lv&&it.lvl&&it.lvl!==lv)vis=false;if(walk&&!lv&&it.lvl)vis=false;}
    if(vis){v3.project(camera);if(v3.z>1||v3.z<-1||Math.abs(v3.x)>1.02||Math.abs(v3.y)>1.02)vis=false;else{it.el.style.left=((v3.x+1)/2*r.width)+'px';it.el.style.top=((1-v3.y)/2*r.height)+'px';cand.push(it);}}
    it._vis=vis;it._op=op;it._d=d;}
  // occlusion: re-check a slice of candidates each frame
  const n=Math.min(cand.length,40);for(let k=0;k<n;k++){const it=cand[(lblRR+k)%cand.length];const t=new THREE.Vector3(...it.pos);const dir=t.clone().sub(camera.position);const D=dir.length();
    lblRay.set(camera.position,dir.normalize());lblRay.near=0;lblRay.far=Math.max(0,D-1.2);it._occ=lblRay.intersectObjects(occlActive,false).length>0;}
  lblRR+=n;
  // priority + screen-space collision avoidance; cap 8 in orbit, 12 in walk
  cand.sort((a,b)=>(b.pri-a.pri)||(a._d-b._d));const placed=[];const cap=walk?12:8;
  for(const it of cand){if(!it._vis||it._occ)continue;if(placed.length>=cap){it._vis=false;continue;}const x=parseFloat(it.el.style.left),y=parseFloat(it.el.style.top);const w=it.el.textContent.length*6.2+14,h=19;const R={x0:x-w/2,x1:x+w/2,y0:y-h,y1:y};
    if(placed.some(q=>R.x0<q.x1+4&&R.x1>q.x0-4&&R.y0<q.y1+2&&R.y1>q.y0-2)){it._vis=false;continue;}placed.push(R);}
  for(const it of items){if(!it.el)continue;const v=it._vis&&!it._occ;it.el.style.display=v?'block':'none';if(v)it.el.style.opacity=Math.max(0.25,it._op).toFixed(2);}}

pickables.forEach(o=>{const it=o.userData.item;if(it&&/^Sauna 6|Bathroom \/ shower spot/.test(it.name)&&o.material){o.material.userData.keepSoft=true;o.material.transparent=true;o.material.opacity=0.28;o.material.depthWrite=false;}});
// ================= GYM + RECOVERY DETAIL (v6) =================
{const F=GY,Y=GYy,g=groups.gym;const QUALITY_HINT=()=>{try{return new URLSearchParams(location.search).get('clean')==='1'||(localStorage.getItem('samelsQ')||((matchMedia('(pointer:coarse)').matches||innerWidth<900)?'low':'high'))!=='low';}catch(e){return true;}};const hideRe=/owned – Seabreeze rack|Bike storage wall|Gymnastics rings|Climbing rope|GHD \(proposed|Sled \(proposed|Free-standing pull-up rig|Barbell tree|Bumper plates|DB\/KB 3-tier|Xebex curved|Peloton bike|EnergyFit rower|Assault \/ Echo|Wall balls \(|Kettlebell set|#1 Seabreeze massage|Cold plunge tub|Sauna 6|Rubber gym flooring/;
 const hidden=[];g.traverse(o=>{const it=o.userData&&o.userData.item;if(o.isMesh&&it&&hideRe.test(it.name)){hidden.push([o,it]);}});
 hidden.forEach(([o])=>{o.layers.set(1);o.userData.noMerge=true;o.children.forEach(c=>c.visible=false);});
 {const B=F.P(13,27.6),B2=F.P(16.6,29);const inR=(o)=>{const x=o.position.x,z=o.position.z;return x>Math.min(B[0],B2[0])-0.6&&x<Math.max(B[0],B2[0])+0.6&&z>Math.min(B[1],B2[1])-0.8&&z<Math.max(B[1],B2[1])+0.8;};
  g.children.slice(window.__gymLeg0||0,window.__gymLeg1||0).forEach(o=>{if(!o.isMesh||(o.userData&&o.userData.item))return;const gp=o.geometry.parameters||{};const t=o.geometry.type;
   if(t!=='BoxGeometry'||gp.height<0.3||Math.min(gp.width,gp.depth)<0.1||(o.material&&o.material.transparent)||inR(o)||(gp.height>=5.5&&gp.height<6.5&&gp.depth>4))o.visible=false;});
  for(let i=colliders.length-1;i>=0;i--){const c=colliders[i];if(Math.abs(c.x0-Math.min(B[0],B2[0]))<0.05&&Math.abs(c.z0-Math.min(B[1],B2[1]))<0.05)colliders.splice(i,1);}}
 const itOf=re=>{const h=hidden.find(([o,it])=>re.test(it.name));return h?h[1]:null;};
 const cv=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
 const L=c=>new THREE.MeshLambertMaterial({color:c}),Ph=(c,s,sp)=>new THREE.MeshPhongMaterial({color:c,shininess:s||60,specular:sp||0x444444});
 const STEEL=Ph(0x1d1f22,40,0x333333),CHR=Ph(0xd8dde2,140,0xffffff),RED=Ph(0xb3261e,30),RUB=L(0x151515);
 const add=(m,it,pick)=>{m.castShadow=m.receiveShadow=true;g.add(m);if(it){m.userData.item=it;if(pick)pickables.push(m);}return m;};
 const Bx=(u0,v0,u1,v1,y0,h,M,it)=>{const [x,z]=F.P((u0+u1)/2,(v0+v1)/2);const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.02,Math.abs(u1-u0)),h,Math.max(.02,Math.abs(v1-v0))),M);m.position.set(x,Y+y0+h/2,z);return add(m,it,true);};
 // axis: 'y' vertical, 'u' east-west, 'v' north-south. (u,v,y)=center
 const Cy=(u,v,y,r,h,M,ax,r2,seg,it)=>{const [x,z]=F.P(u,v);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r2===undefined?r:r2,h,seg||20),M);m.position.set(x,Y+y,z);if(ax==='u')m.rotation.z=Math.PI/2;if(ax==='v')m.rotation.x=Math.PI/2;return add(m,it,true);};
 // ---- rubber floor (whole room) with speckle, + 8x4 lifting platform
 const rubT=cv(256,256,(c,w,h)=>{c.fillStyle='#1a1a1b';c.fillRect(0,0,w,h);for(let i=0;i<5000;i++){c.fillStyle=['#2a2a2c','#3a3a3d','#101010','#4a4a4a'][i%4];c.fillRect(Math.random()*w,Math.random()*h,1.4,1.4);}c.strokeStyle='#0a0a0a';c.lineWidth=2;c.strokeRect(0,0,w,h);});rubT.repeat.set(7,7.5);rubT.__pbr='rubber';
 const fl=Bx(0.05,0.05,27.95,29.95,0.02,0.06,new THREE.MeshLambertMaterial({map:rubT}),itOf(/Rubber gym flooring/));fl.castShadow=false;
 const oakT=cv(256,64,(c,w,h)=>{c.fillStyle='#b98a55';c.fillRect(0,0,w,h);for(let i=0;i<60;i++){c.strokeStyle='rgba(90,55,25,'+(0.15+Math.random()*0.25)+')';c.beginPath();const y=Math.random()*h;c.moveTo(0,y);c.bezierCurveTo(w/3,y+Math.random()*6-3,2*w/3,y+Math.random()*6-3,w,y);c.stroke();}for(let x=0;x<w;x+=64){c.fillStyle='#7a5a35';c.fillRect(x,0,1,h);} });
 const pit=info('Lifting platform 8 × 4 ft (proposed new)','pnew','3/4 in rubber drop zones each side, oak center strip; in front of the rig so the barbell can be dropped. ~$400–900 DIY.',null,{gym:true,near:true});
 Bx(12,7.4,20,11.6,0.08,0.12,RUB,pit);Bx(14.2,7.45,17.8,11.55,0.08,0.13,new THREE.MeshLambertMaterial({map:oakT}),pit);
 // ---- CENTER RIG: freestanding 16 × 6 ft, 4 bays, 9 ft tall (uprights u7–23, v12–18); pull-up bars at 7.5/8/8.5/9 ft, kip bar, high + low rings, rope, J-cups, spotters
 const rig=itOf(/Free-standing pull-up rig/);if(rig){rig.name='Center rig — freestanding 4-bay, 16 × 6 × 9 ft (proposed new)';rig.text='Freestanding 3×3 in 11-ga rig (Rogue Monster-Lite / Titan X-3 style), 4 bays of 4 ft: pull-up bars at 7.5, 8, 8.5 and 9 ft on the north side, 8.5 ft fat bars on the south side, a 2.5 ft kip-bar extension at the east end, high rings (bay 1), low rings at ~3 ft for ring rows/dips (bay 3), a climbing-rope beam (bay 4), J-cups and spotter arms on bays 2–3 in front of the platform. The truss height (~10 ft eave) is estimated: verify before ordering 9 ft uprights. Rough cost (not price-checked): a 4-bay freestanding rig ~$3–6K (Rogue Monster Lite / Titan X-3 class), plus ~$150–300 for rings and rope.';}
 const US=[7,11,15,19,23];
 for(const u of US)for(const v of [12,18]){Bx(u-0.125,v-0.125,u+0.125,v+0.125,0,9,STEEL,rig);Bx(u-0.15,v-0.55,u+0.15,v+0.55,0,0.12,STEEL,rig);}
 for(const v of [12,18])Bx(7,v-0.12,23,v+0.12,8.75,0.25,STEEL,rig);for(const u of US)Bx(u-0.12,12,u+0.12,18,8.75,0.25,STEEL,rig);
 for(let i=0;i<4;i++){const u0=US[i],u1=US[i+1],uc=(u0+u1)/2;Cy(uc,11.55,8.3,0.06,4,CHR,'u',undefined,12,rig);Cy(uc,18.45,[7.5,8,8.5,9][i]-0.15,0.05,4,CHR,'u',undefined,12,rig);
  for(const u of [u0,u1])Bx(u-0.08,18.12,u+0.08,18.5,[7.5,8,8.5,9][i]-0.3,0.3,STEEL,rig);Bx(u0,11.4,u1,11.6,8.25,0.1,STEEL,rig);}
 // kip bar: east cantilever from the u23 uprights at 8 ft
 for(const v of [12,18])Bx(23,v-0.1,25.5,v+0.1,8.6,0.2,STEEL,rig);Bx(25.3,12,25.5,18,8.6,0.2,STEEL,rig);Cy(25.4,15,8.0,0.05,6,CHR,'v',undefined,12,rig);for(const v of [12.2,17.8])Bx(25.3,v-0.06,25.5,v+0.06,8.0,0.7,STEEL,rig);
 // rings: high (bay 1) and low (bay 3), straps from the top beam
 const ring=(u,v,y)=>{const [x,z]=F.P(u,v);const r=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.06,8,20),Ph(0xc8a060,30));r.position.set(x,Y+y,z);add(r,rig,true);const st=new THREE.Mesh(new THREE.BoxGeometry(0.06,9-y-0.3,0.12),Ph(0x111111,10));st.position.set(x,Y+y+0.36+(9-y-0.3)/2,z);add(st,rig);};
 for(const du of [-0.9,0.9]){ring(9+du,15,6.6);ring(17+du,15,3.0);}
 {const [x,z]=F.P(21,15);const rp=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,8.6,10),Ph(0xc8a060,10));rp.position.set(x,Y+4.6,z);add(rp,rig,true);}
 // J-cups + spotter arms on the south uprights of bays 2-3 (u11, u15, u19)
 for(const u of [11,15,19]){Bx(u-0.1,11.65,u+0.1,11.88,4.4,0.35,RED,rig);Bx(u-0.07,10.2,u+0.07,11.88,2.6,0.18,STEEL,rig);}
 Bx(14.2,11.86,15.8,11.9,7.6,0.7,RED,rig);
 // loaded barbell on the J-cups of bay 2 (u11–15), 45 lb bumpers
 const bb=info('Olympic barbell + bumper plates on the J-cups','own','Owned bars (#27) and colored bumpers (#28); 45 lb blue plates shown. 7.2 ft bar.',null,{gym:true,near:true});
 Cy(13,11.75,4.85,0.05,7.2,CHR,'u',undefined,12,bb);for(const s of [-1,1]){for(const d of [2.75,2.95])Cy(13+s*d,11.75,4.85,0.74,0.22,Ph(0x1f4fa8,20),'u',undefined,28,bb);Cy(13+s*3.15,11.75,4.85,0.1,0.15,CHR,'u',undefined,12,bb);}
 // ---- Seabreeze wall rack (owned #22) as a real half-rack frame, west wall
 {const sr=itOf(/Seabreeze rack/);for(const [u,v] of [[0.4,10.3],[0.4,13.7],[3.4,10.3],[3.4,13.7]])Bx(u-0.12,v-0.12,u+0.12,v+0.12,0,7.5,STEEL,sr);for(const v of [10.3,13.7])Bx(0.4,v-0.1,3.4,v+0.1,7.3,0.2,STEEL,sr);Cy(3.4,12,7.0,0.05,3.8,CHR,'v',undefined,10,sr);for(const v of [10.3,13.7]){Bx(3.3,v-0.08,3.7,v+0.08,4.4,0.3,RED,sr);Bx(3.4,v-0.06,5.2,v+0.06,2.4,0.15,STEEL,sr);}}
 // ---- bike wall: 2 bikes on vertical hooks + eBike on the floor (owned #37-#39)
 {const bw=itOf(/Bike storage wall/);const wheel=(u,v,y,ax)=>{const [x,z]=F.P(u,v);const w=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.09,8,24),Ph(0x111111,20));w.position.set(x,Y+y,z);if(ax==='v')w.rotation.y=Math.PI/2;add(w,bw,true);};
  Bx(9,0,15,0.25,0.4,7,L(0x8c6a45),bw);for(const u of [10,13]){wheel(u,0.9,5.6,'v');wheel(u,0.9,2.0,'v');Bx(u-0.05,0.75,u+0.05,1.05,2.0,3.6,Ph(0x2f5d8a,60),bw);Bx(u-0.04,0.2,u+0.04,0.9,6.6,0.08,STEEL,bw);}
  wheel(17.4,1.1,1.2,'u');wheel(21.6,1.1,1.2,'u');Bx(17.6,0.95,21.4,1.25,1.2,0.35,Ph(0x1c3c2c,60),bw);Bx(18.8,0.9,20.2,1.3,1.4,0.6,Ph(0x222222,30),bw);Bx(19.0,0.95,19.3,1.25,1.5,1.6,Ph(0x1c3c2c,60),bw);Bx(18.6,0.95,19.5,1.25,3.05,0.15,Ph(0x111111,20),bw);Bx(21.0,0.95,21.2,1.25,1.4,2.4,Ph(0x1c3c2c,60),bw);Bx(20.6,0.5,21.6,1.7,3.75,0.08,STEEL,bw);}
 // ---- barbell tree (3 bars vertical) and bumper toast rack
 const bt=itOf(/Barbell tree/);Bx(0.6,15.8,2,17.2,0,0.15,STEEL,bt);Bx(1.2,16.4,1.4,16.6,0,1.2,STEEL,bt);
 [[0.9,16.1,CHR],[1.7,16.1,Ph(0x111111,40)],[1.3,16.9,CHR]].forEach(([u,v,M])=>{Cy(u,v,3.75,0.05,7.2,M,'y',undefined,10,bt);Cy(u,v,0.9,0.1,1.6,M,'y',undefined,10,bt);});
 const pr=itOf(/Bumper plates/);Bx(0.4,18.6,3.2,20.4,0,0.2,STEEL,pr);for(const v of [18.7,20.3])Bx(0.5,v-0.05,3.1,v+0.05,0,1.2,STEEL,pr);
 [[0.75,0xb3261e,0.74],[0.95,0xb3261e,0.74],[1.3,0x1f4fa8,0.74],[1.5,0x1f4fa8,0.74],[1.85,0xd9b21c,0.74],[2.05,0xd9b21c,0.74],[2.4,0x2e7d32,0.74],[2.6,0x2e7d32,0.74],[2.9,0x111111,0.74]].forEach(([u,c,r])=>Cy(u,19.5,r+0.2,r,0.22,Ph(c,15),'u',undefined,28,pr));
 // ---- DB / KB 3-tier rack against the south wall
 const db=itOf(/DB\/KB 3-tier/);for(const u of [23.6,27.4])Bx(u-0.1,0.3,u+0.1,1.6,0,3.4,STEEL,db);
 for(const [y,dv] of [[1.0,1.3],[2.0,0.95],[3.0,0.6]])Bx(23.5,0.3,27.5,0.3+dv+0.2,y,0.08,STEEL,db);
 {const hx=new THREE.CylinderGeometry(0.22,0.22,0.22,6);hx.rotateZ(Math.PI/2);const hm=new THREE.InstancedMesh(hx,L(0x161616),20),hd=new THREE.Object3D();let k=0;
  for(let i=0;i<5;i++)for(const s of [-1,1]){const u=24+i*0.75,v=0.9;const [x,z]=F.P(u+s*0.25,v);hd.position.set(x,Y+1.33,z);hd.updateMatrix();hm.setMatrixAt(k++,hd.matrix);const [x2,z2]=F.P(u+s*0.25,0.65);hd.position.set(x2,Y+2.3,z2);hd.updateMatrix();hm.setMatrixAt(k++,hd.matrix);}
  hm.castShadow=true;g.add(hm);for(let i=0;i<5;i++)for(const vv of [0.9,0.65])Cy(24+i*0.75,vv,vv>0.8?1.33:2.3,0.06,0.3,CHR,'u',undefined,8,db);}
 // kettlebells on the top shelf + floor
 const kb=(u,v,y,r,c,it)=>{const [x,z]=F.P(u,v);const b=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),Ph(c,25));b.position.set(x,Y+y+r*0.9,z);b.scale.y=0.92;add(b,it,true);const h=new THREE.Mesh(new THREE.TorusGeometry(r*0.6,r*0.13,8,16,Math.PI),Ph(c,25));h.position.set(x,Y+y+r*1.7,z);add(h,it);};
 [[23.9,0.55,0.32],[24.6,0.55,0.34],[25.3,0.55,0.36],[26,0.55,0.38],[26.7,0.55,0.4],[27.2,0.55,0.3]].forEach(([u,v,r])=>kb(u,v,3.08,r*0.7,0x1b1b1b,db));
 const kit=itOf(/Kettlebell set/);[[4.8,16.7,0.42,0x8a1c1c],[5.5,16.7,0.46,0x1f4fa8],[6.3,16.7,0.5,0xd9b21c],[5.1,17.3,0.38,0x2e7d32],[6,17.3,0.42,0x5b2a86]].forEach(([u,v,r,c])=>kb(u,v,0.06,r*0.75,c,kit));
 // wall balls
 const wb=itOf(/Wall balls \(/);[[1.5,21.6],[2.5,21.6],[1.5,22.6],[2.5,22.6]].forEach(([u,v],i)=>{const [x,z]=F.P(u,v);const s=new THREE.Mesh(new THREE.SphereGeometry(0.58,18,14),Ph(i%2?0x2a2a2a:0x3a3f46,10));s.position.set(x,Y+0.62,z);add(s,wb,true);});
 {const [x,z]=F.P(2,22.1);const s=new THREE.Mesh(new THREE.SphereGeometry(0.58,18,14),Ph(0x8a1c1c,10));s.position.set(x,Y+1.75,z);add(s,wb);}
 // ---- Concept2-style rower + SkiErg (owned combo) along the east wall
 const rw=itOf(/EnergyFit rower/),BLK=Ph(0x141414,50);Bx(26.7,2.6,27.1,9.2,0.35,0.18,Ph(0x9aa3ab,90),rw);Bx(26.6,2.6,27.2,3,0,0.5,BLK,rw);Bx(26.55,6.6,27.25,7.2,0,0.4,BLK,rw);
 Cy(26.9,8.6,1.15,0.85,0.55,BLK,'u',undefined,28,rw);Bx(26.4,8.5,27.4,9.2,0,1,BLK,rw);Bx(26.55,4.6,27.25,5.6,0.55,0.25,Ph(0x222222,10),rw);Bx(26.8,7.8,27,8,1.2,1.6,BLK,rw);Bx(26.6,7.7,27.2,7.9,2.7,0.5,Ph(0x333a40,80),rw);
 for(const u of [26.5,27.3])Bx(u-0.1,7.4,u+0.1,7.7,0.3,0.12,BLK,rw);
 Bx(26.6,9.5,27.6,10.4,0,0.15,BLK,rw);Bx(27.0,9.8,27.4,10.2,0.15,6.9,BLK,rw);Cy(27.2,9.6,5.6,0.7,0.3,BLK,'u',undefined,24,rw);Bx(26.9,9.5,27.5,9.7,4.2,0.6,Ph(0x333a40,80),rw);
 for(const du of [-0.25,0.25])Bx(26.95+du,9.4,27.05+du,9.5,5.2,1.1,Ph(0x111111,10),rw);
 // ---- Assault / Echo air bike
 const ab=itOf(/Assault \/ Echo/);{Cy(26.2,28.6,1.75,1.35,0.9,Ph(0x1a1a1a,30),'u',undefined,32,ab);Cy(26.2,28.6,1.75,1.2,0.95,Ph(0xb3261e,20),'u',undefined,32,ab);
  Bx(25.9,25.9,26.5,28.6,0.1,0.25,BLK,ab);Bx(26.05,26.3,26.35,26.6,0.3,2.9,BLK,ab);Bx(25.7,26.1,26.7,26.8,3.1,0.25,Ph(0x111111,10),ab);
  for(const s of [-1,1]){Bx(26.2+s*0.5-0.05,27.4,26.2+s*0.5+0.05,27.6,1.2,3.6,BLK,ab);}Bx(25.95,27.3,26.45,27.6,4.1,0.4,Ph(0x333a40,80),ab);}
 // ---- Peloton
 const pe=itOf(/Peloton bike/);{Bx(22.6,25.6,24.4,29.4,0.06,0.06,RUB,pe);Bx(23.3,25.9,23.7,29.1,0.12,0.18,BLK,pe);
  const [x,z]=F.P(23.5,27.3);const f=new THREE.Mesh(new THREE.BoxGeometry(0.22,3.4,0.22),BLK);f.position.set(x,Y+1.9,z);f.rotation.x=0.35;add(f,pe,true);
  Cy(23.5,28.6,1.25,0.9,0.28,Ph(0x2a2a2a,90),'u',undefined,32,pe);Bx(23.25,26.2,23.75,27.1,3.3,0.25,Ph(0x111111,10),pe);Bx(23.45,28.6,23.55,29.1,1.6,2.8,BLK,pe);Bx(23,28.9,24,29.2,4.2,0.12,BLK,pe);Bx(23.05,29.15,23.95,29.25,4.3,1.3,new THREE.MeshBasicMaterial({color:0x1d2a3a}),pe);Bx(23.2,26.1,23.8,26.3,0.3,0.25,Ph(0xb3261e,30),pe);}
 // ---- Xebex curved manual treadmill
 const tm=itOf(/Xebex curved/);{for(const v of [26.6,29.4])Bx(16.2,v-0.12,21.8,v+0.12,0.1,1.3,BLK,tm);
  const sl=new THREE.InstancedMesh(new THREE.BoxGeometry(0.16,0.08,2.5),Ph(0x111111,15),34),d=new THREE.Object3D();for(let i=0;i<34;i++){const t=i/33,u=16.5+t*5,yy=0.55+0.55*Math.pow((t-0.5)*2,2);const [x,z]=F.P(u,28);d.position.set(x,Y+yy,z);d.rotation.set(0,0,Math.atan(2.2*(t-0.5)*2/5));d.updateMatrix();sl.setMatrixAt(i,d.matrix);}sl.castShadow=true;g.add(sl);
  for(const v of [26.65,29.35]){Bx(21.4,v-0.06,21.55,v+0.06,1.3,2.8,BLK,tm);Bx(18.5,v-0.06,21.55,v+0.06,3.9,0.12,BLK,tm);}Bx(21.3,26.7,21.6,29.3,3.9,0.12,BLK,tm);Bx(21.3,27.4,21.6,28.6,4.0,0.7,Ph(0x333a40,80),tm);}
 // ---- massage chair (Seabreeze #1): reclined-ready, black leather, faces south
 const mc=itOf(/#1 Seabreeze massage/),LEA=Ph(0x262220,35,0x2a2a2a);{const u0=13.6,u1=16.3;Bx(u0+0.2,24,u1-0.2,28.8,0,0.5,Ph(0x1a1a1a,40),mc);Bx(u0+0.3,25.2,u1-0.3,27.9,0.5,1.3,LEA,mc);
  const [x,z]=F.P((u0+u1)/2,28.4);const bk=new THREE.Mesh(new THREE.BoxGeometry(u1-u0-0.6,3.4,0.9),LEA);bk.position.set(x,Y+3.1,z);bk.rotation.x=-0.3;add(bk,mc,true);
  const hd2=new THREE.Mesh(new THREE.BoxGeometry(u1-u0-0.9,0.9,0.6),Ph(0x3a3532,30));hd2.position.set(x,Y+4.7,F.P(0,28.85)[1]);add(hd2,mc);
  for(const u of [u0,u1-0.55])Bx(u,25.4,u+0.55,28.6,0.5,2.2,Ph(0x1e1b19,40),mc);for(const u of [u0+0.12,u1-0.2])Bx(u,25.6,u+0.08,27.6,2.7,0.04,Ph(0x55595e,120),mc);
  const [x3,z3]=F.P((u0+u1)/2,24.5);const lg=new THREE.Mesh(new THREE.BoxGeometry(u1-u0-0.9,0.6,1.9),LEA);lg.position.set(x3,Y+1.2,z3);lg.rotation.x=-0.9;add(lg,mc,true);}
 // ---- The Plunge (owned, #36): 66-5/8 × 31-1/2 × 26 in white acrylic tub + chiller
 const pl=itOf(/Cold plunge tub/);if(pl){pl.name='The Plunge cold plunge (owned #36) — 66⅝ × 31½ × 26 in';pl.text='Plunge brand "The Plunge": white acrylic/fiberglass lay-down tub, 66⅝ in L × 31½ in W × 26 in H (plunge.com specs), 105 gal, ~1,020 lb filled; chiller to 37–39°F (Clark plunges at 39°F). Chiller unit size estimated (~20 × 14 × 18 in). Dedicated 120 V/15 A GFCI circuit. Sits on the rubber floor beside the sauna in the recovery corner.';}
 {const u0=7,u1=12.55,v0=27.3,v1=29.92,H2=26/12,WH=Ph(0xf4f5f3,90,0x888888);Bx(u0,v0,u1,v0+0.12,0,H2,WH,pl);Bx(u0,v1-0.12,u1,v1,0,H2,WH,pl);Bx(u0,v0,u0+0.12,v1,0,H2,WH,pl);Bx(u1-0.12,v0,u1,v1,0,H2,WH,pl);
  Bx(u0+0.12,v0+0.12,u1-0.12,v1-0.12,0,0.35,WH,pl);Bx(u0-0.04,v0-0.04,u1+0.04,v0+0.06,H2,0.05,WH,pl);Bx(u0-0.04,v1-0.06,u1+0.04,v1+0.04,H2,0.05,WH,pl);
  const wt=new THREE.MeshPhongMaterial({color:0x6fb7c9,shininess:160,specular:0xffffff,transparent:true,opacity:0.82});Bx(u0+0.12,v0+0.12,u1-0.12,v1-0.12,0.35,H2-0.6,wt,pl);
  const ch=info('Plunge chiller unit (estimated size)','own','Chiller/filtration box beside the tub (size estimated ~20 × 14 × 18 in; check the actual unit). App display set to 39°F.',null,{gym:true,near:true});
  Bx(7.05,25.9,8.75,27.1,0,1.5,WH,ch);for(let i=0;i<6;i++)Bx(7.15+i*0.26,25.88,7.3+i*0.26,25.9,0.4,0.8,Ph(0x999999,20),ch);Bx(7.6,25.86,8.2,25.88,1.15,0.2,new THREE.MeshBasicMaterial({color:0x40c8ff}),ch);
  Bx(9.5,26.4,11.5,27.1,0,0.08,Ph(0xdddddd,10),null);} // step mat
 const cedT=cv(128,256,(c,w,h)=>{for(let x=0;x<w;x+=16){const t=Math.random()*25;c.fillStyle=`rgb(${176+t},${118+t*0.6},${72+t*0.3})`;c.fillRect(x,0,16,h);c.fillStyle='rgba(80,45,20,.5)';c.fillRect(x,0,1.5,h);for(let k=0;k<6;k++){c.strokeStyle='rgba(120,70,35,.25)';c.beginPath();const xx=x+Math.random()*16;c.moveTo(xx,0);c.lineTo(xx+Math.random()*3,h);c.stroke();}}});
 const cedT_=()=>cedT;
 // ---- Plunge "The Sauna" Standard: H 7'11" × W 5'8" × D 5'11", cedar, glass front (east), HUUM heater
 const si=itOf(/Sauna 6/);if(si){si.name='Plunge "The Sauna" — Standard (optional, proposed)';si.tag='pnew';si.text='Plunge The Sauna, Standard: H 7 ft 11 in × W 5 ft 8 in × D 5 ft 11 in, cedar, full-glass front, HUUM electric heater, flip-up benches. $12,990 list ($11,040 fall sale) per plunge.com/products/the-sauna. Needs a dedicated 240 V 30 A circuit (NEMA L14-30). Foundation rated for ~1,400 lb (4 in concrete slab is fine). Gym eave ~10 ft (estimated) clears the 7 ft 11 in height. XL (W 7 ft 8 in, 240 V 50 A, NEMA 14-50) also fits if the plunge shifts east. Option B: outdoors on a pad beside the north wall.';}
 {const u0=0.12,u1=0.12+5.92,v0=29.9-5.67,v1=29.9,SH2=95/12;
  const CED=new THREE.MeshLambertMaterial({map:cedT}),CD2=L(0x8a5a35);Bx(u0,v1-0.3,u1,v1,0,SH2,CED,si);Bx(u0,v0,u0+0.3,v1,0,SH2,CED,si);Bx(u0,v0,u1,v0+0.3,0,SH2,CED,si);Bx(u0-0.1,v0-0.1,u1+0.1,v1+0.05,SH2-0.35,0.35,CD2,si);
  const gl=new THREE.MeshPhongMaterial({color:0x31403f,transparent:true,opacity:0.2,shininess:220,specular:0xffffff,depthWrite:false,side:THREE.DoubleSide});gl.userData.keepSoft=true;const gm=Bx(u1-0.05,v0+0.36,u1-0.01,v1-0.36,0.12,SH2-0.35-0.22,gl,si);if(gm){gm.renderOrder=20;gm.castShadow=false;gm.userData.noMerge=true;gm.userData.sauna='glass';}const BLK=new THREE.MeshLambertMaterial({color:0x0c0c0c});
  for(const v of [v0+0.3,v1-0.3])Bx(u1-0.12,v-0.06,u1+0.02,v+0.06,0,SH2-0.35,BLK,si);Bx(u1-0.12,v0+0.3,u1+0.02,v1-0.3,0,0.12,BLK,si);Bx(u1-0.12,v0+0.3,u1+0.02,v1-0.3,SH2-0.47,0.12,BLK,si);Bx(u1-0.12,v0+2.25,u1+0.02,v0+2.33,0.12,SH2-0.59,BLK,si);Bx(u1+0.01,v0+2.0,u1+0.09,v0+2.08,3,1.8,BLK,si);
  Bx(u0+0.3,v1-2.0,u1-1.0,v1-0.3,1.6,0.15,CED,si);Bx(u0+0.3,v0+0.3,u0+2.0,v1-2.0,3.0,0.15,CED,si);Bx(u0+0.3,v1-1.9,u1-1.0,v1-0.3,3.0,0.15,CED,si);
  Cy(u1-0.9,v0+0.9,1.3,0.55,2.4,Ph(0x1a1a1a,60),'y',0.6,24,si);for(let i=0;i<14;i++){const a=i*2.4,r=0.12+(i%4)*0.1;const [x,z]=F.P(u1-0.9+Math.cos(a)*r,v0+0.9+Math.sin(a)*r);const s=new THREE.Mesh(new THREE.DodecahedronGeometry(0.13),L(0x6b6b68));s.position.set(x,Y+2.5+(i%3)*0.08,z);add(s);}
  const lw=new THREE.MeshBasicMaterial({color:0xffb36b});Bx(u0+0.35,v1-0.34,u1-0.4,v1-0.31,1.45,0.05,lw);Bx(u0+0.35,v1-0.34,u1-0.4,v1-0.31,2.85,0.05,lw);
  if(QUALITY_HINT()){const pl2=new THREE.PointLight(0xffa860,0.6,10,2);const [x,z]=F.P(2.5,27.5);pl2.position.set(x,Y+5,z);g.add(pl2);}}
 // ---- cedar slat accent wall (north wall, recovery side) + LED cove
 const sw=info('Cedar slat accent wall + LED cove (proposed)','prop','Vertical 1×2 cedar slats on black felt behind the plunge and massage chair, warm 2700 K LED strip at the top. ~$1.2–2K DIY.',null,{gym:true,near:true});
 {Bx(6.2,29.88,20.4,29.92,0,9.2,L(0x151515),sw);const sl=new THREE.InstancedMesh(new THREE.BoxGeometry(0.11,9.1,0.09),new THREE.MeshLambertMaterial({map:cedT_()}),56),d=new THREE.Object3D();for(let i=0;i<56;i++){const [x,z]=F.P(6.3+i*0.255,29.82);d.position.set(x,Y+4.6,z);d.updateMatrix();sl.setMatrixAt(i,d.matrix);}g.add(sl);Bx(6.2,29.6,20.4,29.9,9.25,0.08,new THREE.MeshBasicMaterial({color:0xffc27a}),sw);}
 // ---- mirror wall (west wall, behind the bar/plate area) 9 ft wide × 6.5 ft
 const mi=info('Gym mirror wall (proposed new)','pnew','Three 36 × 78 in shatter-resistant gym mirrors on the west wall (form checks for the barbell and wall-ball area). ~$600–900.',null,{gym:true,near:true});
 {const mm=new THREE.MeshPhongMaterial({color:0xb9c6cc,shininess:250,specular:0xffffff,envMap:null});Bx(0.05,14.6,0.12,23.6,1,6.5,mm,mi);for(const v of [14.6,17.6,20.6,23.6])Bx(0.05,v-0.04,0.16,v+0.04,1,6.5,STEEL,mi);}
 // ---- workout TV (65 in) on the south wall above the eBike
 const tv=info('65 in workout TV (proposed new)','pnew','Wall-mounted over the eBike, visible from the rig, Peloton and rower. Streams WODs / timers. ~$600–900.',null,{gym:true,near:true});
 Bx(16.8,0.05,22.2,0.2,5.2,3.1,Ph(0x050505,120,0x666666),tv);Bx(17.0,0.2,22.0,0.21,5.35,2.8,new THREE.MeshBasicMaterial({color:0x22324a}),tv);
 Bx(14.6,0.05,16.4,0.12,6.0,1.4,new THREE.MeshBasicMaterial({color:0x111111}),tv);Bx(14.75,0.12,16.25,0.13,6.15,1.1,new THREE.MeshBasicMaterial({color:0xd02020}),tv); // timer
 // ---- towel + water station by the east wall
 const tw=info('Towel + water station (proposed new)','pnew','Open shelf with rolled towels, a bottle-filler water dispenser and a hamper next to the small fridge.',null,{gym:true,near:true});
 {Bx(26.4,23.5,27.9,25.3,0,3.2,L(0x8a6a48),tw);for(let i=0;i<3;i++)for(let j=0;j<2;j++)Cy(26.8+i*0.4,24.0+j*0.8,2.7,0.17,0.7,L([0xf2f2f2,0x9aa8b5][j]),'v',undefined,10,tw);
  Cy(27.1,24.4,3.2+0.9,0.35,1.8,Ph(0xe9ecef,80),'y',undefined,16,tw);Cy(27.1,24.4,5.5,0.3,0.9,new THREE.MeshPhongMaterial({color:0x8fc7e8,transparent:true,opacity:0.6,shininess:120}),'y',undefined,16,tw);Cy(26.9,25.8,0.9,0.4,1.8,L(0x555555),'y',0.35,14,tw);}
 // ---- LED lighting: 6 linear high-bay fixtures under the trusses
 const led=info('LED linear high-bays (proposed)','prop','Six 4 ft 5000 K LED linear fixtures (~4,000 lm each, ~$60–120 each) on two switched rows; dimmable 2700 K cove at the recovery wall.',null,{gym:true,near:true});
 const LM=new THREE.MeshBasicMaterial({color:0xfafcff});for(const u of [7,14,21])for(const v of [8,20]){Bx(u-2,v-0.3,u+2,v+0.3,9.6,0.1,L(0x333333),led);Bx(u-1.9,v-0.22,u+1.9,v+0.22,9.55,0.05,LM,led);}
 if(QUALITY_HINT()){for(const [u,v] of [[9,10],[19,10],[14,22]]){const p=new THREE.PointLight(0xf2f6ff,0.35,34,2);const [x,z]=F.P(u,v);p.position.set(x,Y+9,z);g.add(p);}}
}


// ================= v7 ROOM DRESSING =================
{const fz=re=>window.__furn.find(f=>re.test(f.name));
 // rugs: woven textures with borders
 const RP=[['#8e8174','#5a4c40','geo'],['#d8d2c6','#a89c8a',''],['#cfc8bb','#8a7d6c','geo'],['#c9c3d6','#7d7896','']];
 RUGS.forEach(([r,c,w,d],i)=>{if(!r||!r.material)return;const ms=Array.isArray(r.material)?r.material:[r.material];const hex='#'+c.toString(16).padStart(6,'0');const t=fxRugTex(hex,RP[i%RP.length][1],RP[i%RP.length][2]);ms.forEach(mm=>{mm.map=t;mm.color.set(0xffffff);mm.needsUpdate=true;});});
 // TV picture + console detail (lower TV room)
 {const tv=fz(/Samsung 75/);if(tv){const k=tv.c;const c=document.createElement('canvas');c.width=512;c.height=288;const q=c.getContext('2d');const g=q.createLinearGradient(0,0,0,288);g.addColorStop(0,'#5b88b8');g.addColorStop(0.55,'#e8c79a');g.addColorStop(0.56,'#3c5a3a');g.addColorStop(1,'#1d2d22');q.fillStyle=g;q.fillRect(0,0,512,288);q.fillStyle='#2b3f5a';q.beginPath();q.moveTo(0,170);q.lineTo(120,110);q.lineTo(230,160);q.lineTo(340,95);q.lineTo(512,165);q.lineTo(512,190);q.lineTo(0,190);q.fill();
  const s=new THREE.Mesh(new THREE.PlaneGeometry((k.z1-k.z0)-0.1,(k.y1-k.y0)-0.1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),color:0xbbbbbb}));s.position.set(k.x0-0.02,(k.y0+k.y1)/2,(k.z0+k.z1)/2);s.rotation.y=-Math.PI/2;groups.house.add(s);}
  const cn=fz(/media console/);if(cn){const k=cn.c;for(let i=0;i<4;i++){const z=k.z0+(k.z1-k.z0)*(i+0.5)/4;const h=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.5),FX.black());h.position.set(k.x0-0.03,k.y0+1.4,z);groups.house.add(h);const sl=new THREE.Mesh(new THREE.BoxGeometry(0.02,1.6,0.02),FX.lam(0xd8d6d0));sl.position.set(k.x0-0.01,k.y0+1.0,k.z0+(k.z1-k.z0)*i/4);if(i)groups.house.add(sl);}
   const sb=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.25,3.6),FX.ph(0x1a1a1a,30));sb.position.set((k.x0+k.x1)/2,k.y1+0.13,(k.z0+k.z1)/2);groups.house.add(sb);}}
 // carved panel with mirrored mosaic (great room west wall)
 {const ap=fz(/Carved dark-wood panel/);if(ap){const k=ap.c;const c=document.createElement('canvas');c.width=256;c.height=192;const q=c.getContext('2d');q.fillStyle='#2a1a10';q.fillRect(0,0,256,192);
  for(let y=0;y<192;y+=8)for(let x=0;x<256;x+=8){const d=Math.hypot(x-128,y-96);if((Math.floor(d/14)%2)===0&&d<90){const v=160+Math.random()*90;q.fillStyle=`rgb(${v},${v},${v+8})`;q.fillRect(x+1,y+1,6,6);}}
  q.strokeStyle='#5a3a22';q.lineWidth=6;for(let r=20;r<100;r+=28){q.beginPath();q.arc(128,96,r,0,Math.PI*2);q.stroke();}q.lineWidth=10;q.strokeRect(5,5,246,182);
  const pm=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(3.8,k.z1-k.z0),(k.y1-k.y0)||3),new THREE.MeshPhongMaterial({map:new THREE.CanvasTexture(c),shininess:120,specular:0x888888}));pm.position.set(k.x1+0.03,(k.y0+k.y1)/2,(k.z0+k.z1)/2);pm.rotation.y=Math.PI/2;groups.house.add(pm);}}
 // office desk accessories: monitor, keyboard, lamp
 {const d=fz(/Glass-top desk/);if(d){const k=d.c,y=k.y0+2.46,cx=(k.x0+k.x1)/2;const G=new THREE.Group();FX.box(G,0,0,0.6,0.5,0.05,0.35,FX.black());FX.box(G,0,0.05,0.65,0.08,0.7,0.08,FX.black());FX.box(G,0,0.6,0.62,2.2,1.25,0.06,FX.ph(0x0a0a0a,90));
  const sc=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.15),new THREE.MeshBasicMaterial({color:0x2a4a6a}));sc.position.set(0,1.22,0.585);sc.rotation.y=Math.PI;G.add(sc);FX.box(G,0,0,-0.1,1.4,0.04,0.45,FX.ph(0x2a2a2a,40));FX.box(G,0.95,0,-0.05,0.25,0.04,0.35,FX.ph(0x2a2a2a,40));
  G.position.set(cx,y,(k.z0+k.z1)/2);G.rotation.y=Math.PI;groups.house.add(G);fxLamp(k.x0+0.4,y,k.z1-0.4,1.3,0xf2efe8);}}
 // lamps + plants (tasteful, few)
 const gr=fz(/Steinway Model B/),lw=fz(/#3 Seabreeze gray sectional/),ch=fz(/cigar chair \(2/),kd=fz(/Kids desk/),ns=fz(/Milan's nightstand/);
 if(gr){fxPlant(gr.c.x0-1.6,gr.c.y0,gr.c.z0-1.4,1.1,'fig');}
 if(ch){fxLamp(ch.c.x1+0.9,ch.c.y0,ch.c.z0-0.6,4.6,0xf0e4cc);}
 if(lw){fxLamp(lw.c.x0+1.4,lw.c.y0,lw.c.z1+1.0,4.8,0xefe7d8);fxPlant(lw.c.x0+1.2,lw.c.y0,lw.c.z0-0.9,0.9,'snake');}
 if(kd){fxPlant(kd.c.x1+0.9,kd.c.y0,kd.c.z1-0.5,0.7,'snake');}
 if(ns){fxLamp((ns.c.x0+ns.c.x1)/2,ns.c.y1,(ns.c.z0+ns.c.z1)/2,0.9,0xf4efe6);}
 const dk=fz(/Glass-top desk/);if(dk)fxPlant(dk.c.x1+1.0,dk.c.y0,dk.c.z1+0.2,0.8,'snake');
 // throw blanket + book stack on the tufted bench
 const tb=fz(/#4 Tufted/);if(tb){const k=tb.c,G=new THREE.Group();FX.box(G,0,0,0,0.9,0.12,0.7,FX.lam(0x7a2e22));FX.box(G,0.05,0.12,0,0.8,0.1,0.6,FX.lam(0x22305a));FX.cyl(G,-0.6,0.25,0.3,0.28,0.5,FX.ph(0xe9e4da,60),null,0.22,16);G.position.set((k.x0+k.x1)/2,k.y0+1.12,(k.z0+k.z1)/2);groups.house.add(G);}
 // back bar: bottles + glass shelf + LED
 const bb=fz(/Back bar/);if(bb){const k=bb.c;const sh=new THREE.Mesh(new THREE.BoxGeometry(k.x1-k.x0-0.4,0.05,0.8),new THREE.MeshPhongMaterial({color:0xcfe6ee,transparent:true,opacity:0.45,shininess:150}));sh.position.set((k.x0+k.x1)/2,k.y1+1.6,k.z1-0.45);groups.house.add(sh);
  const led=new THREE.Mesh(new THREE.BoxGeometry(k.x1-k.x0-0.4,0.03,0.05),new THREE.MeshBasicMaterial({color:0xffc98a}));led.position.set((k.x0+k.x1)/2,k.y1+1.58,k.z1-0.1);groups.house.add(led);
  for(let i=0;i<9;i++){const x=k.x0+0.6+i*(k.x1-k.x0-1.2)/8,c=[0x6b3a1a,0x2a5a2a,0xd9c9a0,0x3a1a10,0x8a5a2a][i%5];const b=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.13,0.85,12),new THREE.MeshPhongMaterial({color:c,shininess:120,transparent:true,opacity:0.85}));b.position.set(x,k.y1+1.65+0.42,k.z1-0.45);groups.house.add(b);const n=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.06,0.25,8),b.material);n.position.set(x,k.y1+2.62,k.z1-0.45);groups.house.add(n);}}
}

// ================= v7 KITCHEN + BATH + GUEST QUEEN DETAIL =================
{const hb=(u0,v0,u1,v1,y,h,M,layer)=>{const a=H.P(u0,v0),b=H.P(u1,v1);const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.02,Math.abs(b[0]-a[0])),h,Math.max(0.02,Math.abs(b[1]-a[1]))),M);o.position.set((a[0]+b[0])/2,y+h/2,(a[1]+b[1])/2);o.castShadow=o.receiveShadow=true;groups[layer||'house'].add(o);return o;};
 const BL=FX.black(),SS=FX.ph(0xc9ccd0,120,0xdddddd),GL=new THREE.MeshPhongMaterial({color:0x101418,shininess:150,specular:0x888888});
 // fridge: french doors seam, handles, freezer drawer
 hb(18.52,29.12,18.58,29.2,HM+0.2,6.6,BL);for(const u of [18.2,18.9])hb(u-0.04,29.0,u+0.04,29.1,HM+3.4,2.6,SS);hb(17.3,29.0,19.6,29.1,HM+2.6,0.08,SS);hb(17.1,29.12,19.8,29.18,HM+2.75,0.04,BL);
 // range: oven door glass, handle, knobs, grates
 hb(28.5,30.02,30.4,30.08,HM+0.9,1.4,GL);hb(28.4,29.95,30.5,30.02,HM+2.55,0.08,SS);for(let i=0;i<5;i++)hb(28.5+i*0.45,29.98,28.66+i*0.45,30.05,HM+2.8,0.16,BL);
 for(const u of [28.8,29.9])for(const v of [30.6,31.5]){hb(u-0.4,v-0.4,u+0.4,v+0.4,HM+3.26,0.05,BL);}
 // dishwasher (left of the sink) + base cabinet doors with black pulls
 hb(22.6,29.84,24.6,29.9,HM+0.35,2.5,SS);hb(22.8,29.78,24.4,29.84,HM+2.55,0.07,BL);
 for(const u of [20.4,21.5,25.4,26.5,31.2,32.3,33.4])if(u<28.2||u>30.7){hb(u-0.02,29.86,u+0.02,29.92,HM+0.4,2.4,FX.lam(0xdcdcd6));hb(u+0.15,29.8,u+0.21,29.86,HM+2.0,0.5,BL);}
 // sink faucet (black, gooseneck)
 {const p=H.P(25,31.6);const G=new THREE.Group();FX.cyl(G,0,0.55,0,0.06,1.1,BL);const t=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.05,8,16,Math.PI),BL);t.position.set(0,1.1,-0.3);t.rotation.y=Math.PI/2;G.add(t);G.position.set(p[0],HM+3.15,p[1]);groups.house.add(G);}
 // island: pendant-lit bowl + cutting board
 {const p=H.P(25.5,24.3);const G=new THREE.Group();FX.cyl(G,0,0.12,0,0.55,0.25,FX.ph(0xf2efe8,60),null,0.35,20);for(let i=0;i<4;i++)FX.blob(G,Math.cos(i*1.6)*0.25,0.3,Math.sin(i*1.6)*0.25,0.15,0.15,0.15,FX.lam([0xd04a2a,0xe8b030,0x6a9a3a,0xd04a2a][i]),8);FX.box(G,-1.6,0,0.1,1.4,0.06,0.9,FX.lam(0xa8733f));G.position.set(p[0],HM+3.17,p[1]);groups.house.add(G);}
 // bath mirrors + towel bars (main + lower primary)
 const MIR=new THREE.MeshPhongMaterial({color:0xc9d6dc,shininess:250,specular:0xffffff,envMap:window.__cube||null,reflectivity:0.6});
 hb(0.32,15.6,0.38,18.4,HM+3.6,2.8,MIR);hb(0.3,15.5,0.34,18.5,HM+3.55,2.9,BL);hb(0.35,19.0,0.55,21.0,HM+4.2,0.06,BL);hb(0.5,19.1,0.56,20.9,HM+3.4,0.8,FX.fabric(0xf2f0ea));
 hb(12.32,4.3,12.38,9.3,HL+3.6,2.8,MIR);hb(12.3,4.2,12.34,9.4,HL+3.55,2.9,BL);hb(15.1,10.6,17.4,10.8,HL+4.3,0.06,BL);hb(15.2,10.5,17.3,10.55,HL+3.4,0.9,FX.fabric(0xe9e4da));
 // a bath mat in each bath
 hb(1.0,15.6,2.6,18.0,HM+0.02,0.04,FX.fabric(0xd8d2c6));hb(13.0,10.0,15.0,11.4,HL+0.02,0.04,FX.fabric(0xd8d2c6));}
// guest suite queen (future): bedding on the true-scale queen
{const it=items.find(i=>/^Queen bed 60 × 80 in/.test(i.name));if(it){let mesh=null;groups.future.traverse(o=>{if(o.isMesh&&o.userData.item===it)mesh=o;});if(mesh){const b=new THREE.Box3().setFromObject(mesh);mesh.layers.set(1);mesh.children.forEach(c=>c.layers.set(1));const k={x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,y0:b.min.y};const G=fxBed(k,(k.x1-k.x0)>(k.z1-k.z0)?'w':'s',0xb9a88f,0xf6f3ee,0x8a6a4a);groups.house.remove(G);groups.future.add(G);}}}

// v7 fix: keep the terrain below the walk-out floor inside the house footprint (grass was poking through the lower level)
{const a=H.P(-1,-1),b=H.P(35,33),x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),z0=Math.min(a[1],b[1]),z1=Math.max(a[1],b[1]);const pa=terrain.geometry.attributes.position;let n=0;
 for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);if(x>x0-6&&x<x1+6&&z>z0-6&&z<z1+6&&pa.getY(i)>HL-0.6){pa.setY(i,HL-0.6);n++;}}pa.needsUpdate=true;terrain.geometry.computeVertexNormals();window.__terrFix=n;}
// ================= v6 EXTERIOR REALISM: ground detail shader, tone mapping, flyover =================
{const HC=H.P(17,16),pb=PB.P(16,19),gy=GY.P(14,15);const circ=[[HC[0],HC[1],120],[W(345),Zs(296),75],[pb[0],pb[1],55],[gy[0],gy[1],50],[G.P(12,12)[0],G.P(12,12)[1],45]];
 const U={uLawn:{value:circ.map(c=>new THREE.Vector3(c[0],c[1],c[2]))},uSummer:{value:window.__season==='fall'?0.35:1.0}};
 satMat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vWp;uniform vec3 uLawn[5];uniform float uSummer;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}`).replace('#include <map_fragment>',`#include <map_fragment>
{vec2 q=vWp.xz;float lawn=0.0;for(int i=0;i<5;i++){float d=length(q-uLawn[i].xy);lawn=max(lawn,1.0-smoothstep(uLawn[i].z*0.7,uLawn[i].z,d));}
 float n1=vn(q*0.9),n2=vn(q*3.7),n3=vn(q*0.08);vec3 sat=diffuseColor.rgb;float lum=dot(sat,vec3(0.3,0.59,0.11));
 float tree=smoothstep(0.32,0.18,lum);
 float stripe=0.5+0.5*sin((q.x*0.6+q.y*0.8)/5.0*3.14159);
 vec3 lawnC=mix(vec3(0.29,0.49,0.16),vec3(0.35,0.56,0.2),stripe*0.3+n1*0.7)*(0.9+0.2*n2);
 vec3 fieldC=mix(vec3(0.46,0.5,0.24),vec3(0.36,0.45,0.2),n3)*(0.85+0.3*n2);
 vec3 summer=mix(mix(fieldC,sat*1.05,0.45),lawnC,lawn*(1.0-tree*0.6));
 summer=mix(summer,sat*vec3(0.9,1.02,0.85),tree*(1.0-lawn)*0.8);
 diffuseColor.rgb=mix(sat*(0.92+0.16*n2),summer,uSummer);}`);};
 satMat.needsUpdate=true;
 outer.material.color.set(window.__season==='fall'?0x56703c:0x4d6b30);
 // warm hazy sky
 if(window.__sky){const u=window.__sky.material.uniforms;u.top.value.set(0x3b7ac4);u.mid.value.set(0xa9cbe6);u.bot.value.set(0xe8eef0);}
 scene.fog.color.set(0xd6e2ea);
}
// tone mapping (High/Medium)
window.__applyTone=q=>{if(q==='low'){renderer.toneMapping=THREE.NoToneMapping;}else{renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;}scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(mm=>mm.needsUpdate=true);}});};
// cinematic flyover
let FLY=null;window.flyover=function(){if(FLY){FLY=null;const b=document.getElementById('bFly');if(b)b.textContent='🛸 Aerial flyover';return;}if(typeof stopTour==='function')stopTour();
 const c=new THREE.Vector3(...window.__flyCtr);enterOrbit(c,52);const t0=performance.now();const a0=Math.atan2(camera.position.z-c.z,camera.position.x-c.x);
 FLY={c,t0,a0};const b=document.getElementById('bFly');if(b)b.textContent='■ Stop flyover';
 const step=()=>{if(!FLY)return;const t=(performance.now()-FLY.t0)/1000,a=FLY.a0+t*0.11,R=300+70*Math.sin(t*0.23),hgt=170+60*Math.sin(t*0.17+1);
  camera.position.set(c.x+Math.cos(a)*R,c.y+hgt,c.z+Math.sin(a)*R);controls.target.copy(c);camera.lookAt(c);if(t>57){window.flyover();return;}requestAnimationFrame(step);};step();
 const stop=()=>{if(FLY)window.flyover();canvas.removeEventListener('pointerdown',stop);};setTimeout(()=>canvas.addEventListener('pointerdown',stop),300);};

// ---- v6: dense pine/hardwood treeline from the satellite (dark canopy pixels), instanced, quality-scaled
{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),Wd=200,Ht=Math.round(200*img.height/img.width);c.width=Wd;c.height=Ht;const g=c.getContext('2d');g.drawImage(img,0,0,Wd,Ht);const d=g.getImageData(0,0,Wd,Ht).data;
 const HC=H.P(17,16),pb=PB.P(16,19),gy=GY.P(14,15),keep=[[HC[0],HC[1],115],[W(345),Zs(296),80],[pb[0],pb[1],50],[gy[0],gy[1],45],[SOLAR.x,SOLAR.z,70]];VP.forEach(v=>{if(v.orbit&&v.orbit.pos[1]<HM+60)keep.push([v.orbit.pos[0],v.orbit.pos[2],32]);if(v.walk)keep.push([v.walk.x,v.walk.z,38]);});
 const pts=[];let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 for(let k=0;k<60000&&pts.length<1700;k++){const fx=rnd(),fy=rnd(),px=Math.floor(fx*Wd),py=Math.floor(fy*Ht),i=(py*Wd+px)*4,l=(d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11)/255;if(l>0.3||d[i+1]<d[i]*0.95)continue;
  const x=fx*S.bboxW-CX,z=fy*S.bboxH-CY;if(keep.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;pts.push([x,z,0.5+rnd()*0.45,rnd()]);}
 const pine=pts.filter(p=>p[3]<0.68),hard=pts.filter(p=>p[3]>=0.68);const o=new THREE.Object3D(),cc=new THREE.Color();
 const T=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5,0.8,1,6),new THREE.MeshLambertMaterial({color:0x5a4330}),pts.length);
 const c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),new THREE.MeshLambertMaterial({color:0xffffff}),pine.length),c2=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),new THREE.MeshLambertMaterial({color:0xffffff}),pine.length);
 const hc=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:0xffffff}),hard.length);
 const PG=window.__season==='fall'?[0x2f4f2a,0x3a5a2e,0x2a4626]:[0x1f3a1c,0x284620,0x1b331a,0x2e4d24],HG=window.__season==='fall'?[0xc9772e,0xd9a43a,0xa8452a,0x6f8f3a]:[0x46732e,0x557f36,0x3f6a2c,0x5e8a3a];
 pts.forEach((p,i)=>{const y=rawElev(p[0],p[1]),sc=p[2],isP=p[3]<0.68,ht=isP?(48+20*p[3])*sc:22*sc;o.rotation.set(0,i,0);o.scale.set(1.3*sc,isP?ht*0.55:ht*0.5,1.3*sc);o.position.set(p[0],y+o.scale.y/2,p[1]);o.updateMatrix();T.setMatrixAt(i,o.matrix);});
 pine.forEach((p,i)=>{const y=rawElev(p[0],p[1]),sc=p[2],ht=(48+20*p[3])*sc;cc.set(PG[i%PG.length]);o.rotation.set(0,i*0.7,0);
  o.scale.set(7*sc,ht*0.5,7*sc);o.position.set(p[0],y+ht*0.45,p[1]);o.updateMatrix();c1.setMatrixAt(i,o.matrix);c1.setColorAt(i,cc);
  o.scale.set(5*sc,ht*0.38,5*sc);o.position.set(p[0],y+ht*0.78,p[1]);o.updateMatrix();c2.setMatrixAt(i,o.matrix);c2.setColorAt(i,cc.multiplyScalar(1.1));});
 hard.forEach((p,i)=>{const y=rawElev(p[0],p[1]),sc=p[2];o.rotation.set(0,i,0);o.scale.set(13*sc,11*sc,13*sc);o.position.set(p[0],y+20*sc,p[1]);o.updateMatrix();hc.setMatrixAt(i,o.matrix);hc.setColorAt(i,cc.set(HG[i%HG.length]));});
 for(const mm of [T,c1,c2,hc]){mm.castShadow=true;mm.receiveShadow=false;mm.userData.full=mm.count;groups.trees.add(mm);(window.__trees=window.__trees||[]).push(mm);}
 const q=typeof QUALITY==='string'?QUALITY:'high';for(const mm of [T,c1,c2,hc])mm.count=q==='high'?mm.userData.full:q==='medium'?Math.ceil(mm.userData.full*0.6):Math.ceil(mm.userData.full/4);
 window.__forest=pts.length;refresh&&refresh();};img.src=window.SAT_IMG;}

// ---- v7 CrossFit box finish: birch ply walls to 8 ft over spray foam, foam above, rubber mat seams, turf sled lane beside the rig
{const F=GY,Y=GYy,g=groups.gym;const tx=(w,h,fn,r)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(r)t.repeat.set(r[0],r[1]);t.anisotropy=4;return t;};
 // one 4x8 birch ply sheet per texture tile: grain, edge seam, screw rows
 const plyT=(len)=>tx(256,512,(q,w,h)=>{q.fillStyle='#d9bf94';q.fillRect(0,0,w,h);for(let i=0;i<90;i++){q.strokeStyle=`rgba(${150+Math.random()*40},${110+Math.random()*30},70,${0.12+Math.random()*0.15})`;q.lineWidth=1+Math.random()*2;q.beginPath();const x=Math.random()*w;q.moveTo(x,0);q.bezierCurveTo(x+Math.random()*30-15,h/3,x+Math.random()*30-15,2*h/3,x+Math.random()*20-10,h);q.stroke();}
   q.fillStyle='rgba(90,60,30,0.55)';q.fillRect(0,0,2,h);q.fillRect(w-2,0,2,h);q.fillStyle='#4a4a4a';for(const x of [8,w/2,w-8])for(let y=12;y<h;y+=42){q.beginPath();q.arc(x,y,2.2,0,7);q.fill();}},[len/4,1]);
 const foamT=tx(256,256,(q,w,h)=>{q.fillStyle='#e8e1c8';q.fillRect(0,0,w,h);for(let i=0;i<500;i++){const x=Math.random()*w,y=Math.random()*h,r=4+Math.random()*14;const gr=q.createRadialGradient(x-r*0.3,y-r*0.3,0,x,y,r);gr.addColorStop(0,'rgba(255,252,235,0.6)');gr.addColorStop(1,'rgba(170,160,120,0.25)');q.fillStyle=gr;q.beginPath();q.arc(x,y,r,0,7);q.fill();}},[4,1]);
 const wall=(u0,v0,u1,v1,y0,h,M)=>{const a=F.P(u0,v0),b=F.P(u1,v1);const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.06,Math.abs(b[0]-a[0])),h,Math.max(0.06,Math.abs(b[1]-a[1]))),M);o.position.set((a[0]+b[0])/2,Y+y0+h/2,(a[1]+b[1])/2);o.receiveShadow=true;g.add(o);return o;};
 const PLY=L=>{const t=plyT(L);t.__pbr='ply';return new THREE.MeshLambertMaterial({map:t});},FOAM=new THREE.MeshLambertMaterial({map:foamT});
 const it=info('Birch plywood walls to 8 ft over closed-cell spray foam (proposed)','prop','Closed-cell spray foam on the steel, 1×3 furring, then 3/4 in sanded birch/maple ply screwed in a visible pattern up to 8 ft (hang anything anywhere), foam left exposed above. ~29 sheets: ~$1.5–2.5K materials (ply ~$50–80/sheet) + furring/screws; spray foam is in the climate line.',null,{gym:true,near:true});
 // runs: [axis, fixed, from, to] with door gaps
 const runs=[['S',0.32,[[0.3,22],[25,27.7]]],['N',29.68,[[0.3,13],[16,27.7]]],['E',27.68,[[0.3,11],[19,29.7]]],['W',0.32,[[0.3,29.7]]]];
 for(const [s,f,segs] of runs)for(const [a,b] of segs){const L=b-a;if(s==='S'||s==='N'){const o=wall(a,f-0.03,b,f+0.03,0.08,7.92,PLY(L));o.userData.item=it;pickables.push(o);wall(a,f-0.02,b,f+0.02,8,2,FOAM);}else{const o=wall(f-0.03,a,f+0.03,b,0.08,7.92,PLY(L));o.userData.item=it;pickables.push(o);wall(f-0.02,a,f+0.02,b,8,2,FOAM);}}
 // 4 ft x 6 ft rubber mat seams (lighter lines) over the existing rubber floor
 {const pts=[];for(let u=4;u<28;u+=4)pts.push([[u,0.3],[u,29.7]]);for(let v=6;v<30;v+=6)pts.push([[0.3,v],[27.7,v]]);const geo=new THREE.BufferGeometry(),arr=[];for(const [[u0,v0],[u1,v1]] of pts){const a=F.P(u0,v0),b=F.P(u1,v1);arr.push(a[0],Y+0.15,a[1],b[0],Y+0.15,b[1]);}geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x4a4a4a})));}
 // turf sled lane: 4.5 ft wide, alongside the rig (north side), u 3.5 → 27.7
 const turfT=tx(256,256,(q,w,h)=>{q.fillStyle='#2f6b2a';q.fillRect(0,0,w,h);for(let i=0;i<9000;i++){q.fillStyle=['#3a7d33','#285e24','#468a3c','#2b6427'][i%4];q.fillRect(Math.random()*w,Math.random()*h,1,2+Math.random()*3);}},[6,1]);turfT.__pbr='turf';
 const tit=info('Turf sled lane 4.5 × 24 ft (proposed new)','pnew','Gym turf strip (white lane lines) beside the rig for sled pushes/pulls and carries. ~108 sf: e.g. Yescom HybridLane 4.3 × 50 ft $699.99 ($3.26/sf, yescomusa.com); gym turf generally ~$3–6/sf.',null,{gym:true,near:true});
 {const a=F.P(3.5,18.7),b=F.P(27.6,23.2);const t=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b[0]-a[0]),0.06,Math.abs(b[1]-a[1])),new THREE.MeshLambertMaterial({map:turfT}));t.position.set((a[0]+b[0])/2,Y+0.15,(a[1]+b[1])/2);t.receiveShadow=true;t.userData.item=tit;pickables.push(t);g.add(t);
  for(const v of [18.9,23.0]){const c=F.P(15.55,v);const l=new THREE.Mesh(new THREE.BoxGeometry(24,0.01,0.15),new THREE.MeshBasicMaterial({color:0xf2f2f2}));l.position.set(c[0],Y+0.185,c[1]);g.add(l);}
  for(const u of [6,12,18,24]){const c=F.P(u,20.95);const l=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.01,4.0),new THREE.MeshBasicMaterial({color:0xf2f2f2}));l.position.set(c[0],Y+0.185,c[1]);g.add(l);}}
 // push sled (Prowler-style) on the turf with two 45 lb plates
 {const sit=info('Push sled (proposed new)','pnew','Prowler-style push sled with high/low handles and plate horns; pushes run down the turf lane and out the overhead door. ~$250–500.',null,{gym:true,near:true});
  const S=new THREE.Group(),st=new THREE.MeshPhongMaterial({color:0x1d1f22,shininess:50}),rd=new THREE.MeshPhongMaterial({color:0xb3261e,shininess:40});
  const bx=(x,y,z,w,h,d,M)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M);o.position.set(x,y,z);o.castShadow=true;o.userData.item=sit;pickables.push(o);S.add(o);};
  for(const z of [-1.1,1.1])bx(0,0.12,z,3.6,0.12,0.25,st);bx(0,0.32,0,2.2,0.12,2.4,rd);for(const z of [-0.9,0.9]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,4.2,10),st);p.position.set(-1.5,2.2,z);p.rotation.z=-0.32;S.add(p);bx(-0.9,0.75,z,1.4,0.1,0.1,st);}
  bx(-2.1,3.95,0,0.1,0.1,2.0,st);const hc=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1.2,10),st);hc.position.set(0.3,1.0,0);S.add(hc);for(const y of [0.55,0.78]){const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.74,0.74,0.2,28),new THREE.MeshPhongMaterial({color:0x1f4fa8,shininess:15}));pl.position.set(0.3,y,0);pl.castShadow=true;S.add(pl);}
  const c=F.P(9,20.95);S.position.set(c[0],Y+0.18,c[1]);g.add(S);}
}
// ---- v8 gym downsize (Clark, Oct 27): 4 barbell stations on a compact 2-sided rig, sled lane alongside, storage wall; extra stations removed
{const F=GY,Y=GYy,g=groups.gym;
 const RM=/^(owned – Seabreeze rack|Flat weight bench|Hip-thrust bench|Barbell tree|Bumper plates \+ rolling|DB\/KB 3-tier|Xebex curved|30-in 3-in-1 plyo|Plyo box set|Med\/slam balls|Small gray fridge|Bike storage wall|eBike charging|Assault|GHD|Kettlebell set|Sled \(proposed|Gymnastics rings hung|Climbing rope|Free-standing pull-up rig|Center rig|Olympic barbell \+ bumper|Lifting platform 8|Turf sled lane|Push sled)/;
 const gone=new Set(items.filter(i=>RM.test(i.name)));const boxes=[];const kill=[];
 const inBike=o=>{const p=new THREE.Vector3();o.getWorldPosition(p);const u=p.x-F.x0,v=F.z0-p.z;return (u>8.8&&u<23.2&&v>-0.1&&v<3.8&&p.y<Y+4.6||u>15.8&&u<22.2&&v>26.2&&v<29.8&&p.y<Y+5)&&!(o.userData.item&&!gone.has(o.userData.item));};
 for(const grp of [groups.gym,groups.elec])grp.traverse(o=>{if(!(o.isMesh||o.isLine||o.isLineSegments||o.isInstancedMesh))return;let a=o,it=null;while(a&&!it){it=a.userData&&a.userData.item;a=a.parent;}const tmSl=o.isInstancedMesh&&o.count===34&&o.geometry.parameters&&o.geometry.parameters.width===0.16&&o.geometry.parameters.depth===2.5;if((it&&gone.has(it))||(!it&&grp===groups.gym&&(inBike(o)||tmSl)))kill.push(o);});
 // ancestors that are groups owned by a removed item (e.g. the push sled group) go whole
 for(const o of kill){o.updateWorldMatrix(true,false);boxes.push(new THREE.Box3().setFromObject(o).expandByScalar(0.25));let t=o;while(t.parent&&t.parent!==groups.gym&&t.parent!==groups.elec)t=t.parent;{const r=(t!==o&&t.children.every(c=>kill.includes(c)||!c.isMesh)?t:o);if(r.parent)r.parent.remove(r);}}
 for(let i=pickables.length-1;i>=0;i--)if(kill.includes(pickables[i]))pickables.splice(i,1);
 const inside=(c,b)=>{const cx=(c.x0+c.x1)/2,cz=(c.z0+c.z1)/2,cy=(c.y0+c.y1)/2;return cx>b.min.x&&cx<b.max.x&&cz>b.min.z&&cz<b.max.z&&cy>b.min.y-1&&cy<b.max.y+1;};
 for(let i=colliders.length-1;i>=0;i--)if(boxes.some(b=>inside(colliders[i],b)))colliders.splice(i,1);
 gone.forEach(it=>{it.removed=true;if(it.el){it.el.remove();it.el=null;}});document.querySelectorAll('#legend a[data-n]').forEach(a=>{const it=items[+a.dataset.n];if(it&&it.removed&&a.parentElement)a.parentElement.remove();});
 // helpers
 const add=(m,it)=>{m.castShadow=m.receiveShadow=true;g.add(m);if(it){m.userData.item=it;pickables.push(m);}return m;};
 const Bx=(u0,v0,u1,v1,y0,h,M,it)=>{const a=F.P(u0,v0),b=F.P(u1,v1);const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.02,Math.abs(b[0]-a[0])),h,Math.max(.02,Math.abs(b[1]-a[1]))),M);m.position.set((a[0]+b[0])/2,Y+y0+h/2,(a[1]+b[1])/2);return add(m,it);};
 const Cy=(u,v,y,r,h,M,ax,it,seg)=>{const [x,z]=F.P(u,v);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||16),M);m.position.set(x,Y+y,z);if(ax==='u')m.rotation.z=Math.PI/2;if(ax==='v')m.rotation.x=Math.PI/2;return add(m,it);};
 const P=(c,s,sp)=>new THREE.MeshPhongMaterial({color:c,shininess:s||40,specular:sp||0x333333});const STL=P(0x1d1f22,50),CHR=P(0xd8dde2,140,0xffffff),RED=P(0xb3261e,40),RUB=new THREE.MeshLambertMaterial({color:0x202022}),OAK=new THREE.MeshLambertMaterial({color:0xb98a55});
 const col=(u0,v0,u1,v1,h)=>{const a=F.P(u0,v0),b=F.P(u1,v1);colliders.push({x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1]),y0:Y,y1:Y+h});};
 // rig: 12 × 4 × 9 ft, uprights u7/11/15/19 × v11.5/15.5; stations in bays 7–11 and 15–19 on both faces; open middle bay with rings
 const rig=info('Center rig — 4 barbell stations, 12 × 4 × 9 ft (proposed new)','pnew','Freestanding 2-sided rig: two station bays per side (4 J-cup pairs + spotter arms), multi-height pull-up bars (7.5 / 8 / 8.5 / 9 ft) and a middle bay with high rings (6.6 ft) and low rings (3 ft). Each station faces its own 8 × 6 ft lifting zone. Rough $2–4K (not price-checked), inside the gym line.',null,{gym:true,near:true});
 const US=[7,11,15,19],VS=[11.5,15.5];
 for(const u of US)for(const v of VS){Bx(u-0.125,v-0.125,u+0.125,v+0.125,0,9,STL,rig);Bx(u-0.15,v-0.5,u+0.15,v+0.5,0,0.12,STL,rig);col(u-0.2,v-0.2,u+0.2,v+0.2,9);}
 for(const v of VS)Bx(7,v-0.12,19,v+0.12,8.75,0.25,STL,rig);for(const u of US)Bx(u-0.12,11.5,u+0.12,15.5,8.75,0.25,STL,rig);
 [[7,11,11.2,7.5],[7,11,15.8,8.0],[15,19,11.2,8.5],[15,19,15.8,9.0]].forEach(([a,b,v,h])=>{Cy((a+b)/2,v,h,0.06,4.2,CHR,'u',rig,12);for(const u of [a,b])Bx(u-0.08,Math.min(v,v<13?11.5:15.5),u+0.08,Math.max(v,v<13?11.5:15.5),h-0.15,0.3,STL,rig);});
 const ring=(u,v,y)=>{const [x,z]=F.P(u,v);const r=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.06,8,20),P(0xc8a060,30));r.position.set(x,Y+y,z);add(r,rig);Bx(u-0.03,v-0.03,u+0.03,v+0.03,y+0.36,8.75-(y+0.36),new THREE.MeshLambertMaterial({color:0xdddddd}),rig);};
 for(const du of [-0.8,0.8]){ring(13+du,12.6,6.6);ring(13+du,14.4,3.0);}
 // J-cups + spotters on both faces of each station bay
 for(const u of [7,11,15,19])for(const [v,dv] of [[11.5,-1],[15.5,1]]){Bx(u-0.1,Math.min(v,v+dv*0.35),u+0.1,Math.max(v,v+dv*0.35),4.4,0.35,RED,rig);Bx(u-0.07,Math.min(v,v+dv*1.7),u+0.07,Math.max(v,v+dv*1.7),2.6,0.18,STL,rig);}
 // 4 lifting zones 8 × 6 ft, each with a loaded barbell
 const zone=info('Lifting zones 8 × 6 ft × 4 (proposed new)','pnew','One 8 × 6 ft zone per rig station: 3/4 in rubber with an oak center strip. Bars use the owned barbells (#27) and bumpers (#28).',null,{gym:true,near:true});
 const PC=[0xb3261e,0x1f4fa8,0xd9b21c,0x2e7d32];
 [[5,13,5.5,11.5],[13,21,5.5,11.5],[5,13,15.5,21.5],[13,21,15.5,21.5]].forEach(([u0,u1,v0,v1],i)=>{Bx(u0,v0,u1,v1,0.08,0.1,RUB,zone);const uc=(u0+u1)/2,vc=(v0+v1)/2;Bx(uc-1.5,v0+0.05,uc+1.5,v1-0.05,0.08,0.11,OAK,zone);
  Cy(uc,vc,0.74,0.05,7.2,CHR,'u',zone,12);for(const s of [-1,1]){Cy(uc+s*2.75,vc,0.74,0.74,0.22,P(PC[i],25),'u',zone,28);Cy(uc+s*2.97,vc,0.74,0.62,0.18,P(PC[(i+2)%4],25),'u',zone,28);Cy(uc+s*3.2,vc,0.74,0.1,0.12,CHR,'u',zone,10);}});
 // storage wall (west, near the rig, clear floor in front): 7 ft 3-tier DB rack + KB top shelf, bumper toast rack, barbell holder
 const st=info('Storage wall: 3-tier dumbbell rack + kettlebell shelf (owned #25, #31, #32 + proposed)','pnew','7 ft long, 3 sloped tiers of paired hex dumbbells (5–50 lb, 10 pairs) and a flat top shelf with 7 competition kettlebells (8 / 12 / 16 / 20 / 24 / 28 / 32 kg). West wall v8–15, ~2.6 ft of clear floor in front, next to the rig.',null,{gym:true,near:true});
 for(const v of [8.1,11.5,14.9])for(const u of [0.45,2.25]){Bx(u-0.08,v-0.08,u+0.08,v+0.08,0,u<1?3.9:3.2,STL,st);}col(0.3,8,2.4,15,3.5);
 const tiers=[[2.0,0.9,0.3],[1.5,1.7,0.24],[1.0,2.5,0.2]];
 tiers.forEach(([uc,y,r],t)=>{const sh=Bx(uc-0.45,8.1,uc+0.45,14.9,y,0.08,STL,st);sh.rotation.z=0;});
 const DBM=P(0x161616,30),HND=CHR;let n=0;
 const sizes=[0.3,0.285,0.27,0.255,0.24,0.225,0.21,0.195,0.18,0.165];
 for(let t=0;t<3;t++){const [uc,y]=tiers[t];const cnt=t===0?4:3;for(let k=0;k<cnt;k++){const r=sizes[n++];const v0=8.4+k*(6.4/cnt);for(const dv of [0,0.55+r]){const v=v0+dv;
  for(const s of [-1,1]){const [x,z]=F.P(uc+s*0.3,v);const hx=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.2+r*0.4,6),DBM);hx.rotation.z=Math.PI/2;hx.position.set(x,Y+y+0.08+r,z);add(hx,st);}Cy(uc,v,y+0.08+r,0.05,0.55,HND,'u',st,8);}}}
 Bx(0.35,8.1,2.25,14.9,3.25,0.1,P(0x2a2c30,30),st);
 const KC=[0xe58fb1,0x1f4fa8,0xd9b21c,0x6a3fa0,0x2e7d32,0xe07020,0xb3261e];KC.forEach((c,i)=>{const [x,z]=F.P(1.3,8.6+i*0.93);const b=new THREE.Mesh(new THREE.SphereGeometry(0.4,16,12),P(c,30));b.scale.y=0.92;b.position.set(x,Y+3.35+0.38,z);add(b,st);
  const h=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.05,6,14,Math.PI),P(c,30));h.position.set(x,Y+3.35+0.78,z);add(h,st);});
 const bp=info('Bumper-plate toast rack + barbell holder (owned #27, #28)','own','Toast rack for the bumper set and a wall barbell holder for the 3 owned bars (bars in use sit on the 4 zones). West wall v16–20.5.',null,{gym:true,near:true});
 Bx(0.4,16,3,18.4,0,0.15,STL,bp);for(const v of [16.1,18.3])Bx(0.5,v-0.05,2.9,v+0.05,0,1.1,STL,bp);col(0.3,16,3.1,18.5,1.5);
 [[0.8,0xb3261e,0.74],[1.0,0xb3261e,0.74],[1.35,0x1f4fa8,0.74],[1.55,0x1f4fa8,0.74],[1.9,0xd9b21c,0.74],[2.1,0xd9b21c,0.74],[2.45,0x2e7d32,0.74],[2.65,0x2e7d32,0.74]].forEach(([u,c,r])=>Cy(u,17.2,0.15+r,r,0.2,P(c,25),'u',bp,28));
 Bx(0.3,19,0.6,20.6,1,0.2,STL,bp);Bx(0.3,19,0.6,20.6,5.5,0.2,STL,bp);[19.3,19.8,20.3].forEach((v,i)=>Cy(0.8,v,3.9,0.05,7.2,i===1?P(0x111111,40):CHR,'y',bp,10));
 // turf sled lane moved south, alongside the rig: 4.5 × 23 ft (u2–25, v0.8–5.3), one push sled
 const tit=info('Turf sled lane 4.5 × 23 ft (proposed new)','pnew','Gym turf with white lane lines along the south wall, parallel to the rig; one push sled. ~$350–700 (Yescom HybridLane 4.3 × 50 ft $699.99, $3.26/sf).',null,{gym:true,near:true});
 const TM=new THREE.MeshLambertMaterial({color:0x2f6b2a});{const tc=document.createElement('canvas');tc.width=tc.height=256;const q=tc.getContext('2d');q.fillStyle='#2f6b2a';q.fillRect(0,0,256,256);for(let i=0;i<9000;i++){q.fillStyle=['#3a7d33','#285e24','#468a3c','#2b6427'][i%4];q.fillRect(Math.random()*256,Math.random()*256,1,2+Math.random()*3);}const tt=new THREE.CanvasTexture(tc);tt.wrapS=tt.wrapT=THREE.RepeatWrapping;tt.repeat.set(6,1);tt.__pbr='turf';TM.map=tt;}
 Bx(2,0.8,25,5.3,0.12,0.06,TM,tit).castShadow=false;const LW=new THREE.MeshBasicMaterial({color:0xf2f2f2});for(const v of [1.0,5.1])Bx(2,v-0.07,25,v+0.07,0.185,0.01,LW);for(const u of [6,12,18,24])Bx(u-0.07,1.0,u+0.07,5.1,0.185,0.01,LW);
 const sit=info('Push sled (proposed new)','pnew','Prowler-style push sled with high/low handles; runs down the turf lane and out the man door. ~$250–500.',null,{gym:true,near:true});
 {const c=F.P(5,3.05);const S=new THREE.Group();const bx=(x,y,z,w,h,d,M)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M);o.position.set(x,y,z);o.castShadow=true;o.userData.item=sit;pickables.push(o);S.add(o);};
  for(const z of [-1.1,1.1])bx(0,0.12,z,3.6,0.12,0.25,STL);bx(0,0.32,0,2.2,0.12,2.4,RED);for(const z of [-0.9,0.9]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,4.2,10),STL);p.position.set(-1.5,2.2,z);p.rotation.z=-0.32;S.add(p);}bx(-2.1,3.95,0,0.1,0.1,2.0,STL);
  for(const y of [0.55,0.78]){const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.74,0.74,0.2,28),P(0x1f4fa8,25));pl.position.set(0.3,y,0);S.add(pl);}S.position.set(c[0],Y+0.18,c[1]);S.rotation.y=Math.PI;g.add(S);}
 window.__gym8={removed:kill.length,items:gone.size};}
// ================= QUALITY =================
let QUALITY='high';
window.setQuality=function(q){if(q!=='high'&&q!=='medium')q='low';if(window.__matTier&&((q==='low')!==(window.__matTier==='lambert'))&&window.__ready){try{localStorage.setItem('samelsQ',q);}catch(e){}location.reload();return;}QUALITY=q;const hi=q!=='low',full=q==='high';renderer.setPixelRatio(full?Math.min(2,devicePixelRatio):q==='medium'?Math.min(1.25,devicePixelRatio):1);
  const sh=document.getElementById('shT');if(sh)sh.checked=hi;const il=document.getElementById('ilT');if(il)il.checked=hi;
  if(sun.shadow.map&&sun.shadow.mapSize.x!==(full?4096:2048)){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.set(full?4096:2048,full?4096:2048);sun.shadow.radius=full?3:2;
  (window.__trees||[]).forEach(m=>{if(m.userData.full===undefined)m.userData.full=m.count;m.count=full?m.userData.full:q==='medium'?Math.ceil(m.userData.full*0.6):Math.ceil(m.userData.full/3);});
  if(window.__applyTone)window.__applyTone(q);
  const sel=document.getElementById('qSel');if(sel)sel.value=q;try{localStorage.setItem('samelsQ',q);}catch(e){}resize();refresh();};
// ================= RESIZE + LOOP =================
function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();refresh();uiMode();

// ================= v7 MATERIALS: MeshStandard + PMREM sky environment (High/Medium only) =================
window.__toStandard=function(){let n=0;const map=new Map();const fwd=(o,nm,keys)=>{for(const k of keys){const v=nm[k];try{Object.defineProperty(o,k,{configurable:true,get:()=>nm[k],set:x=>{nm[k]=x;}});}catch(e){}}};
 const cube=(()=>{const f=(top,bot)=>{const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d');const g=q.createLinearGradient(0,0,0,64);g.addColorStop(0,top);g.addColorStop(1,bot);q.fillStyle=g;q.fillRect(0,0,64,64);return c;};
   const side=f('#b8c4d0','#6a6a66');const t=new THREE.CubeTexture([side,side,f('#5f8fd0','#a8c6e6'),f('#5a5a56','#5a5a56'),side,side]);t.needsUpdate=true;return t;})();window.__cube=cube;
 const conv=M=>{if(!M||map.has(M))return map.get(M)||M;if(!(M.isMeshLambertMaterial||M.isMeshPhongMaterial)){map.set(M,M);return M;}
  if(M.isMeshPhongMaterial&&(M.shininess>=90||M.transparent)&&!(M.color&&M.color.r+M.color.g+M.color.b>2.4&&!(M.specular&&M.specular.getHex()>=0xeeeeee&&M.shininess>=200))){M.envMap=cube;M.reflectivity=M.transparent?0.35:(M.specular&&M.specular.getHex()>=0xcccccc?0.45:0.12);M.combine=THREE.MixOperation;M.needsUpdate=true;map.set(M,M);return M;}
  const ph=M.isMeshPhongMaterial,sh=ph?M.shininess:0,spec=ph&&M.specular?M.specular.getHex():0;const metal=ph&&sh>=120&&spec>=0xcccccc&&!M.transparent;
  const S=new THREE.MeshStandardMaterial({map:M.map,transparent:M.transparent,opacity:M.opacity,side:M.side,depthWrite:M.depthWrite,depthTest:M.depthTest,vertexColors:M.vertexColors,fog:M.fog,polygonOffset:M.polygonOffset,polygonOffsetFactor:M.polygonOffsetFactor,polygonOffsetUnits:M.polygonOffsetUnits,alphaTest:M.alphaTest,
   roughness:ph?Math.max(0.12,Math.min(0.85,1-sh/170)):0.88,metalness:metal?0.75:(ph&&sh>=90?0.08:0.0),envMapIntensity:M.transparent?0.9:0.45});
  S.color=M.color;if(M.emissive)S.emissive=M.emissive;if(M.emissiveMap)S.emissiveMap=M.emissiveMap;S.userData=M.userData;S.name=M.name;
  if(M.map)M.map.encoding=THREE.LinearEncoding;
  fwd(M,S,['opacity','transparent','depthWrite','visible','side','map','wireframe']);try{Object.defineProperty(M,'needsUpdate',{configurable:true,set:v=>{S.needsUpdate=v;M.version++;}});}catch(e){}
  map.set(M,S);n++;return S;};
 scene.traverse(o=>{if(!o.material||o.isSprite||o.isLine||o.isPoints)return;if(Array.isArray(o.material))o.material=o.material.map(conv);else o.material=conv(o.material);});
 // procedural sky environment
 /* PMREM env skipped: renders black on software GL; shiny materials keep Phong + a cube envMap instead */
 window.__stdCount=n;return n;};
// interior exposure: lower when the camera is inside a building
window.__interiorExposure=()=>{const p=camera.position;const inB=(F,w,d,y0,h)=>{const a=F.P(0,0),b=F.P(w,d);return p.x>Math.min(a[0],b[0])&&p.x<Math.max(a[0],b[0])&&p.z>Math.min(a[1],b[1])&&p.z<Math.max(a[1],b[1])&&p.y>y0-10&&p.y<y0+h;};
 return inB(H,34,32,HM,30)||inB(GY,28,30,GYy,12)||inB(PB,32,38,PBy,15)||inB(G,24,24,HM,12);};
// ================= v7 PERF: merge static meshes/lines per parent+material (originals kept on layer 1 for picking) =================
ray.layers.enable(1);lblRay.layers.enable(1);
window.__mergeStatic=function(){const t0=performance.now();
 const all=[];scene.traverse(o=>{if((o.isMesh||o.isLineSegments)&&!o.isInstancedMesh&&o.parent&&o.parent!==scene&&o.geometry&&o.geometry.isBufferGeometry&&o.geometry.attributes.position)all.push(o);});
 const mats=new Set();all.forEach(o=>(Array.isArray(o.material)?o.material:[o.material]).forEach(M=>M&&mats.add(M)));const matArr=[...mats];
 const msnap=()=>matArr.map(M=>(M.color?M.color.getHex():0)+'|'+(M.map?M.map.uuid:'')+'|'+M.visible);const mbase=msnap(),dynMat=new Set();
 const snap=()=>all.map(o=>[o.visible,o.material,o.position.x+o.position.y*7+o.position.z*13+o.rotation.x+o.rotation.y*3+o.rotation.z*5+o.scale.x+o.scale.y*2+o.scale.z*3,o.parent]);
 const anc=new Set();all.forEach(o=>{let a=o.parent;while(a&&a.parent&&a.parent!==scene){anc.add(a);a=a.parent;}});const ancArr=[...anc],abase=ancArr.map(a=>a.visible),dynAnc=new Set();
 const base=snap(),dyn=new Set();const cmp=()=>{const s=snap();s.forEach((v,i)=>{const b=base[i];if(v[0]!==b[0]&&(levelOf.has(all[i])||roofs.includes(all[i])||houseRoofs.includes(all[i])||softLines.includes(all[i])))return;if(v[0]!==b[0]||v[1]!==b[1]||v[2]!==b[2]||v[3]!==b[3])dyn.add(all[i]);});ancArr.forEach((a,i)=>{if(a.visible!==abase[i])dynAnc.add(a);});const ms=msnap();ms.forEach((v,i)=>{if(v!==mbase[i])dynMat.add(matArr[i]);});};
 const fire=c=>{try{c.dispatchEvent(new Event('change'));c.dispatchEvent(new Event('input'));refresh();}catch(e){}};
 const boxes=[...document.querySelectorAll('input[type=checkbox]')];
 for(const c of boxes){c.checked=!c.checked;fire(c);cmp();c.checked=!c.checked;fire(c);}
 const sels=[...document.querySelectorAll('select')].filter(s=>s.id!=='qSel');for(const s of sels){const v0=s.value;for(const op of s.options){s.value=op.value;fire(s);cmp();}s.value=v0;fire(s);}
 for(const [f,vals] of [[window.setDeck,['brown','gray','black','white','cedar']],[window.setDoorFrame,['black','brown','cream']],[window.setFloor,['wood','gray']]])if(f)for(const v of vals){try{f(v);cmp();}catch(e){}}
 try{const Q=new URLSearchParams(location.search);window.setDeck&&setDeck(Q.get('deck')||'brown');window.setDoorFrame&&setDoorFrame(Q.get('frame')||'brown');window.setFloor&&setFloor(Q.get('floor')||'gray');}catch(e){}
 refresh();cmp();
 const soft=new Set(softMats.map(s=>s.m));
 const softTag=new Map(softMats.map(s=>[s.m,s.tag==='future'?'F':'S']));
 const sig=M=>{if(dynMat.has(M)||M.userData.keepSoft)return M.uuid;return [M.type,M.color&&M.color.getHex(),M.map&&M.map.uuid,M.emissive&&M.emissive.getHex(),M.opacity,M.transparent,M.side,M.vertexColors,M.shininess,M.specular&&M.specular.getHex(),M.polygonOffset,M.polygonOffsetFactor,M.depthTest,M.depthWrite,M.wireframe,M.linewidth,M.fog,M.userData.o0,softTag.get(M)||''].join('|');};
 const topOf=o=>{let a=o.parent;while(a.parent&&a.parent!==scene)a=a.parent;return a;};const ctl=o=>{let a=o.parent,c='';while(a&&a.parent&&a.parent!==scene){if(dynAnc.has(a)||levelOf.has(a))c=a.uuid;a=a.parent;}return c;};
 const memb=o=>[levelOf.has(o)?levelOf.get(o):'-',roofs.includes(o)?'R':'',houseRoofs.includes(o)?'HR':'',softLines.includes(o)&&o.userData.soft?'SL':''].join('');
 const buckets=new Map();
 for(const o of all){if(dyn.has(o)||!o.visible&&!levelOf.has(o)&&!roofs.includes(o)&&!houseRoofs.includes(o)&&!softLines.includes(o)||o.userData.noMerge)continue;const g=o.geometry;const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(M=>!M||M.isShaderMaterial||M.isSpriteMaterial||!M.visible||M.isLineDashedMaterial))continue;
  const attrs=Object.keys(g.attributes).filter(k=>['position','normal','uv'].includes(k)).sort().join(',');if(o.isMesh&&!g.attributes.normal)continue;
  o.updateMatrix();const parts=Array.isArray(o.material)&&g.groups.length?g.groups.map(gr=>[gr,o.material[gr.materialIndex]]):[[null,Array.isArray(o.material)?o.material[0]:o.material]];
  for(const [gr,M] of parts){if(!M)continue;const key=topOf(o).uuid+'|'+ctl(o)+'|'+sig(M)+'|'+(o.isMesh?'M':'L')+'|'+attrs+'|'+o.castShadow+o.receiveShadow+'|'+o.renderOrder+'|'+memb(o);let b=buckets.get(key);if(!b){b={parent:topOf(o),mat:M,line:!o.isMesh,cs:o.castShadow,rs:o.receiveShadow,ro:o.renderOrder,attrs:attrs.split(','),items:[],ref:o};buckets.set(key,b);}b.items.push([o,gr]);}}
 let made=0;const merged=new Set();
 for(const b of buckets.values()){if(b.items.length<2)continue;const geos=[],used=[];
  for(const [o,gr] of b.items){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();if(gr){const s=gr.start,c=Math.min(gr.count,g.attributes.position.count-s);const ng=new THREE.BufferGeometry();for(const at0 of b.attrs){const at=g.attributes[at0];if(!at)continue;ng.setAttribute(at0,new THREE.BufferAttribute(at.array.slice(s*at.itemSize,(s+c)*at.itemSize),at.itemSize));}g=ng;}
   if(b.attrs.some(x=>!g.attributes[x]))continue;o.updateWorldMatrix(true,false);b.inv=b.inv||new THREE.Matrix4().copy(b.parent.matrixWorld).invert();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(b.inv,o.matrixWorld));geos.push(g);used.push(o);}
  if(geos.length<2)continue;let tot=0;geos.forEach(g=>tot+=g.attributes.position.count);const out=new THREE.BufferGeometry();
  for(const at0 of b.attrs){const sz=geos[0].attributes[at0].itemSize,arr=new Float32Array(tot*sz);let off=0;for(const g of geos){arr.set(g.attributes[at0].array,off);off+=g.attributes[at0].array.length;}out.setAttribute(at0,new THREE.BufferAttribute(arr,sz));}
  geos.forEach(g=>g.dispose());out.computeBoundingSphere();const mm=b.line?new THREE.LineSegments(out,b.mat):new THREE.Mesh(out,b.mat);mm.castShadow=b.cs;mm.receiveShadow=b.rs;mm.renderOrder=b.ro;mm.userData.mergedStatic=true;mm.position.set(0,0,0);b.parent.add(mm);made++;
  const r=b.ref;if(levelOf.has(r))levelOf.set(mm,levelOf.get(r));if(roofs.includes(r))roofs.push(mm);if(houseRoofs.includes(r))houseRoofs.push(mm);if(softLines.includes(r)&&r.userData.soft){mm.userData.soft=true;softLines.push(mm);}if(extWalls.includes(r))extWalls.push(mm);
  for(const o of used)o.userData._mp=(o.userData._mp||0)+1;}
 for(const o of all){const need=Array.isArray(o.material)&&o.geometry.groups.length?o.geometry.groups.length:1;if(o.userData._mp>=need){o.layers.set(1);merged.add(o);}}
 // partially merged multi-material originals: rendering both is harmless (identical depth)
 refresh();window.__mergeInfo={meshes:all.length,dynamic:dyn.size,dynMats:dynMat.size,merged:merged.size,newMeshes:made,ms:Math.round(performance.now()-t0)};return window.__mergeInfo;};
{let q0=null;try{q0=localStorage.getItem('samelsQ');}catch(e){}const Q0=new URLSearchParams(location.search);if(Q0.get('clean')==='1')q0='high';if(Q0.get('q'))q0=Q0.get('q');if(!q0)q0=(matchMedia('(pointer:coarse)').matches||innerWidth<900)?'low':'high';window.__matTier=q0==='low'?'lambert':'standard';if(q0!=='low'){try{window.__toStandard();}catch(e){console.warn('std failed',e);}}}
// ===== v8 photo-real (High only): CC0 Poly Haven PBR textures, HDRI environment, glTF furniture (lazy per room) =====
if(window.__V8HI&&window.__matTier==='standard'){try{
 const TL=new THREE.TextureLoader(),tc={};const T=(n,c)=>tc[n]||(tc[n]=new Promise(r=>TL.load('assets/tex/'+n+'.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;r(t);},undefined,()=>r(null))));
 const TEXr=window.__TEX||{};const sets={plank:'oak_wood_planks_gray',siding:'weathered_plank_siding_gray',rib:'box_profile_metal_sheet_gray',deck:'brown_planks_05_gray',rubber:'rubber_tiles_diff',ply:'plywood_diff',turf:'leafy_grass_diff'};
 const nr={leather:'fabric_leather_01',fabric:'fabric_pattern_07',plank:'oak_wood_planks',siding:'weathered_plank_siding',rib:'box_profile_metal_sheet',seam:'box_profile_metal_sheet',deck:'brown_planks_05',rubber:'rubber_tiles',ply:'plywood',turf:'leafy_grass'};
 const keyOf=m=>{const t=m.map;if(!t)return null;if(t.__pbr)return t.__pbr;for(const k of ['plank','siding','rib','seam','deck'])if(TEXr[k]&&t.image===TEXr[k].image)return k;return null;};
 const todo=[];const seen=new Set();scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m||seen.has(m)||!m.isMeshStandardMaterial)continue;seen.add(m);const k=keyOf(m);if(k)todo.push([m,k]);}});
 const cl=(t,ref)=>{if(!t)return null;const c=t.clone();c.repeat.copy(ref.repeat);c.offset.copy(ref.offset);c.rotation=ref.rotation;c.center.copy(ref.center);c.needsUpdate=true;return c;};
 Promise.all(todo.map(async([m,k])=>{const ref=m.map;const [d,n,r]=await Promise.all([sets[k]?T(sets[k]):null,T(nr[k]+'_nor'),T(nr[k]+'_rough')]);if(d)m.map=cl(d,ref);if(n){m.normalMap=cl(n,ref);m.normalScale=new THREE.Vector2(k==='plank'?0.5:0.8,k==='plank'?0.5:0.8);}if(r)m.roughnessMap=cl(r,ref);m.roughness=k==='plank'?0.55:k==='leather'?0.7:1;if(k==='leather'||k==='fabric')m.normalMap&&m.normalMap.repeat.set(3,3),m.roughnessMap&&m.roughnessMap.repeat.set(3,3);m.needsUpdate=true;})).then(()=>{window.__v8tex=todo.length;});
 // HDRI environment (Poly Haven kloofendal_48d_partly_cloudy_puresky, 1k) with a black-PMREM guard (some software GL stacks return black)
 if(THREE.RGBELoader&&!/[?&]hdri=0/.test(location.search))new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdri/sky_1k.hdr',t=>{try{const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromEquirectangular(t);t.dispose();pm.dispose();
   const ts=new THREE.Scene(),tcam=new THREE.PerspectiveCamera(40,1,0.1,10),sp=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:0.6,envMap:rt.texture}));ts.add(sp);tcam.position.z=3;
   const R=new THREE.WebGLRenderTarget(8,8);renderer.setRenderTarget(R);renderer.render(ts,tcam);const px=new Uint8Array(256);renderer.readRenderTargetPixels(R,0,0,8,8,px);renderer.setRenderTarget(null);R.dispose();let s=0;for(let i=0;i<256;i+=4)s+=px[i]+px[i+1]+px[i+2];
   window.__hdriOK=s>300;if(window.__hdriOK){scene.environment=rt.texture;const seen2=new Set();scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&m.isMeshStandardMaterial&&!seen2.has(m)){seen2.add(m);m.envMapIntensity=m.userData.glb?0.9:0.45;}});}}catch(e){console.warn('hdri',e);}},undefined,()=>{});
 // glTF furniture swaps: fit each CC0 model into the existing piece's footprint (or height), same spot and facing; FX mesh kept as the Low/fallback
 if(THREE.GLTFLoader&&window.__swaps.length){const ld=new THREE.GLTFLoader(),mc={};const get=m=>mc[m]||(mc[m]=new Promise((res,rej)=>ld.load('assets/models/'+m+'/'+m+'.gltf',g=>res(g.scene),undefined,rej)));
  const doSwap=s=>{if(s.st)return;s.st=1;get(s.m).then(src=>{const G=s.G;const p0=G.position.clone(),r0=G.rotation.clone(),s0=G.scale.clone(),par=G.parent;if(!par)return;
    par.remove(G);G.position.set(0,0,0);G.rotation.set(0,0,0);G.scale.set(1,1,1);G.updateMatrixWorld(true);const gb=new THREE.Box3().setFromObject(G);G.position.copy(p0);G.rotation.copy(r0);G.scale.copy(s0);par.add(G);
    const o=src.clone(true);o.rotation.y=s.ry||0;o.updateMatrixWorld(true);let mb=new THREE.Box3().setFromObject(o);const gs=gb.getSize(new THREE.Vector3()),ms=mb.getSize(new THREE.Vector3());
    const sc=(s.fit==='h'?gs.y/ms.y:Math.min(gs.x/ms.x,gs.z/ms.z))*(s.k||1);o.scale.setScalar(sc);o.updateMatrixWorld(true);mb=new THREE.Box3().setFromObject(o);const gc=gb.getCenter(new THREE.Vector3()),mcn=mb.getCenter(new THREE.Vector3());
    o.position.set(gc.x-mcn.x,gb.min.y-mb.min.y,gc.z-mcn.z);const Hd=new THREE.Group();Hd.position.copy(p0);Hd.rotation.copy(r0);Hd.scale.copy(s0);Hd.add(o);Hd.userData.noMerge=true;
    o.traverse(c=>{c.userData.noMerge=true;if(c.isMesh){c.castShadow=c.receiveShadow=true;const ms2=Array.isArray(c.material)?c.material:[c.material];ms2.forEach(m=>{m.userData.glb=true;if(m.isMeshStandardMaterial)m.envMapIntensity=scene.environment?0.9:1;});}});
    par.add(Hd);G.visible=false;s.H=Hd;s.st=2;window.__swapDone=(window.__swapDone||0)+1;}).catch(e=>{s.st=3;console.warn('glb',s.m,e&&e.message);});};
  window.__swaps.forEach(s=>{s.G.updateWorldMatrix(true,false);s.wp=new THREE.Vector3().setFromMatrixPosition(s.G.matrixWorld);});
  window.__swapAll=()=>window.__swaps.forEach(doSwap);
  if(/[?&]glb=all/.test(location.search)||new URLSearchParams(location.search).get('clean')==='1')window.__swapAll();
  setInterval(()=>{const c=camera.position;for(const s of window.__swaps)if(!s.st&&c.distanceTo(s.wp)<75)doSwap(s);},500);}
}catch(e){console.warn('v8',e);}}
try{window.__mergeStatic();}catch(e){console.warn('merge failed',e);}
{const Q=new URLSearchParams(location.search);const clean=Q.get('clean')==='1';let q=null;try{q=localStorage.getItem('samelsQ');}catch(e){}
 if(clean)q='high';else if(!q)q=(matchMedia('(pointer:coarse)').matches||innerWidth<900)?'low':'high';if(Q.get('q'))q=Q.get('q');setQuality(q);
 if(clean){document.body.classList.add('clean');document.getElementById('lblT').checked=false;if(Q.get('vp')!=='guest_suite')document.querySelectorAll('#layers input').forEach(c=>{if(['plan','future','elec'].includes(c.dataset.l))c.checked=false;});refresh();resize();}
 const vp=Q.get('vp');if(vp){setTimeout(()=>{if(vp==='dollhouse_main'||vp==='dollhouse_lower'){cutaway(vp.split('_')[1]);anim=null;const t=[H.x0+15,vp==='dollhouse_lower'?HL:HM,H.z0-20];camera.position.set(t[0]+36,t[1]+60,t[2]+50);enterOrbit(new THREE.Vector3(...t));}
   else{const v=VP.find(x=>x.id===vp);if(v)goVP(v,true);}window.__ready=true;},50);}else window.__ready=true;}
const v3=new THREE.Vector3();let last=performance.now(),lastHud=0;
function loop(now){const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(anim){const t=Math.min(1,(now-anim.t0)/anim.dur),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(anim.fromP,anim.toP,e);camera.position.y+=Math.sin(Math.PI*e)*anim.lift;
    const L=new THREE.Vector3().lerpVectors(anim.fromL,anim.toL,e);camera.up.set(0,1,0);camera.lookAt(L);if(t>=1){const d=anim.done;anim=null;d&&d();}}
  else if(mode==='orbit'){const sp=(keys.ShiftLeft||keys.ShiftRight?3:1)*camera.position.distanceTo(controls.target)*0.9*dt;let f=0,s=0;
    if(keys.KeyW||keys.ArrowUp)f+=sp;if(keys.KeyS||keys.ArrowDown)f-=sp;if(keys.KeyD||keys.ArrowRight)s+=sp;if(keys.KeyA||keys.ArrowLeft)s-=sp;
    if(f||s){const off=camera.position.clone().sub(controls.target);const fwd=new THREE.Vector3(-off.x,0,-off.z).normalize(),right=new THREE.Vector3(-fwd.z,0,fwd.x);const mv=fwd.multiplyScalar(f).add(right.multiplyScalar(s));camera.position.add(mv);controls.target.add(mv);}
    if(keys.KeyQ||keys.KeyE){const off=camera.position.clone().sub(controls.target);off.applyAxisAngle(new THREE.Vector3(0,1,0),(keys.KeyQ?1:-1)*1.2*dt);camera.position.copy(controls.target).add(off);}
    controls.update();}
  else if(mode==='walk'){const run=keys.ShiftLeft||keys.ShiftRight;const sp=(run?15:6.5)*dt;let f=0,s=0;
    if(keys.KeyW||keys.ArrowUp)f+=sp;if(keys.KeyS||keys.ArrowDown)f-=sp;if(keys.KeyD)s+=sp;if(keys.KeyA)s-=sp;
    if(keys.ArrowLeft||keys.KeyQ)player.yaw+=1.9*dt;if(keys.ArrowRight||keys.KeyE)player.yaw-=1.9*dt;
    if(keys.KeyR&&false){} if(keys.PageUpLook)player.pitch+=dt;
    if(f||s){const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);move(-sy*f+cy*s,-cy*f-sy*s);}
    // gravity / step smoothing
    const g=groundAt(player.x,player.z,player.feet);if(g<player.feet-0.01){player.vy-=32*dt;player.feet=Math.max(g,player.feet+player.vy*dt);}else{player.vy=0;player.feet=g;}
    camera.position.set(player.x,player.feet+5.5,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
    if(now-lastHud>400){hud();lastHud=now;}}
  {const rT=document.getElementById('roofT'),xT=document.getElementById('xrayT');const L=window.__LOD||(window.__LOD=[['house',H.P(17,16),HM],['gym',GY.P(14,15),GYy],['barn',PB.P(16,19),PBy],['cars',G.P(12,12),HM]].filter(e=>groups[e[0]]).map(([k,p,y])=>({g:groups[k],cb:document.querySelector('#layers input[data-l="'+k+'"]'),x:p[0],y,z:p[1]})));
   const far=rT&&rT.checked&&!(xT&&xT.checked);for(const e of L){const on=e.cb?e.cb.checked:true;const d=Math.hypot(camera.position.x-e.x,camera.position.y-e.y,camera.position.z-e.z);e.g.visible=on&&!(far&&d>(QUALITY==='low'?110:170));}}
  if(QUALITY!=='low'){const tgt=window.__interiorExposure()?0.82:1.05;renderer.toneMappingExposure+=(tgt-renderer.toneMappingExposure)*0.12;}renderer.render(scene,camera);updateLabels();drawMini();requestAnimationFrame(loop);}
requestAnimationFrame(loop);
window.__model={setQuality,items:items.length,colliders,surfaces:surfaces.length,setMode,player,blocked,VP,goVP,goLevel,cutaway,get mode(){return mode;},camera,renderer,refresh};
})();
