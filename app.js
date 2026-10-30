const $ = id => document.getElementById(id);
const player = new Audio();
let recorder, stream, chunks = [], recording, previewURL, localStudio = false;
let recordingStarted = 0, recordingTimer;
function releaseMicrophone() {
  clearInterval(recordingTimer);
  stream?.getTracks().forEach(track => track.stop());
  $('record').disabled = false;
  $('stop').disabled = true;
}
async function initialize() {
  try {
    const response = await fetch('blessing.json', {cache:'no-store'});
    if (response.ok) {const config = await response.json(); player.src = config.audio;}
  } catch {}
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    try {localStudio = (await fetch('/api/studio')).ok;} catch {}
  }
  if (!player.getAttribute('src')) {
    $('status').textContent = 'The blessing is waiting for your voice.';
    $('studio').hidden = !localStudio;
    if (!localStudio) $('status').textContent = 'The personal blessing will be available soon.';
  }
}
$('tallit').onclick = async () => {
  if (!player.getAttribute('src')) {if(localStudio) $('studio').scrollIntoView({behavior:'smooth'}); return;}
  if (!player.paused) {player.pause(); return;}
  try {await player.play();} catch {$('status').textContent = 'Unable to play the blessing. Please try again.';}
};
player.onplay = () => {$('play-icon').textContent='Ⅱ'; $('play-label').textContent='PAUSE THE BLESSING'; $('tallit').setAttribute('aria-label','Pause the tallit blessing'); $('status').textContent='Listening to the blessing…';};
function stopped(){ $('play-icon').textContent='▶'; $('play-label').textContent='LISTEN TO THE BLESSING'; $('tallit').setAttribute('aria-label','Play the tallit blessing'); $('status').textContent='Touch the tallit whenever you’re ready.'; }
player.onpause=stopped; player.onended=stopped;
$('record').onclick = async () => {
  $('record').disabled=true;
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Please use a browser that supports microphone recording, such as Chrome or Edge.');
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    player.pause(); chunks=[];
    const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
    recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
    recorder.onstop=()=>{
      releaseMicrophone();
      recording=new Blob(chunks,{type:recorder.mimeType || chunks[0]?.type || 'audio/webm'});
      if(!recording.size) {
        $('recording-state').textContent='No audio was captured. Please check your microphone and record again for a few seconds.';
        return;
      }
      if(previewURL) URL.revokeObjectURL(previewURL);
      previewURL=URL.createObjectURL(recording); $('review').src=previewURL;
      $('review').load();
      $('review').hidden=false; $('approval').hidden=false; $('record').disabled=false; $('stop').disabled=true;
      $('listen').hidden=false;
      $('recording-state').textContent='Listen back. Keep this take or record again.';
      $('listen').scrollIntoView({behavior:'smooth',block:'center'});
    };
    recorder.onerror=event=>{releaseMicrophone(); $('recording-state').textContent='Recording failed: '+(event.error?.message || 'Please try recording again.');};
    recorder.start(250); recordingStarted=Date.now();
    recordingTimer=setInterval(()=>{$('recording-state').textContent=`● Recording — ${Math.floor((Date.now()-recordingStarted)/1000)} seconds. Press Stop when finished.`;},1000);
    $('record').disabled=true; $('stop').disabled=false; $('approval').hidden=true; $('review').hidden=true; $('listen').hidden=true;
    $('recording-state').textContent='● Recording — say the blessing, then press Stop.';
  } catch(error){releaseMicrophone(); $('recording-state').textContent=error.name==='NotAllowedError'?'Allow microphone access, then try again.':error.message;}
};
$('stop').onclick=()=>{
  if(recorder?.state==='recording') {
    clearInterval(recordingTimer); $('stop').disabled=true;
    $('recording-state').textContent='Preparing your recording for playback…';
    recorder.requestData(); recorder.stop();
  }
};
$('listen').onclick=async()=>{
  try {await $('review').play(); $('recording-state').textContent='Playing your recording…';}
  catch(error){$('recording-state').textContent='Playback failed: '+error.message+'. Please record another take.';}
};
$('review').onended=()=>{$('recording-state').textContent='Keep this take or record again.';};
$('review').onerror=()=>{$('recording-state').textContent='This browser could not play the recording. Please try another take in Chrome or Edge.';};
$('retry').onclick=()=>{$('review').pause(); $('record').click();};
$('approve').onclick=async()=>{
  if(!recording?.size) return;
  $('approve').disabled=true; $('retry').disabled=true; $('record').disabled=true;
  $('recording-state').textContent='Saving and publishing your blessing…';
  try {
    const response=await fetch('/api/approve',{method:'POST',headers:{'Content-Type':recording.type},body:recording});
    if(!response.ok) throw new Error(await response.text());
    const result=await response.json();
    $('review').pause(); player.src=result.audio; $('studio').hidden=true;
    $('status').textContent='Your blessing is saved. Touch the tallit to listen. The public site updates in a few minutes.';
  } catch(error){$('recording-state').textContent='Publishing needs another try: '+error.message; $('approve').disabled=false; $('retry').disabled=false; $('record').disabled=false;}
};
initialize();
