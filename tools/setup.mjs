import {spawnSync} from 'node:child_process';
if(Number(process.versions.node.split('.')[0])<22)throw new Error('Install Node.js 22 or newer, then run npm run setup again.');
for(const args of [['ci'],['ci','--prefix','server/spacetimedb']]){const r=spawnSync('npm',args,{stdio:'inherit',shell:process.platform==='win32'});if(r.status)process.exit(r.status??1);}
const cli=spawnSync('spacetime',['--version'],{encoding:'utf8'});
console.log(cli.status===0?cli.stdout:'Install SpacetimeDB CLI 2.10.2 from https://spacetimedb.com/docs/');
console.log('Ready. Terminal 1: npm run server:start\nTerminal 2: npm run server:publish && npm run dev');
