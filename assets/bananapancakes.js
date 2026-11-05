/* Offline classroom lesson. No accounts, uploads or persistent student data. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), T = window.THREE;
  const steps = [
    {title:'Peel the bananas', instruction:'Pull the peel down.', action:'Peel banana', cue:'Say: “I can peel!”', watch:'Mime peeling a banana.', target:'PEELING TRAY', done:'Banana peeled!'},
    {title:'Mash the bananas', instruction:'Press the banana with a fork.', action:'Mash banana', cue:'Press, press, press!', watch:'Mime mashing. Is it soft yet?', target:'BANANA BOWL', done:'Soft banana topping!'},
    {title:'Make the batter', instruction:'Add the packet’s measured water to the mix.', action:'Add water', cue:'Say: “Measure, then pour!”', watch:'What do we add? Water!', target:'MIX + MEASURED WATER', done:'Water added to the mix!'},
    {title:'Mix gently', instruction:'Stir the batter gently.', action:'Stir batter', cue:'Stir slowly. Take a turn.', watch:'Mime a slow stir.', target:'BATTER BOWL', done:'Batter mixed!'},
    {title:'Cook and flip', instruction:'With your teacher, cook a pancake on low heat.', action:'Cook and flip', cue:'Your teacher stays beside you. Use the spatula.', watch:'Watch from a safe distance. When do we flip?', target:'HOT PAN • WITH TEACHER SUPPORT', done:'Pancake cooked on both sides!'},
    {title:'Cool and serve', instruction:'Let it cool, then add banana on top.', action:'Cool and serve', cue:'Ask: “Is it cool enough?” Then add banana.', watch:'Say the steps: peel, mash, pour, stir, cook, serve!', target:'COOLING PLATE + BANANA', done:'A pancake with banana. Enjoy!'}
  ];
  let groups=[], groupIndex=0, step=0, busy=false, sound=false, audio;
  let renderer, scene, camera, root, active, destination, drag=null, animation=null;
  let generation=0, timer;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state=()=>groups[groupIndex];
  const finished=g=>g.turns.every(n=>n===g.size);
  function message(text) { $('#feedback').textContent=text; $('#scene-message').textContent=text; }
  function cancel() {
    generation++; clearTimeout(timer); animation=null; busy=false;
    if(drag && renderer) {
      if(renderer.domElement.hasPointerCapture(drag.id)) renderer.domElement.releasePointerCapture(drag.id);
      drag=null;
    }
  }
  function chime() {
    if(!sound) return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume();
      const o=audio.createOscillator(), gain=audio.createGain();
      o.frequency.value=700; gain.gain.setValueAtTime(.05,audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);
      o.connect(gain); gain.connect(audio.destination); o.start(); o.stop(audio.currentTime+.21);
    } catch { /* Sound is optional. */ }
  }
  function controls() {
    const g=state(), ready=!!g, done=ready&&g.turns[step]===g.size;
    $('#action').disabled=!ready||busy||done;
    $('#replay').disabled=!ready||busy;
    $('#back').disabled=!ready||step===0;
    $('#next').disabled=!ready||busy;
    $('#action').textContent=busy?'Working…':steps[step].action;
    $('#next').textContent=step===5?'Next group →':'Next →';
    $('#turn').textContent=ready?(done?`Group ${groupIndex+1}: everyone had a turn ✓`:`Group ${groupIndex+1} · Student ${g.turns[step]+1} of ${g.size}`):'';
    $('#stick-progress').textContent=ready?`${g.turns[step]} / ${g.size} turns`:'';
    $('#groupnav').replaceChildren();
    groups.forEach((g,i)=>{
      const b=document.createElement('button'); b.textContent=`Group ${i+1} (${g.size})${finished(g)?' ✓':''}`;
      b.className=i===groupIndex?'current':''; b.setAttribute('aria-pressed',String(i===groupIndex));
      b.onclick=()=>{cancel();groupIndex=i;step=Math.max(0,g.turns.findIndex(n=>n<g.size)); render();};
      $('#groupnav').append(b);
    });
  }
  function render() {
    cancel(); const s=steps[step];
    $('#title').textContent=`${step+1}. ${s.title}`; $('#instruction').textContent=s.instruction;
    $('#stepcount').textContent=`${step+1} / 6`; $('#activecue').textContent=s.cue; $('#watchcue').textContent=s.watch;
    $('#stagelabel').textContent=s.target; $('#setup').hidden=!!groups.length; $('#classbar').hidden=!groups.length;
    $('#steps').replaceChildren();
    steps.forEach((s,i)=>{
      const b=document.createElement('button'); b.textContent=i+1; b.setAttribute('aria-label',s.title);
      b.className=i===step?'current':''; b.disabled=!state()||i>step;
      b.onclick=()=>{step=i;render();}; $('#steps').append(b);
    });
    controls();
    message(!state()?'Form groups, then start peeling.':state().turns[step]===state().size?'Everyone had a turn. Click Next.':'Drag left → right, or click '+s.action.toLowerCase()+'.');
    if(renderer) buildScene();
  }
  function start() {
    const n=Number($('#students').value), k=Number($('#groups').value);
    if(!Number.isInteger(n)||n<1||n>60||!Number.isInteger(k)||k<1||k>8||k>n) {
      message('Choose 1–60 students and 1–8 groups. Each group needs a student.');return;
    }
    groups=Array.from({length:k},(_,i)=>({size:Math.floor(n/k)+(i<n%k?1:0),turns:Array(6).fill(0)}));
    groupIndex=0;step=0;render();
  }
  function perform() {
    const g=state(); if(!g||busy||g.turns[step]>=g.size)return;
    if(g.turns.slice(0,step).some(n=>n<g.size)) {message('Finish the earlier steps first.');return;}
    busy=true;controls();
    message(step===4?'With teacher support: pour, wait for bubbles, flip once.':step===5?'Let it cool. Check the temperature. Add banana.':steps[step].instruction);
    const token=generation;
    const complete=()=>{
      if(token!==generation)return;
      g.turns[step]++;busy=false;animation=null;chime();
      if(renderer) buildScene();controls();
      message(steps[step].done+' '+(g.turns[step]===g.size?(step===5?'Group complete! Click Next group.':'Everyone had a turn. Click Next.'):`Student ${g.turns[step]+1}, your turn!`));
    };
    if(renderer&&active) {
      animation={object:active,from:active.position.clone(),start:performance.now(),duration:reduced?160:step===4?2400:1400,complete};
    } else timer=setTimeout(complete,reduced?120:800);
  }
  function dispose() {
    if(!root)return;
    const materials=new Set(), geometries=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(root);
  }
  // All models and labels are made locally: nothing is downloaded at runtime.
  const labelTextures=new Map();
  let steam=[], liquid=null, peelParts=[], cooked=null, lastFrame=0;
  function mesh(geometry,color,x,y,z,parent=root,extra={}) {
    const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:.48,...extra}));
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(w,h,d,c,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z,p);
  const disc=(r,h,c,x,y,z,p)=>mesh(new T.CylinderGeometry(r,r,h,32),c,x,y,z,p);
  const sphere=(r,c,x,y,z,p)=>mesh(new T.SphereGeometry(r,16,12),c,x,y,z,p);
  function torus(r,t,c,x,y,z,p=root) {
    const m=mesh(new T.TorusGeometry(r,t,8,48),c,x,y,z,p);m.rotation.x=-Math.PI/2;return m;
  }
  function labelTexture(key,lines,bg='#fff8e7',ink='#29594d') {
    if(labelTextures.has(key))return labelTextures.get(key);
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');
    ctx.fillStyle=bg;ctx.fillRect(0,0,512,512);ctx.textAlign='center';
    lines.forEach(([text,y,size,color])=>{ctx.fillStyle=color||ink;ctx.font=`bold ${size}px Trebuchet MS, sans-serif`;ctx.fillText(text,256,y,478);});
    const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;labelTextures.set(key,texture);return texture;
  }
  function frontLabel(texture,w,h,x,y,z,p=root) {
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));m.position.set(x,y,z);p.add(m);return m;
  }
  function packet(x,y,z,scale=1) {
    const p=new T.Group();p.position.set(x,y,z);p.scale.setScalar(scale);root.add(p);
    box(1.1,1.65,.3,0xf8f2dc,0,.85,0,p);box(1.16,.09,.34,0x309989,0,1.71,0,p);
    box(1.16,.09,.34,0x309989,0,.04,0,p);
    frontLabel(labelTexture('aji',[
      ['Aji',78,65,'#d33e36'],['BÁNH RÁN',154,55,'#fff8df'],['PHA SẴN',204,31,'#fff8df'],
      ['CHEESE',304,48],['PANCAKE MIX',357,32],['150 g',455,42]
    ],'#4da99b','#fff6df'),1.04,1.52,0,.88,.16,p);
    return p;
  }
  function banana(parent,peeled=false) {
    const g=new T.Group();parent.add(g);g.rotation.y=-.15;
    const curve=new T.QuadraticBezierCurve3(new T.Vector3(-1,.22,0),new T.Vector3(0,-.55,.06),new T.Vector3(1,.48,0));
    const geo=new T.TubeGeometry(curve,28,.23,10,false),positions=geo.attributes.position;
    // Taper both ends and add the subtle lengthwise ridges of a real banana.
    for(let i=0;i<positions.count;i++) {
      const ring=Math.floor(i/11), t=Math.min(1,ring/28), centre=curve.getPointAt(t);
      const radius=.3+.7*Math.pow(Math.sin(Math.PI*t),.35);
      const v=new T.Vector3().fromBufferAttribute(positions,i).sub(centre).multiplyScalar(radius);
      positions.setXYZ(i,centre.x+v.x,centre.y+v.y,centre.z+v.z);
    }
    geo.computeVertexNormals();mesh(geo,peeled?0xffe7a0:0xf1c43f,0,0,0,g);
    const stem=box(.14,.3,.14,0x76602c,1,.63,0,g);stem.rotation.z=-.3;
    sphere(.09,0x675030,-1,.22,0,g).scale.set(1,.5,1);
    if(!peeled) for(let i=0;i<24;i++) {
      const t=.12+(i%12)/15,pt=curve.getPointAt(t),a=.3+(i%4)*.65;
      const dot=sphere(.025+(i%3)*.012,0x594025,pt.x,pt.y+Math.cos(a)*.21,pt.z+Math.sin(a)*.21,g);
      dot.scale.set(1,.4,1);
    }
    if(peeled) for(let i=0;i<3;i++) {
      const a=(i-1)*1.1,stripCurve=new T.QuadraticBezierCurve3(new T.Vector3(.75,.35,0),new T.Vector3(.65,-.65,.3),new T.Vector3(Math.sin(a)*.9,-.55,.7));
      const strip=mesh(new T.TubeGeometry(stripCurve,18,.1,6,false),0xe8bc39,0,0,0,g);strip.scale.z=.6;
    }
    return g;
  }
  function bowl(x,z,contents='batter') {
    const points=[[0,.02],[.45,.02],[.73,.13],[1,.5],[1.06,.83],[1,.86],[.94,.52],[.67,.2],[0,.17]].map(([a,b])=>new T.Vector2(a,b));
    mesh(new T.LatheGeometry(points,40),0x80bfc2,x,.22,z);
    torus(1.035,.055,0xc9e5dd,x,1.06,z);
    const fill=disc(.86,.07,contents==='banana'?0xe5c078:contents==='powder'?0xf3e9cc:0xf3cf83,x,.82,z);
    if(contents==='banana')for(let i=0;i<9;i++){const a=i*2.4;sphere(.12,0xeacc88,x+Math.cos(a)*.55,.88,z+Math.sin(a)*.5).scale.set(1,.35,1);}
    if(contents==='powder'){const mound=sphere(.48,0xffefd1,x,.87,z);mound.scale.y=.5;}
    return fill;
  }
  function pancake(x,y,z,parent=root,r=.72) {
    const g=new T.Group();g.position.set(x,y,z);parent.add(g);
    disc(r,.19,0xc78c45,0,0,0,g);disc(r*.97,.055,0xe9b965,0,.1,0,g);
    torus(r*.91,.035,0xf6d891,0,.12,0,g);
    for(let i=0;i<18;i++){
      const a=i*2.4,d=(.18+(i%5)*.14)*r;
      const mark=disc(.045+(i%4)*.025,.008,i%3===0?0xac7133:0xd59b4d,Math.cos(a)*d,.133,Math.sin(a)*d,g);mark.scale.z=.7;
    }
    return g;
  }
  function plate(x,z) {
    disc(1.3,.1,0xe7eee3,x,.27,z);disc(1.12,.06,0xfffcf1,x,.34,z);torus(1.19,.07,0xfcfff6,x,.35,z);
    torus(1.05,.018,0x8ab7a3,x,.38,z);
  }
  function spatula(parent) {
    const handle=box(.2,.15,1.25,0x7e5034,0,.12,.55,parent);handle.rotation.x=-.1;
    box(.7,.075,.75,0x71848a,0,.2,-.35,parent);
    for(let i=0;i<3;i++)box(.045,.008,.45,0x34454c,-.2+i*.2,.242,-.35,parent);
  }
  function kitchen() {
    box(13,.42,6.8,0xc7ab82,0,-.23,0);box(13,.1,6.8,0xf0d7ad,0,.03,0);
    // Tanghulu-style tiled backsplash and warm wooden worktop.
    box(13,2,.14,0xe0ead7,0,1,-3.1);
    for(let x=-6;x<=6;x++)box(.018,2,.16,0xc5d5c1,x,1,-3.08);
    for(let y=.1;y<2;y+=.65)box(13,.018,.16,0xc5d5c1,0,y,-3.08);
    for(let i=0;i<6;i++)box(.012,.008,6.5,0xddc094,-5+i*2,.09,0);
    box(3.15,.13,2.7,0xb98a50,-2.6,.18,0);box(3,.045,2.55,0xe3ba7c,-2.6,.27,0);
    for(let i=0;i<5;i++)box(.012,.005,2.45,0xcf9f60,-3.7+i*.55,.297,0);
    // Your actual Aji 150 g cheese mix, ready beside the preparation area.
    packet(-.1,.12,-2, .95);packet(-1.05,.12,-2.25,.8);
    const spare=new T.Group();root.add(spare);spare.position.set(-4.6,.42,-1.8);spare.scale.setScalar(.7);banana(spare);
    const backBanana=new T.Group();root.add(backBanana);backBanana.position.set(-4.55,.6,-2.2);backBanana.scale.setScalar(.7);banana(backBanana);
    // Receipt ingredients stay on the back shelf: they are not added to this packet recipe.
    box(3.3,.11,.85,0xb28b5b,3.9,.75,-2.35);
    box(.58,.94,.46,0xf7edda,3.05,1.27,-2.33);
    frontLabel(labelTexture('milk',[['TH',130,110,'#33748e'],['BANANA',260,55],['MILK',330,60],['180 ml',440,40]],'#fff2c8'),.55,.82,3.05,1.27,-2.09);
    box(.85,.33,.5,0xf6d97b,3.9,.98,-2.3);
    frontLabel(labelTexture('butter',[['TH',145,95],['BUTTER',300,70]],'#ffdf8e'),.78,.3,3.9,.99,-2.04);
    box(.8,.11,.5,0xb89d72,4.8,.88,-2.3);
    for(let i=0;i<3;i++){const egg=sphere(.14,0xf5d8b7,4.55+i*.23,1.08,-2.3);egg.scale.y=1.35;}
    box(.6,.7,.35,0xf9f5e5,5.6,1.15,-2.32);
    frontLabel(labelTexture('sugar',[['SUGAR',250,75],['500 g',370,55]]),.55,.6,5.6,1.15,-2.13);
    frontLabel(labelTexture('spares',[['OTHER INGREDIENTS',220,38],['NOT NEEDED TODAY',310,38]],'#dce9d5'),3.2,.34,4.1,.55,-1.87);
  }
  function buildScene() {
    dispose();root=new T.Group();scene.add(root);steam=[];peelParts=[];liquid=null;cooked=null;
    kitchen();destination=new T.Vector3(2.2,1,0);
    const turns=state()?.turns[step]||0, done=state()&&turns===state().size;
    torus(1.48,.035,0x64a47e,2.2,.12,0);
    if(step===0){
      box(3,.1,2.6,0xbca58a,2.2,.16,0);box(2.9,.04,2.5,0xefe4c9,2.2,.24,0);
      if(turns){const result=new T.Group();result.position.set(2.2,.55,0);root.add(result);banana(result,true);}
    }
    if(step===1)bowl(2.2,0,'banana');
    if(step===2||step===3){bowl(2.2,0,step===2&&!turns?'powder':'batter');packet(4.3,.15,-.7,1.05);}
    if(step===4){
      box(3,.32,2.75,0x36474c,2.2,.25,0);box(2.8,.05,2.55,0x1b292b,2.2,.44,0);
      torus(1.05,.06,0xb95836,2.2,.5,0);disc(1.15,.13,0x3b464a,2.2,.58,0);
      disc(1.04,.025,0x242e31,2.2,.66,0);torus(1.1,.07,0x657578,2.2,.68,0);
      box(1.15,.18,.3,0x3d4a4c,3.75,.6,0);box(.45,.13,.35,0x48585a,1.35,.3,1.42);
      cooked=pancake(2.2,.8,0,root,.8);
      for(let i=0;i<4;i++){const puff=sphere(.09,0xffffff,1.9+i*.2,1.2,0);puff.material.transparent=true;puff.material.opacity=.18;steam.push(puff);}
      bowl(-.5,1,'batter');
    }
    if(step===5){plate(2.2,0);pancake(2.2,.49,0,root,.88);pancake(2.25,.73,.04,root,.82);bowl(4.6,-.55,'banana');
      if(turns)for(let i=0;i<8;i++){const a=i*2.4;const dollop=sphere(.14,0xe4c484,2.2+Math.cos(a)*.38,.94,Math.sin(a)*.3);dollop.scale.y=.5;}
    }
    active=new T.Group();root.add(active);active.position.set(-2.6,1,0);
    if(step===0) {
      banana(active);const peels=new T.Group();active.add(peels);banana(peels,true);peels.visible=false;peelParts=[active.children[0],peels];
    }
    if(step===1){banana(active,true);box(.12,.07,1,0xb4c3c5,0,.45,.1,active);for(let i=0;i<4;i++)box(.028,.07,.32,0xcbd6d5,-.12+i*.08,.45,-.48,active);}
    if(step===2){
      const jug=mesh(new T.CylinderGeometry(.46,.38,.9,32,1,true),0xa9dfec,0,.2,0,active,{transparent:true,opacity:.52,side:T.DoubleSide});
      disc(.38,.045,0x69b4d0,0,.33,0,active);torus(.44,.035,0xc9e9ed,0,.66,0,active);
      const handle=mesh(new T.TorusGeometry(.33,.065,8,20,Math.PI*1.5),0xc0e0df,.49,.22,0,active);handle.rotation.z=-Math.PI*.75;
      for(let i=0;i<4;i++)box(.12,.015,.018,0x3e7787,.25,-.05+i*.16,.34,active);
      liquid=mesh(new T.CylinderGeometry(.045,.07,.9,10),0x91d4e3,0,-.65,0,active);liquid.visible=false;
    }
    if(step===3){box(.13,.13,1.5,0x9c6b41,0,.2,.1,active);const spoon=sphere(.25,0xb8864f,0,.2,-.7,active);spoon.scale.set(1,.3,1.4);}
    if(step===4){spatula(active);pancake(0,.4,-.35,active,.64);}
    if(step===5){box(.12,.12,1.2,0x9c6b41,0,.2,.25,active);const scoop=sphere(.3,0xc7cebf,0,.18,-.42,active);scoop.scale.set(1,.25,1.3);for(let i=0;i<4;i++)sphere(.13,0xe5c888,(i%2-.5)*.2,.28,-.42+(Math.floor(i/2)-.5)*.2,active);}
    if(done)active.visible=false;
    renderer.shadowMap.needsUpdate=true;
  }
  function resize() {
    if(!renderer)return;const v=$('#viewport'),w=v.clientWidth,h=v.clientHeight;
    const halfW=Math.max(6.7,3.2*w/h),halfH=halfW*h/w;
    camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }
  function frame(now) {
    requestAnimationFrame(frame);if(!renderer||now-lastFrame<33)return;lastFrame=now;
    if(animation) {
      const a=animation,t=Math.min(1,(now-a.start)/a.duration),travel=Math.min(1,t*2);
      a.object.position.lerpVectors(a.from,destination,1-Math.pow(1-travel,3));
      if(step===0&&t>.45){peelParts[0].visible=false;peelParts[1].visible=true;}
      if(step===1)a.object.position.y+=Math.abs(Math.sin(t*Math.PI*5))*.35;
      if(step===2){a.object.rotation.z=-Math.sin(t*Math.PI)*.9;liquid.visible=t>.3&&t<.85;}
      if(step===3){a.object.position.x+=Math.sin(t*Math.PI*5)*.36;a.object.position.z+=Math.cos(t*Math.PI*5)*.3;}
      if(step===4){a.object.position.y+=Math.sin(t*Math.PI)*1.3;a.object.rotation.x=Math.PI*2*t;}
      if(t===1)a.complete();
    }
    if(!reduced)steam.forEach((p,i)=>{const phase=(now*.0005+i*.25)%1;p.position.y=1.05+phase*.8;p.material.opacity=(1-phase)*.14;p.scale.setScalar(.6+phase);});
    renderer.render(scene,camera);
  }
  function initGraphics() {
    renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
    renderer.outputEncoding=T.sRGBEncoding;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#viewport').append(renderer.domElement);
    scene=new T.Scene();scene.background=new T.Color(0xdce7d7);
    scene.add(new T.HemisphereLight(0xffffff,0x728666,.85));
    const light=new T.DirectionalLight(0xffefd6,1.05);light.position.set(-4,9,7);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-8,right:8,top:7,bottom:-7});
    light.shadow.bias=-.001;light.shadow.normalBias=.025;scene.add(light);
    const fill=new T.DirectionalLight(0xd5ecff,.4);fill.position.set(5,4,-3);scene.add(fill);
    camera=new T.OrthographicCamera(-7,7,5,-5,.1,100);camera.position.set(0,6.8,10.8);camera.lookAt(0,.6,0);resize();
    const ray=new T.Raycaster(), pointer=new T.Vector2(), plane=new T.Plane(new T.Vector3(0,1,0),-1);
    const ground=e=>{
      const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      ray.setFromCamera(pointer,camera);const p=new T.Vector3();return ray.ray.intersectPlane(plane,p);
    };
    const canvas=renderer.domElement;canvas.style.cursor='grab';
    canvas.onpointerdown=e=>{
      if(e.button!==0||busy||!state()||state().turns[step]>=state().size)return;
      const p=ground(e);if(!p||!ray.intersectObject(active,true).length)return;
      drag={id:e.pointerId,origin:active.position.clone(),offset:active.position.clone().sub(p)};canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove=e=>{if(!drag)return;const p=ground(e);if(p)active.position.copy(p.add(drag.offset));};
    canvas.onpointerup=e=>{
      if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);
      const good=Math.abs(active.position.x-destination.x)<1.3&&Math.abs(active.position.z)<1.4;
      if(good)perform();else{active.position.copy(d.origin);message('Move to the green ring on the right.');}
    };
    canvas.onpointercancel=()=>{if(drag){active.position.copy(drag.origin);drag=null;}};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancel();renderer=null;$('#fallback').hidden=false;controls();message('Use the big action button to continue.');});
    requestAnimationFrame(frame);
  }
  $('#start').onclick=start;$('#action').onclick=perform;
  $('#next').onclick=()=>{
    const g=state();if(!g||busy)return;
    if(g.turns[step]<g.size){message('Everyone needs a turn before Next.');return;}
    if(step<5){step++;render();return;}
    const next=groups.findIndex(g=>!finished(g));
    if(next<0){message('All groups finished! Everyone made banana pancakes.');$('#next').textContent='All groups finished ✓';return;}
    groupIndex=next;step=Math.max(0,state().turns.findIndex(n=>n<state().size));render();
  };
  $('#back').onclick=()=>{if(step){step--;render();}};
  $('#replay').onclick=()=>{if(!state()||busy)return;state().turns.fill(0,step);render();message('Replay: this step and later steps are reset for this group.');};
  $('#restart').onclick=()=>{groups=[];step=0;groupIndex=0;render();};
  $('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));chime();};
  $('#kitchen-only').onclick=()=>{const on=document.body.classList.toggle('kitchen-focus');$('#kitchen-only').textContent=on?'Show lesson':'Big kitchen';$('#kitchen-only').setAttribute('aria-pressed',String(on));resize();};
  $('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('Use your browser’s full-screen command.');}catch{message('Use your browser’s full-screen command.');}};
  document.addEventListener('keydown',e=>{if(e.target.closest('button,input,a,summary'))return;if(e.key==='ArrowRight')$('#next').click();if(e.key==='ArrowLeft')$('#back').click();});
  window.addEventListener('resize',resize);
  try{if(!T)throw Error('Missing Three.js');initGraphics();}catch{renderer=null;$('#fallback').hidden=false;}
  render();
})();
