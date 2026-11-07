import {writeFileSync,readFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const S=process.argv[2]+'/h';
mkdirSync(S,{recursive:true});
const B='/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/build.mjs';
const cases={
 jsurl:{name:'X',projects:[{title:'T',url:'javascript:alert(1)'}]},
 pstr:{name:'X',projects:'nope'},
 pnull:{name:'X',projects:[null]},
 notitle:{name:'X',projects:[{summary:'s'}]},
 name0:{name:0},
 namefalse:{name:false},
 arr:[],
 contactstr:{name:'X',contact:'str'},
 noemail:{name:'X'},
 wsurl:{name:'X',projects:[{title:'T',url:'  '}]},
 aboutarr:{name:'X',about:['a','b']},
 tagobj:{name:'X',tagline:{a:1}},
 emailquote:{name:'X',contact:{email:'a"b@x'}},
 nameWS:{name:'   '},
 emptyemail:{name:'X',contact:{email:''}},
 ctrl:{name:'\u0000‮😀'},
};
for(const [k,v] of Object.entries(cases)){
 writeFileSync(`${S}/${k}.json`,JSON.stringify(v));
 const r=spawnSync('node',[B],{env:{...process.env,CONTENT_FILE:`${S}/${k}.json`,OUT_DIR:`${S}/out-${k}`},encoding:'utf8'});
 const f=`${S}/out-${k}/index.html`;
 const h=existsSync(f)?readFileSync(f,'utf8'):null;
 console.log('==',k,'exit',r.status,(r.stderr||'').trim().slice(0,200));
 if(h){console.log(h.split('\n').filter(x=>/href|article|<h1|<title/.test(x)).join('\n'));}
}
writeFileSync(`${S}/bom.json`,'﻿{"name":"X"}');
let r=spawnSync('node',[B],{env:{...process.env,CONTENT_FILE:`${S}/bom.json`,OUT_DIR:`${S}/out-bom`},encoding:'utf8');console.log('== bom',r.status,r.stderr.trim());
r=spawnSync('node',[B],{env:{...process.env,CONTENT_FILE:`${S}/`,OUT_DIR:`${S}/out-dir`},encoding:'utf8');console.log('== dir',r.status,r.stderr.trim());
r=spawnSync('node',[B],{env:{...process.env,CONTENT_FILE:`${S}/pnull.json`,OUT_DIR:`${S}/bom.json`},encoding:'utf8');console.log('== outdir is file',r.status,r.stderr.trim().slice(0,200));
