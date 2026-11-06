/* One teacher-controlled, offline demonstration. No student-turn requirements. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s), T=window.THREE;
  const recipe={bananas:4,mixGrams:150,startingMilkMl:25,reservedMilkMl:100,milkIncrementMl:25,butterGrams:5,scoopMl:30};
  const steps=[
    {short:'Peel',title:'Peel four bananas',instruction:'Click or drag a banana.',measure:'4 ripe bananas'},
    {short:'Bowl',title:'Into the bowl',instruction:'Drag all four into the bowl.',measure:'All 4 bananas'},
    {short:'Mash',title:'Mash the bananas',instruction:'Press the masher three times.',measure:'3 presses'},
    {short:'Measure',title:'Measure and add',instruction:'Add the mix, then the milk.',measure:'150 g mix + 25 ml fresh milk'},
    {short:'Stir',title:'Whisk the batter',instruction:'Make three slow circles.',measure:'Balloon whisk · +25 ml milk if needed'},
    {short:'Butter',title:'Butter the pan',instruction:'Warm on low. Add butter.',measure:'5 g butter · adult helps'},
    {short:'Cook',title:'Cook and flip',instruction:'Pour. Wait for bubbles. Flip.',measure:'30 ml per pancake'},
    {short:'Serve',title:'Cool and serve',instruction:'Move to the plate. Let cool.',measure:'Cool before tasting'}
  ];
  const fresh=()=>({peeled:Array(recipe.bananas).fill(false),inBowl:Array(recipe.bananas).fill(false),mash:0,mix:Array(recipe.mixGrams/150).fill(false),milkMl:0,stirs:0,needsFinalStir:false,heated:false,buttered:false,poured:false,bubbles:false,cooked:false,served:false});
  let batch=fresh(),step=0,started=false,busy=false,generation=0,sound=false,audio,timer;
  let renderer,scene,camera,root,animation=null,drag=null,items=[],glows=[],targetRing,food={},hovered=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function done(i=step) {
    return [batch.peeled.every(Boolean),batch.inBowl.every(Boolean),batch.mash>=3,batch.mix.every(Boolean)&&batch.milkMl>=recipe.startingMilkMl,batch.stirs>=3&&!batch.needsFinalStir,batch.heated&&batch.buttered,batch.cooked,batch.served][i];
  }
  function available() {
    if(!started||done())return [];
    if(step===0)return batch.peeled.flatMap((v,i)=>v?[]:[{id:`banana-${i}`,label:`Peel banana ${i+1}`,kind:'peel',index:i}]);
    if(step===1)return batch.inBowl.flatMap((v,i)=>v?[]:[{id:`banana-${i}`,label:`Put banana ${i+1} in bowl`,kind:'banana',index:i}]);
    if(step===2)return [{id:'masher',label:`Mash · ${batch.mash+1} of 3`,kind:'mash'}];
    if(step===3)return [...batch.mix.flatMap((v,i)=>v?[]:[{id:`mix-${i}`,label:'Add one packet · 150 g',kind:'mix',index:i}]),...(batch.milkMl<recipe.startingMilkMl?[{id:'milk',label:'Pour 25 ml fresh milk',kind:'milk'}]:[])];
    if(step===4)return [{id:'whisk',label:batch.needsFinalStir?'Whisk in the added milk':`Whisk · ${batch.stirs+1} of 3`,kind:'stir'}];
    if(step===5)return [{id:batch.heated?'butter':'hob',label:batch.heated?'Melt 5 g butter':'Heat pan on low',kind:batch.heated?'butter':'heat'}];
    if(step===6)return [{id:!batch.poured?'batter-cup':!batch.bubbles?'pan':'spatula',label:!batch.poured?'Pour 30 ml batter':!batch.bubbles?'Wait for bubbles':'Flip pancake',kind:!batch.poured?'pour':!batch.bubbles?'wait':'flip'}];
    return [{id:'serve',label:'Move to plate & cool',kind:'serve'}];
  }
  function message(text,show=false){$('#feedback').textContent=text;$('#scene-message').textContent=show?text:'';$('#scene-message').hidden=!show;}
  function cancel(){generation++;clearTimeout(timer);animation=null;busy=false;if(drag&&renderer&&renderer.domElement.hasPointerCapture(drag.pointerId))renderer.domElement.releasePointerCapture(drag.pointerId);drag=null;}
  function chime(){if(!sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=720;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.22);}catch{}}
  function progress(){
    if(step===0)return `${batch.peeled.filter(Boolean).length} / 4 peeled`;
    if(step===1)return `${batch.inBowl.filter(Boolean).length} / 4 in bowl`;
    if(step===2)return `${batch.mash} / 3 presses`;
    if(step===3)return `${batch.mix.filter(Boolean).length*150} g mix · ${batch.milkMl} ml milk`;
    if(step===4)return batch.needsFinalStir?`${batch.milkMl} ml milk total · stir in the extra milk`:`${batch.stirs} stirs · ${batch.milkMl} ml milk total`;
    if(step===5)return batch.buttered?'Pan buttered':batch.heated?'Low heat · add butter':'Pan is cold';
    if(step===6)return batch.cooked?'Both sides cooked':batch.bubbles?'Bubbles and set edges':batch.poured?'30 ml in pan':'Measure 30 ml';
    return batch.served?'Batch finished ✓':'Move, cool, check';
  }
  function controls(){
    const actions=available();$('#action').disabled=!started||busy||!actions.length;$('#action').textContent=!started?'Start cooking above':busy?'Working…':actions[0]?.label||'Step complete ✓';
    $('#back').disabled=!started||step===0;$('#next').disabled=!started||busy;$('#next').textContent=step===7&&done()?'Batch finished ✓':'Next →';$('#replay').disabled=!started||busy;
    $('#stick-progress').textContent=started?progress():'One batch · 4 bananas';
    $('#extra-milk').hidden=!(started&&step===4&&batch.stirs>=3&&!batch.needsFinalStir&&batch.milkMl<recipe.reservedMilkMl);$('#extra-milk').disabled=busy;
    $('#item-actions').replaceChildren();
    if(actions.length>1)actions.forEach(a=>{const b=document.createElement('button');b.textContent=['peel','banana'].includes(a.kind)?`🍌 ${a.index+1}`:a.kind==='mix'?'Mix · 150 g':a.kind==='milk'?'Milk · 25 ml':a.label;b.setAttribute('aria-label',a.label);b.dataset.item=a.id;b.disabled=busy;b.onclick=()=>perform(a.id);$('#item-actions').append(b);});
    $('#banana-progress').replaceChildren();for(let i=0;i<4;i++){const c=document.createElement('span');c.className='banana-chip'+(batch.peeled[i]?' complete':'');c.textContent=`${batch.peeled[i]?'✓':'🍌'} ${i+1}${batch.inBowl[i]?' · in bowl':''}`;$('#banana-progress').append(c);}
  }
  function render(text){
    cancel();const s=steps[step];$('#banana-fact').hidden=step>2;
    $('#board-title').textContent=`${step+1}. ${s.title}`;$('#board-instruction').textContent=s.instruction;$('#measure').textContent=s.measure;$('#setup').hidden=started;
    for(const selector of ['#board-steps']){$(selector).replaceChildren();steps.forEach((s,i)=>{const b=document.createElement('button');b.textContent=selector==='#board-steps'?`${i+1}. ${s.short}`:i+1;b.className=i===step?'current':'';b.setAttribute('aria-current',i===step?'step':'false');b.setAttribute('aria-label',s.title);b.disabled=!started||steps.slice(0,i).some((_,j)=>!done(j));b.onclick=()=>{step=i;render();};$(selector).append(b);});}
    controls();if(renderer){buildScene();resize();}message(text||(!started?'Start the batch, then follow the gold glow.':done()?(step===7?'Batch finished! One demonstration is enough.':'Step complete. Click Next.'):s.instruction));
  }
  function resetFrom(index){
    if(index<=0)batch.peeled.fill(false);if(index<=1)batch.inBowl.fill(false);if(index<=2)batch.mash=0;if(index<=3){batch.mix.fill(false);batch.milkMl=0;}if(index<=4){batch.stirs=0;batch.needsFinalStir=false;}if(index===4)batch.milkMl=recipe.startingMilkMl;if(index<=5){batch.heated=false;batch.buttered=false;}if(index<=6){batch.poured=false;batch.bubbles=false;batch.cooked=false;}batch.served=false;
  }
  function perform(id){
    if(!started||busy)return;const a=id==='extra-milk'&&step===4&&batch.stirs>=3&&!batch.needsFinalStir&&batch.milkMl<recipe.reservedMilkMl?{id,kind:'extra-milk',label:'Add 25 ml milk'}:available().find(a=>a.id===id)||(!id?available()[0]:null);if(!a)return;
    const visual=items.find(i=>i.id===a.id);busy=true;controls();message(a.kind==='heat'?'Low heat. This animation is not a real pan timer.':a.kind==='wait'?'Watch for bubbles and set edges. Real cooking takes as long as needed.':a.label);
    const token=generation;
    const finish=()=>{if(token!==generation)return;
      if(a.kind==='peel')batch.peeled[a.index]=true;if(a.kind==='banana')batch.inBowl[a.index]=true;if(a.kind==='mash')batch.mash++;
      if(a.kind==='mix')batch.mix[a.index]=true;if(a.kind==='milk')batch.milkMl=recipe.startingMilkMl;if(a.kind==='stir'){batch.stirs++;batch.needsFinalStir=false;}
      if(a.kind==='extra-milk'){batch.milkMl+=recipe.milkIncrementMl;batch.needsFinalStir=true;}
      if(a.kind==='heat')batch.heated=true;if(a.kind==='butter')batch.buttered=true;if(a.kind==='pour')batch.poured=true;if(a.kind==='wait')batch.bubbles=true;if(a.kind==='flip')batch.cooked=true;if(a.kind==='serve')batch.served=true;
      busy=false;animation=null;chime();render(a.kind==='mash'?(batch.mash===3?'The four bananas are now mashed.':'The whole bananas are becoming softer chunks.'):a.kind==='stir'?(batch.stirs>=3?'Check the real batter: leave the milk out unless it needs thinning. Test one small pancake.':'Keep stirring: the dry mix and banana are blending.'):undefined);
    };
    if(renderer&&visual){animation={action:a,item:visual,from:visual.object.position.clone(),start:performance.now(),duration:reduced?180:['heat','wait','mix'].includes(a.kind)?2200:1600,finish};}
    else timer=setTimeout(finish,reduced?180:900);
  }
  function dispose(){if(!root)return;const materials=new Set(),geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(root);}
  // All models and labels are made locally: nothing is downloaded at runtime.
  const labelTextures=new Map();
  let lastFrame=0;
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
    const p=new T.Group();p.name='aji-packet';p.position.set(x,y,z);p.scale.setScalar(scale);root.add(p);
    box(1.1,1.65,.3,0xf8f2dc,0,.85,0,p);box(1.16,.09,.34,0x309989,0,1.71,0,p);
    box(1.16,.09,.34,0x309989,0,.04,0,p);
    frontLabel(labelTexture('aji',[
      ['Aji',78,65,'#d33e36'],['BÁNH RÁN',154,55,'#fff8df'],['PHA SẴN',204,31,'#fff8df'],
      ['CHEESE',304,48],['PANCAKE MIX',357,32],['150 g',455,42]
    ],'#4da99b','#fff6df'),1.04,1.52,0,.88,.16,p);
    return p;
  }
  function ripePeelTexture(variant){
    const key='ripe-peel-'+variant;if(labelTextures.has(key))return labelTextures.get(key);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
    const base=c.createLinearGradient(0,0,512,0);base.addColorStop(0,'#846027');base.addColorStop(.1,'#e9b93c');base.addColorStop(.5,'#f5ce53');base.addColorStop(.9,'#dfae32');base.addColorStop(1,'#715020');c.fillStyle=base;c.fillRect(0,0,512,256);
    const random=n=>{const v=Math.sin(n*127.1+(variant+1)*311.7)*43758.5453;return v-Math.floor(v);};
    for(let i=0;i<110;i++){
      const x=28+random(i*7)*456,y=12+random(i*7+1)*232,rx=2+random(i*7+2)*13,ry=2+random(i*7+3)*8,angle=random(i*7+4)*Math.PI;
      c.fillStyle=i%4===0?'#795023':'#342319';c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();
      c.fillStyle='#21180f';c.beginPath();c.ellipse(x+rx*.15,y,rx*.63,ry*.66,angle,0,Math.PI*2);c.fill();
    }
    const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;labelTextures.set(key,texture);return texture;
  }
  function banana(parent,peeled=false,variant=0) {
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
    geo.computeVertexNormals();const skin=mesh(geo,peeled?0xffe7a0:0xffffff,0,0,0,g);if(!peeled){skin.material.map=ripePeelTexture(variant);skin.material.roughness=.8;skin.material.needsUpdate=true;}
    if(peeled)return g;
    const stem=box(.14,.3,.14,0x76602c,1,.63,0,g);stem.rotation.z=-.3;
    sphere(.09,0x675030,-1,.22,0,g).scale.set(1,.5,1);
    return g;
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
    const handle=box(.2,.15,1.25,0x7e5034,0,.35,.55,parent);handle.rotation.x=-.22;
    box(.12,.1,.45,0x71848a,0,.27,.05,parent);
    box(.7,.075,.75,0x71848a,0,.2,-.35,parent);
    for(let i=0;i<3;i++)box(.045,.008,.45,0x34454c,-.2+i*.2,.242,-.35,parent);
  }
  function bowl(x=2.1,z=.25){
    const points=[[0,.02],[.6,.02],[.96,.17],[1.3,.65],[1.35,1],[1.28,1.04],[1.21,.67],[.9,.25],[0,.2]].map(([a,b])=>new T.Vector2(a,b));
    mesh(new T.LatheGeometry(points,40),0x80bfc2,x,.16,z);torus(1.315,.055,0xd4ebe2,x,1.19,z);
  }
  function bananaSlot(i,inBowl=false){return inBowl?new T.Vector3(1.55+(i%2)*1.1,.98+Math.floor(i/2)*.1,-.1+Math.floor(i/2)*.7):new T.Vector3(-4.25+(i%2)*2.05,.69,-.4+Math.floor(i/2)*1.5);}
  function foodInBowl(){
    bowl();food.whole=[];food.lumps=[];
    const progress=batch.mash/3,level=.65+batch.mix.filter(Boolean).length*.075+batch.milkMl/100*.07;
    batch.inBowl.forEach((present,i)=>{if(!present)return;const g=new T.Group();root.add(g);g.position.copy(bananaSlot(i,true));g.position.y-=progress*.33;g.scale.set(.48,.48*(1-progress*.82),.48);banana(g,true);g.visible=progress<1;food.whole.push(g);});
    if(batch.inBowl.some(Boolean)){
      food.puree=disc(1.12,.09,0xe3c17d,2.1,level,.25);food.puree.visible=progress>0;
      for(let i=0;i<12;i++){const a=i*2.4,r=.2+(i%4)*.2,q=sphere(.12,0xe6c987,2.1+Math.cos(a)*r,level+.08,.25+Math.sin(a)*r);q.scale.y=.45;q.visible=progress>0;food.lumps.push(q);}
    }
    const packets=batch.mix.filter(Boolean).length;
    if(packets){food.powder=sphere(.36+packets*.12,0xffedce,2.1,level+.07,.25);food.powder.scale.y=.35*(1-Math.min(1,batch.stirs/3));food.powder.visible=batch.stirs<3;}
    if(step>=4&&food.puree){const blend=Math.min(1,batch.stirs/3);food.puree.material.color.copy(new T.Color(0xe3c17d).convertSRGBToLinear()).lerp(new T.Color(0xf0ce89).convertSRGBToLinear(),blend);food.lumps.forEach(q=>q.scale.setScalar(.45*(1-blend)+.04));}
  }
  function masher(parent){
    disc(.1,1.15,0x9b5c36,0,.65,0,parent);disc(.12,.12,0xd4b18d,0,1.24,0,parent);
    for(const x of [-.3,.3])box(.07,.65,.07,0xaebfc1,x,-.08,0,parent);
    const rim=torus(.42,.05,0x9aaeb2,0,-.4,0,parent);rim.scale.z=.8;
    for(let i=0;i<5;i++)box(.65,.035,.035,0xb6c6c7,0,-.4,-.26+i*.13,parent);
  }
  function balloonWhisk(parent){
    disc(.12,.82,0x285c55,0,.59,0,parent);disc(.15,.13,0xa5b9be,0,.15,0,parent);disc(.13,.08,0xc9d9d7,0,1.04,0,parent);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/6,point=(r,y)=>new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
      const curve=new T.CatmullRomCurve3([point(0,.15),point(.34,-.13),point(.28,-.5),point(0,-.74),point(-.28,-.5),point(-.34,-.13),point(0,.15)]);
      mesh(new T.TubeGeometry(curve,36,.023,6,false),0xbdced1,0,0,0,parent,{metalness:.55,roughness:.23});
    }
  }
  function measuringCup(parent,ml,batter=false,empty=false){
    mesh(new T.CylinderGeometry(.5,.42,1.1,32,1,true),0xbce5e8,0,.33,0,parent,{transparent:true,opacity:.37,side:T.DoubleSide});
    torus(.5,.035,0xc4e1df,0,.88,0,parent);disc(.42,.04,0xbcdfe0,0,-.2,0,parent);
    const fill=ml/100*.65;if(!empty)disc(.425,fill,batter?0xe7be77:0xfff8e8,0,-.16+fill/2,0,parent);
    const h=mesh(new T.TorusGeometry(.3,.06,8,20,Math.PI*1.5),0xb7d5d3,-.5,.34,0,parent);h.rotation.z=Math.PI*.25;
    for(let i=1;i<=4;i++)box(.17,.018,.025,0x3e7182,.23,-.14+i*.17,.44,parent);
    frontLabel(labelTexture('cup-'+ml+(batter?'b':'w'),[[String(ml),215,115],['ml',335,95]],'#e5f2e9'),.47,.53,-.08,.3,.493,parent);
  }
  function pan(x=2.1,z=.25){
    box(3,.32,2.75,0x36474c,x,.25,z);box(2.8,.05,2.55,0x1b292b,x,.44,z);
    const burner=torus(1.05,.06,batch.heated?0xb65b36:0x555d60,x,.5,z);food.burner=burner;
    disc(1.15,.13,0x3b464a,x,.58,z);disc(1.04,.025,0x242e31,x,.66,z);torus(1.1,.07,0x657578,x,.68,z);
    box(1.05,.18,.3,0x3d4a4c,x+1.5,.6,z);const knob=disc(.14,.12,0x9babad,x-.9,.31,z+1.44);knob.rotation.x=Math.PI/2;
    if(batch.buttered){const sheen=disc(.85,.008,0xc5ad58,x,.687,z);sheen.material.roughness=.12;sheen.material.transparent=true;sheen.material.opacity=.18;sheen.material.depthWrite=false;food.butter=sheen;}
  }
  function rawPancake(x=2.1,y=.73,z=.25){const g=new T.Group();g.position.set(x,y,z);root.add(g);disc(.75,.055,0xf0d49c,0,0,0,g);return g;}
  function glow(object,r=.55){
    const ring=torus(r,.035,0xffb627,object.position.x,Math.max(.32,object.position.y+.1),object.position.z);ring.material=new T.MeshBasicMaterial({color:0xffc24b,transparent:true,opacity:.9});ring.castShadow=false;ring.receiveShadow=false;glows.push({ring,object,r});
    object.traverse(q=>{if(q.isMesh&&q.material.emissive){q.material.emissive.setHex(0x6c4f12);q.material.emissiveIntensity=.16;}});
    return ring;
  }
  function register(id,object,target,r=.6){const item={id,object,target};items.push(item);if(started&&!busy)item.ring=glow(object,r);}
  function kitchen(){
    box(13,.42,6.8,0xc7ab82,0,-.23,0);box(13,.1,6.8,0xf0d7ad,0,.03,0);box(13,1.5,.14,0xe0ead7,0,.75,-3.1);
    for(let x=-6;x<=6;x++)box(.018,1.5,.16,0xc5d5c1,x,.75,-3.08);for(let y=.1;y<1.5;y+=.65)box(13,.018,.16,0xc5d5c1,0,y,-3.08);
    box(4.35,.12,3.2,0xb98a50,-3.1,.18,.4);box(4.2,.04,3.05,0xe3ba7c,-3.1,.27,.4);box(3.8,.09,3.2,0xd6cbb4,2.1,.16,.25);
    if(step!==3)for(let i=0;i<batch.mix.length;i++)if(!batch.mix[i])packet(-4.8+i*1.35,.12,-2.2,.55);
  }
  function buildScene(){
    dispose();root=new T.Group();scene.add(root);items=[];glows=[];food={};hovered=null;kitchen();
    targetRing=torus(1.42,.045,0x4cbb80,2.1,.3,.25);targetRing.material=new T.MeshBasicMaterial({color:0x43af77,transparent:true,opacity:.85});targetRing.castShadow=false;
    const actions=available(),needs=id=>actions.some(a=>a.id===id);
    if(step<=1){
      if(step===1)foodInBowl();
      for(let i=0;i<4;i++){
        if(step===1&&batch.inBowl[i])continue;
        const g=new T.Group();root.add(g);g.position.copy(bananaSlot(i));g.scale.setScalar(.68);banana(g,batch.peeled[i],i);
        box(1.8,.025,1.1,0xf3dfae,g.position.x,.31,g.position.z);
        if(needs(`banana-${i}`))register(`banana-${i}`,g,step===1?bananaSlot(i,true):new T.Vector3(2.1,.8,.25),.7);
      }
    }
    if(step===2){foodInBowl();const g=new T.Group();root.add(g);g.position.copy(batch.mash>0&&batch.mash<3?new T.Vector3(2.1,1.4-batch.mash*.07,.25):new T.Vector3(-2.8,1.2,.5));masher(g);if(needs('masher'))register('masher',g,new T.Vector3(2.1,1.4-batch.mash*.07,.25));}
    if(step===3){
      box(.7,1.1,.55,0xf5f2de,-4.9,.86,1.35);
      frontLabel(labelTexture('fresh-milk',[['FRESH',160,75],['MILK',280,105],['25 ml',425,60]],'#f3f5e9','#37758c'),.66,.97,-4.9,.87,1.64);
      foodInBowl();for(let i=0;i<batch.mix.length;i++)if(!batch.mix[i]){const p=packet(-4.7+i*1.4,.3,-.65,.75);if(needs(`mix-${i}`))register(`mix-${i}`,p,new T.Vector3(2.1,1.3,.25),.55);}
      if(needs('milk')){const g=new T.Group();root.add(g);g.position.set(-2.1,1,1.35);measuringCup(g,recipe.startingMilkMl);register('milk',g,new T.Vector3(1.45,1.65,.25));}
      food.stream=mesh(new T.CylinderGeometry(.045,.065,1,10),0xfff7e5,2.1,1.4,.25);food.stream.name='ingredient-pour-stream';food.stream.visible=false;
    }
    if(step===4){
      foodInBowl();const g=new T.Group();root.add(g);
      const working=batch.stirs>0&&(batch.stirs<3||batch.needsFinalStir);
      g.position.copy(working?new T.Vector3(2.1,1.5,.25):batch.stirs>=3?new T.Vector3(-4.5,.72,.6):new T.Vector3(-2.8,1.1,.6));
      g.rotation.z=batch.stirs>=3&&!batch.needsFinalStir?Math.PI/2:.14;
      balloonWhisk(g);if(needs('whisk'))register('whisk',g,new T.Vector3(2.1,1.5,.25));
      // Optional milk has its own measured cup and animation, never an invisible adjustment.
      if(batch.stirs>=3&&!batch.needsFinalStir&&batch.milkMl<recipe.reservedMilkMl){const g=new T.Group();root.add(g);g.position.set(-3,1,1.2);measuringCup(g,25);register('extra-milk',g,new T.Vector3(1.45,1.65,.25));food.stream=mesh(new T.CylinderGeometry(.045,.065,1,10),0xfff7e5,2.1,1.4,.25);food.stream.name='ingredient-pour-stream';food.stream.visible=false;}
      food.ribbon=mesh(new T.CylinderGeometry(.035,.055,.6,10),0xe8c789,2.1,1.3,.25);food.ribbon.visible=false;
    }
    if(step>=5&&step<=6){
      pan();
      bowl(-3.2,-.1);disc(1.12,.08,0xebc780,-3.2,.91,-.1);
      if(step===5&&needs('hob')){
        const button=disc(.25,.12,0xeb9758,1.2,.35,1.69);button.rotation.x=Math.PI/2;register('hob',button,null,.38);
      }
      if(step===5&&needs('butter')){const g=new T.Group();root.add(g);g.position.set(-2.7,.66,1.35);box(.45,.28,.4,0xffdf7e,0,0,0,g);register('butter',g,new T.Vector3(2.1,.8,.25),.45);}
      if(batch.poured){const cup=new T.Group();root.add(cup);cup.position.set(-4.8,1,1.4);measuringCup(cup,30,true,true);food.pancake=batch.cooked?pancake(2.1,.8,.25):rawPancake();
        food.bubbles=[];for(let i=0;i<10;i++){const a=i*2.4,r=.18+(i%3)*.17,q=torus(.04,.012,0xbba271,2.1+Math.cos(a)*r,.77,.25+Math.sin(a)*r);q.visible=batch.bubbles;food.bubbles.push(q);}
      }
      if(step===6&&needs('batter-cup')){const g=new T.Group();root.add(g);g.position.set(-2.8,1.2,.7);measuringCup(g,30,true);register('batter-cup',g,new T.Vector3(1.45,1.4,.25));food.stream=mesh(new T.CylinderGeometry(.08,.09,1,10),0xe7c488,2.1,1.1,.25);food.stream.name='ingredient-pour-stream';food.stream.visible=false;food.pourCake=rawPancake();food.pourCake.scale.set(.02,1,.02);}
      if(step===6&&needs('pan'))register('pan',food.pancake,null,.8);
      if(step===6&&needs('spatula')){const g=new T.Group();root.add(g);g.position.set(-2.8,1.1,.7);spatula(g);register('spatula',g,new T.Vector3(2.1,.49,.6),.6);}
    }
    if(step===7){
      pan(-3,.25);bowl(-.3,-1.6);disc(1.12,.08,0xebc780,-.3,.91,-1.6);plate(2.1,.25);food.pancake=pancake(batch.served?2.1:-3,batch.served?.5:.8,.25);
      if(needs('serve')){const g=new T.Group();root.add(g);g.position.set(-3,.49,.6);spatula(g);register('serve',g,new T.Vector3(2.1,.25,.6),.6);}
    }
    renderer.shadowMap.needsUpdate=true;
  }
  function resize(){if(!renderer)return;const v=$('#viewport'),w=v.clientWidth,h=v.clientHeight,halfW=Math.max(w<700?5.7:6.7,3.2*w/h);camera.left=-halfW;camera.right=halfW;camera.top=halfW*h/w;camera.bottom=-halfW*h/w;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  function deformMash(progress){if(food.puree)food.puree.visible=progress>0;food.whole?.forEach((g,i)=>{g.scale.y=.48*(1-progress*.82);g.position.y=bananaSlot(i,true).y-progress*.33;g.visible=progress<1;});food.lumps?.forEach(q=>{q.visible=progress>0;q.scale.y=.45;});}
  function streamFrom(object,local,baseY){if(!food.stream)return;object.updateMatrixWorld(true);const source=local.applyMatrix4(object.matrixWorld);food.stream.position.set(source.x,(source.y+baseY)/2,source.z);food.stream.scale.y=Math.max(.01,source.y-baseY);}
  function frame(now){
    requestAnimationFrame(frame);if(!renderer||now-lastFrame<33)return;lastFrame=now;
    glows.forEach(({ring,object},i)=>{ring.position.set(object.position.x,Math.max(.32,object.position.y+.1),object.position.z);const pulse=reduced?1:1+Math.sin(now*.004+i)*.045;ring.scale.set(pulse,pulse,1);ring.material.opacity=hovered===object?1:.78;});
    if(targetRing)targetRing.material.opacity=drag?1:.65;
    if(animation){const a=animation,t=Math.min(1,(now-a.start)/a.duration),kind=a.action.kind,object=a.item.object;
      const travel=Math.min(1,t/.4),ease=travel*travel*(3-2*travel),work=Math.max(0,(t-.4)/.6);
      if(a.item.target){object.position.lerpVectors(a.from,a.item.target,ease);object.position.y+=Math.sin(travel*Math.PI)*.6;}
      if(kind==='peel'&&work>.25&&!object.userData.opened){object.children[0].visible=false;banana(object,true);for(let i=0;i<3;i++){const c=new T.QuadraticBezierCurve3(new T.Vector3(.8,.3,0),new T.Vector3(.5,-.4,.3),new T.Vector3((i-1)*.6,-.55,.6));mesh(new T.TubeGeometry(c,16,.09,6),0xe6bc3e,0,0,0,object);}object.userData.opened=true;}
      if(kind==='banana')object.scale.setScalar(.68-.2*ease);
      if(kind==='mash'&&work>0){object.position.y=a.item.target.y-Math.abs(Math.sin(work*Math.PI))*.25;deformMash((batch.mash+work)/3);}
      if(['milk','extra-milk','mix','pour'].includes(kind)){
        const flow=kind==='mix'?work>.22&&work<.78:work>.12&&work<.9;
        let local=new T.Vector3(.38,.84,0);
        if(kind==='mix'){
          // Tilt the open end RIGHT, then keep that opening over the bowl centre.
          // Pour only while fully tilted; tipping and returning do not emit powder.
          const ramp=Math.max(0,Math.min(1,work/.18,(1-work)/.18));
          const easeRamp=ramp*ramp*(3-2*ramp);object.rotation.z=-2.05*easeRamp;
          if(work>0){
            const height=1.78*object.scale.y;
            const mouthY=(1.3+height)*(1-easeRamp)+1.7*easeRamp;
            object.position.set(2.1+Math.sin(object.rotation.z)*height,mouthY-Math.cos(object.rotation.z)*height,.25);
            if(!object.userData.opened){box(1.02,.015,.16,0x695b42,0,1.767,0,object);object.userData.opened=true;}
          }
          local=new T.Vector3(0,1.78,0);
        }else object.rotation.z=-Math.sin(work*Math.PI)*.8;
        streamFrom(object,local,kind==='pour'?.76:(food.puree?.position.y||.88)+.06);
        if(food.stream){food.stream.visible=flow;food.stream.material.color.copy(new T.Color(kind==='mix'?0xf7e9c8:kind==='pour'?0xe7c488:0xfff7e5).convertSRGBToLinear());}
        if(kind==='pour'&&food.pourCake){const spread=Math.max(.02,Math.min(1,work*1.2));food.pourCake.scale.set(spread,1,spread);}
      }
      if(kind==='stir'&&work>0){object.position.x+=Math.sin(work*Math.PI*2)*.25;object.position.z+=Math.cos(work*Math.PI*2)*.25;
        const blend=Math.min(1,(batch.stirs+work)/3);if(food.puree)food.puree.material.color.copy(new T.Color(0xe3c17d).convertSRGBToLinear()).lerp(new T.Color(0xf0ce89).convertSRGBToLinear(),blend);
        food.lumps?.forEach(q=>q.scale.setScalar(.45*(1-blend)+.04));if(food.powder){food.powder.scale.y=.35*(1-blend);food.powder.visible=blend<.99;}if(food.ribbon)food.ribbon.visible=blend>.85;
      }
      if(kind==='heat'&&food.burner)food.burner.material.color.copy(new T.Color(0x555d60).convertSRGBToLinear()).lerp(new T.Color(0xb65b36).convertSRGBToLinear(),t);
      if(kind==='butter'&&work>0){object.scale.set(1+work*.8,1-work*.9,1+work*.8);object.position.y=.83-work*.12;}
      if(kind==='wait')food.bubbles?.forEach((q,i)=>{q.visible=t>i/12;q.scale.setScalar(.7+Math.sin(t*5+i)*.15);});
      if(kind==='flip'&&work>0&&food.pancake){const flip=Math.max(0,Math.min(1,(work-.1)/.8));food.pancake.position.y=.8+Math.sin(flip*Math.PI)*.8;food.pancake.rotation.x=Math.PI*flip;}
      if(kind==='serve'&&food.pancake){food.pancake.position.lerpVectors(new T.Vector3(-3,.8,.25),new T.Vector3(2.1,.5,.25),ease);food.pancake.position.y+=Math.sin(travel*Math.PI)*.5;}
      if(t===1)a.finish();
    }
    renderer.render(scene,camera);
  }
  function initGraphics(){
    renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputEncoding=T.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#viewport').append(renderer.domElement);
    scene=new T.Scene();scene.background=new T.Color(0xdce7d7);scene.add(new T.HemisphereLight(0xffffff,0x728666,.85));const light=new T.DirectionalLight(0xffefd6,1.05);light.position.set(-4,9,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-8,right:8,top:7,bottom:-7});light.shadow.bias=-.001;light.shadow.normalBias=.025;scene.add(light);const fill=new T.DirectionalLight(0xd5ecff,.4);fill.position.set(5,4,-3);scene.add(fill);
    camera=new T.OrthographicCamera(-7,7,5,-5,.1,100);camera.position.set(0,6.8,10.8);camera.lookAt(0,.6,0);resize();new ResizeObserver(resize).observe($('#viewport'));
    const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-1),canvas=renderer.domElement;
    function ground(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(plane,new T.Vector3());}
    function pick(){return items.flatMap(item=>[...ray.intersectObject(item.object,true),...(item.ring?ray.intersectObject(item.ring):[])].map(hit=>({item,distance:hit.distance}))).sort((a,b)=>a.distance-b.distance)[0]?.item;}
    canvas.onpointerdown=e=>{if(e.button!==0||busy||!started)return;const p=ground(e),item=pick();if(!p||!item)return;drag={item,pointerId:e.pointerId,origin:item.object.position.clone(),offset:item.object.position.clone().sub(p),x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';};
    canvas.onpointermove=e=>{const p=ground(e);if(drag){drag.moved ||= Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7;if(p&&drag.item.target)drag.item.object.position.copy(p.add(drag.offset));return;}hovered=!busy&&started?pick()?.object:null;canvas.style.cursor=hovered?'pointer':'default';};
    canvas.onpointerup=e=>{if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='pointer';const good=!d.moved||!d.item.target||(Math.abs(d.item.object.position.x-2.1)<1.45&&Math.abs(d.item.object.position.z-.25)<1.5);if(good)perform(d.item.id);else{d.item.object.position.copy(d.origin);message('Drop in the green ring.',true);}};
    canvas.onpointercancel=()=>{if(drag){drag.item.object.position.copy(drag.origin);drag=null;}};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancel();renderer=null;$('#fallback').hidden=false;controls();message('Use the big buttons to continue.');});requestAnimationFrame(frame);
  }
  $('#start').onclick=()=>{started=true;render();};$('#action').onclick=()=>perform();$('#extra-milk').onclick=()=>perform('extra-milk');
  $('#next').onclick=()=>{if(!started||busy)return;if(!done()){message('Finish this step first.',true);return;}if(step===7){message('Batch finished! Repeat the real cooking as needed; the demonstration is complete.');return;}step++;render();};
  $('#back').onclick=()=>{if(step>0){step--;render();}};$('#replay').onclick=()=>{if(!started||busy)return;resetFrom(step);render('This step and later steps have been reset.');};$('#restart').onclick=()=>{batch=fresh();step=0;started=false;render();};
  $('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));chime();};
  $('#kitchen-only').onclick=()=>{const on=document.body.classList.toggle('kitchen-focus');$('#kitchen-only').textContent=on?'Show lesson':'Big kitchen';$('#kitchen-only').setAttribute('aria-pressed',String(on));resize();};
  $('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('Use your browser’s full-screen command.',true);}catch{message('Use your browser’s full-screen command.',true);}};
  document.addEventListener('keydown',e=>{if(e.target.closest('button,input,a,summary'))return;if(e.key==='ArrowRight')$('#next').click();if(e.key==='ArrowLeft')$('#back').click();});window.addEventListener('resize',resize);
  try{if(!T)throw Error('Missing Three.js');initGraphics();}catch{renderer=null;$('#fallback').hidden=false;}render();
})();
