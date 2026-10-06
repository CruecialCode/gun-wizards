#!/usr/bin/env python3
"""Recover validated PNG/RIFF/sfnt payloads from the supplied public Wasm artifact.
Output remains private reference material, never implicitly relicensed by this repo.
Requires Pillow for image validation/contact sheet; does not execute downloaded code.
"""
import argparse, hashlib, io, json, struct, zlib
from pathlib import Path
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('wasm', type=Path)
p.add_argument('--out', type=Path, default=Path('.local/dark-veil/recovered'))
a = p.parse_args(); data = a.wasm.read_bytes(); a.out.mkdir(parents=True, exist_ok=True)
records=[]
def save(start, end, kind, metadata=None):
    blob=data[start:end]; name=f'{kind}-{start:08x}.{kind}'
    (a.out/name).write_bytes(blob)
    records.append(dict(file=name, offset=start, size=len(blob), sha256=hashlib.sha256(blob).hexdigest(), **(metadata or {})))
def hits(signature):
    pos=0
    while True:
        pos=data.find(signature,pos)
        if pos<0: return
        yield pos
        pos+=len(signature)
for start in hits(b'\x89PNG\r\n\x1a\n'):
    try:
        cur=start+8
        while True:
            size=struct.unpack_from('>I',data,cur)[0]; tag=data[cur+4:cur+8]
            if size>64*1024*1024 or cur+12+size>len(data): raise ValueError()
            if zlib.crc32(data[cur+4:cur+8+size]) != struct.unpack_from('>I',data,cur+8+size)[0]: raise ValueError()
            cur+=12+size
            if tag==b'IEND': break
        im=Image.open(io.BytesIO(data[start:cur])); im.load()
        save(start,cur,'png',dict(width=im.width,height=im.height,mode=im.mode))
    except Exception: pass
for start in hits(b'RIFF'):
    try:
        size=struct.unpack_from('<I',data,start+4)[0]; end=start+size+8; kind=data[start+8:start+12]
        if end>len(data) or size<4: continue
        if kind==b'WEBP':
            im=Image.open(io.BytesIO(data[start:end])); im.load()
            save(start,end,'webp',dict(width=im.width,height=im.height,mode=im.mode))
        elif kind==b'WAVE':
            import wave
            with wave.open(io.BytesIO(data[start:end])) as w:
                meta=dict(channels=w.getnchannels(),sample_rate=w.getframerate(),frames=w.getnframes(),seconds=w.getnframes()/w.getframerate())
            save(start,end,'wav',meta)
    except Exception: pass
for start in hits(b'\x00\x01\x00\x00'):
    try:
        count=struct.unpack_from('>H',data,start+4)[0]
        if not 5<=count<=50: continue
        tables={}; end=12+16*count
        for i in range(count):
            tag,checksum,offset,size=struct.unpack_from('>4sIII',data,start+12+16*i)
            if any(c<32 or c>126 for c in tag) or offset<12+16*count or size>8_000_000 or start+offset+size>len(data): raise ValueError()
            tables[tag]=(offset,size); end=max(end,offset+size)
        if not {b'head',b'name',b'cmap',b'maxp'}.issubset(tables): continue
        head=tables[b'head'][0]
        if struct.unpack_from('>I',data,start+head+12)[0]!=0x5f0f3cf5: continue
        save(start,start+end,'ttf',dict(tables=[t.decode() for t in tables]))
    except Exception: pass
manifest=dict(source=str(a.wasm),source_sha256=hashlib.sha256(data).hexdigest(),assets=records)
(a.out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
images=[r for r in records if r['file'].endswith(('.png','.webp'))]
sheet=Image.new('RGB',(1000,((len(images)+3)//4)*230),'#282524'); draw=ImageDraw.Draw(sheet)
for i,r in enumerate(images):
    im=Image.open(a.out/r['file']).convert('RGBA'); im.thumbnail((240,190))
    x=(i%4)*250+(250-im.width)//2;y=(i//4)*230
    sheet.paste(im,(x,y),im);draw.text(((i%4)*250+5,y+192),r['file'],fill='white');draw.text(((i%4)*250+5,y+209),f"{r['width']} x {r['height']}",fill='white')
sheet.save(a.out/'contact-sheet.jpg')
print(json.dumps(manifest,indent=2))
