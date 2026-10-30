const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=__dirname;
let saving=false;
http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin && origin!=='http://localhost:4173' && origin!=='http://127.0.0.1:4173'){res.writeHead(403).end('Origin not allowed');return;}
  if(req.url==='/api/studio'){res.writeHead(200,{'Content-Type':'application/json'}).end('{}');return;}
  if(req.url==='/api/approve' && req.method==='POST'){
    if(saving){res.writeHead(409).end('A recording is already being saved.');return;}
    saving=true;
    try{
      const type=req.headers['content-type']||'';
      const extension=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':type.includes('webm')?'webm':null;
      if(!extension) throw new Error('Unsupported recording format.');
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024)throw new Error('Please keep recordings below 25 MB.');chunks.push(chunk);}
      if(!size)throw new Error('The recording was empty.');
      const audio=`blessing.${extension}`;
      fs.writeFileSync(path.join(root,audio),Buffer.concat(chunks));
      fs.writeFileSync(path.join(root,'blessing.json'),JSON.stringify({audio},null,2)+'\n');
      const git=args=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
      git(['add',audio,'blessing.json']);
      if(git(['diff','--cached','--name-only']).toString().trim())git(['commit','-m','Save approved tallit blessing recording']);
      git(['push','origin','main']);
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({audio}));
    }catch(error){res.writeHead(500,{'Content-Type':'text/plain'}).end(error.message);}finally{saving=false;}return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const name=pathname==='/'?'index.html':pathname.slice(1);
  if(!/^(index\.html|app\.js|blessing\.json|blessing\.(webm|m4a|ogg))$/.test(name)){res.writeHead(404).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webm':'audio/webm','.m4a':'audio/mp4','.ogg':'audio/ogg'};
  fs.readFile(path.join(root,name),(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store'}).end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('Recording studio: http://127.0.0.1:4173'));
