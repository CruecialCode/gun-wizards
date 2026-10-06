#!/usr/bin/env python3
"""Prepare and serve the downloaded local reference with bounded GPU capture hooks."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, json, re, shutil, urllib.parse
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8790);a=p.parse_args()
 source=ROOT/'.local/dark-veil';site=source/'capture-site';out=source/'gpu-capture';site.mkdir(exist_ok=True);out.mkdir(exist_ok=True)
 for name in ['loader.js','darkveil.js','style.css','menu-skull.js','menu-skull.json','menu-skull.png','wasm-loader.js','fonts','snippets','music','favicon.ico']:
  src=source/name;target=site/name
  if not src.exists():raise SystemExit('Missing reference assets; run python3 tools/fetch-darkveil-reference.py first')
  if src.is_dir():shutil.copytree(src,target,dirs_exist_ok=True)
  else:shutil.copyfile(src,target)
 for src,target in [('wasm.json','darkveil-wasm.json'),('part0.wasm','darkveil_bg.0.wasm'),('part1.wasm','darkveil_bg.1.wasm')]:shutil.copyfile(source/src,site/target)
 # Authored minimal local shell; no upstream challenge code or account routes.
 (site/'index.html').write_text('''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"><script src="capture.js"></script></head><body><canvas id="darkveil-canvas" width="1280" height="800" tabindex="0"></canvas><div id="darkveil-status"><div class="loading-card"><canvas id="loading-skull" width="480" height="360"></canvas><h1>DARK VEIL</h1><p id="darkveil-message">Loading local reference</p><button id="darkveil-retry" hidden>TRY AGAIN</button></div></div><script type="module" src="loader.js?v=c3b283d68d282a7a9ed4"></script></body></html>''')
 # Observe existing public bridge arguments without changing return values/input.
 bridge=site/'snippets/darkveil-4615b08805223d8d/web'
 patches={
  'input.js':('    input?.update(mode, enabled, targets, logical_width, logical_height, keyboard_captured);', '    Object.assign(globalThis.darkVeilObservation ?? {}, {phase:mode,inputEnabled:enabled,menuTargets:Array.from(targets),logicalSize:[logical_width,logical_height],keyboardCaptured:keyboard_captured});'),
  'touch.js':('    controller?.update(mode, enabled, preference, sensitivity, stats);', '    Object.assign(globalThis.darkVeilObservation ?? {}, {touchStats:Object.fromEntries(["spellCooldown","mana","spellCost","dashCooldown","stamina","dashCost","jumpCost","meleeCost","usesAmmunition","meleeWeapon"].map((name,i)=>[name,stats[i] ?? null]))});')}
 for name,(anchor,hook) in patches.items():
  path=bridge/name;text=path.read_text()
  if anchor not in text:raise SystemExit('Reference bridge changed; inspect before instrumenting '+name)
  path.write_text(text.replace(anchor,hook+'\n'+anchor))
 shutil.copyfile(ROOT/'tools/capture-darkveil-gpu.js',site/'capture.js')
 class Handler(SimpleHTTPRequestHandler):
  def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(site),**kwargs)
  def do_GET(self):
   if urllib.parse.urlsplit(self.path).path=="/observation.json":
    path=out/"observation.json"
    if not path.exists():self.send_error(404);return
    blob=path.read_bytes();self.send_response(200);self.send_header("Content-Type","application/json");self.send_header("Cache-Control","no-store");self.end_headers();self.wfile.write(blob);return
   super().do_GET()
  def do_POST(self):
   query=urllib.parse.urlsplit(self.path);name=urllib.parse.parse_qs(query.query).get('name',[''])[0]
   try:length=int(self.headers.get('Content-Length','0'))
   except ValueError:self.send_error(400);return
   origin=self.headers.get('Origin')
   if origin and origin not in [f'http://127.0.0.1:{a.port}',f'http://localhost:{a.port}']:self.send_error(403);return
   if query.path!='/capture' or not re.fullmatch(r'[a-zA-Z0-9_.-]+',name) or not 0<=length<=70*1024*1024:self.send_error(400);return
   try:meta=json.loads(urllib.parse.unquote(self.headers.get('X-Capture-Metadata','%7B%7D')))
   except ValueError:self.send_error(400);return
   (out/name).write_bytes(self.rfile.read(length));(out/(name+'.meta.json')).write_text(json.dumps(meta,indent=2))
   self.send_response(200);self.end_headers();self.wfile.write(b'OK')
 print(f'Local reference: http://127.0.0.1:{a.port}; capture outputs: {out}',flush=True)
 ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
if __name__=='__main__':main()
