const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('Each image records, previews and publishes to its own endpoint',async()=>{
  const elements=new Map(), studios=new Map(), posts=[], contexts=[], audioPlayers=[];
  function element(){return {hidden:true,disabled:false,src:'',paused:true,append(){},setAttribute(){},scrollIntoView(){},load(){},click(){return this.onclick();},pause(){this.paused=true;},async play(){this.paused=false;},getAttribute(name){return this[name]||null;}};}
  for(const id of ['tallit','neshama','torah','learning']){
    elements.set(id,element());
    const controls=new Map();
    const studio={...element(),querySelector(selector){const name=selector.match(/"([^"]+)"/)[1];if(!controls.has(name))controls.set(name,element());return controls.get(name);}};
    studios.set(id,{studio,controls,append(){},querySelector(){return studio;}});
  }
  class Context{
    constructor(){this.sampleRate=48000;this.state='running';contexts.push(this);}
    async resume(){} close(){this.state='closed';}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createScriptProcessor(){return this.processor={connect(){},disconnect(){}};}
  }
  const sandbox={Audio:class {constructor(){Object.assign(this,element());audioPlayers.push(this);}},document:{getElementById(id){return id==='recorder-template'?{content:{cloneNode(){return {};}}}:elements.get(id);},querySelector(selector){return studios.get(selector.match(/"([^"]+)"/)[1]);},querySelectorAll(){return [...studios.values()].flatMap(s=>[s.controls.get('review')]).filter(Boolean);}},location:{hostname:'127.0.0.1'},window:{AudioContext:Context},navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){}}];}};}}},fetch:async(url,options)=>{
    if(options?.method==='POST'){posts.push({url,body:options.body});return {ok:true,json:async()=>({audio:url+'.wav'})};}
    if(url==='/api/studio')return {ok:true};
    if(url==='blessing.json')return {ok:true,json:async()=>({audio:'blessing.wav'})};
    return {ok:false};
  },Blob,ArrayBuffer,DataView,Float32Array,Date,Math,URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},setInterval(){return 1;},clearInterval(){}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(studios.get('tallit').studio.hidden,true,'Existing tallit recording remains approved');
  assert.equal(studios.get('neshama').studio.hidden,false);
  for(const id of ['neshama','torah','learning']){
    const {controls,studio}=studios.get(id);
    await controls.get('record').onclick();
    const processor=contexts.at(-1).processor;
    const data=new Float32Array([-.5,0,.5]);
    processor.onaudioprocess({inputBuffer:{getChannelData:()=>data},outputBuffer:{getChannelData:()=>new Float32Array(3)}});
    controls.get('stop').onclick();
    assert.equal(controls.get('review').hidden,false);
    await controls.get('listen').onclick();
    assert.equal(controls.get('review').paused,false);
    await controls.get('approve').onclick();
    assert.equal(studio.hidden,true);
    const saved=posts.at(-1);
    assert.equal(saved.url,`/api/approve/${id}`);
    const wav=Buffer.from(await saved.body.arrayBuffer());
    assert.equal(wav.toString('ascii',0,4),'RIFF');
    assert.equal(wav.readUInt32LE(40),6);
  }
  assert.equal(posts.length,3);
  for(const [index,id] of ['tallit','neshama','torah','learning'].entries()){
    const button=elements.get(id), player=audioPlayers[index];
    await button.onclick();
    assert.equal(player.paused,false,`${id}: click plays`);
    player.currentTime=5;
    await button.onclick();
    assert.equal(player.paused,true,`${id}: second click pauses`);
    assert.equal(player.currentTime,5,`${id}: pause retains position`);
    await button.onclick();
    assert.equal(player.paused,false,`${id}: click resumes`);
    button.onmouseleave();
    assert.equal(player.paused,true,`${id}: mouse leave stops`);
    assert.equal(player.currentTime,0,`${id}: mouse leave resets`);
    await button.onclick();
    assert.equal(player.currentTime,0,`${id}: next play starts at beginning`);
    await button.onclick();
    player.currentTime=8;
    button.onmouseleave();
    assert.equal(player.currentTime,0,`${id}: leaving while paused also resets`);
  }
});
