#!/usr/bin/env python3
"""Fetch only the pinned public Dark Veil assets for local reference use.
Standard library only. Never executes upstream scripts or follows foreign redirects.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://dark-veil.dimillian.chatgpt.site'
LOCK = ROOT / 'docs/reference/darkveil-assets.lock.json'
COPY = {
    'fonts/Rye.ttf': 'Rye.ttf',
    'recovered/ttf-010e5d3e.ttf': 'Cinzel.ttf',
    'recovered/png-0061d1db.png': 'cards.png',
    'recovered/png-00a7afa4.png': 'table.png',
    'recovered/png-015f8958.png': 'items.png',
    'recovered/png-01846993.png': 'revolver.png',
    **{n: n for n in ['menu-skull.js', 'menu-skull.json', 'menu-skull.png']},
    **{f'music/{n}.mp3': f'{n}.mp3' for n in ['blackpowder', 'iron-hunger', 'house-of-debts']},
}

class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if f'{parsed.scheme}://{parsed.netloc}' != ORIGIN:
            raise RuntimeError('Refusing redirect outside the pinned reference origin')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def verify(blob, record):
    if len(blob) != record['size'] or hashlib.sha256(blob).hexdigest() != record['sha256']:
        raise RuntimeError(f"Reference drift or corrupted cache: {record['file']}. Do not update hashes blindly; inspect the new version first.")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Require verified cached downloads; never contact the network')
    args = parser.parse_args()
    lock = json.loads(LOCK.read_text())
    cache = ROOT / '.local/dark-veil'
    cache.mkdir(parents=True, exist_ok=True)
    # Respect SSL_CERT_FILE for Python installations without a populated system bundle.
    system_bundle = Path("/etc/ssl/cert.pem")
    context = ssl.create_default_context(cafile=str(system_bundle) if system_bundle.exists() and not os.environ.get("SSL_CERT_FILE") else None)
    opener = urllib.request.build_opener(SameOriginRedirect(), urllib.request.HTTPSHandler(context=context))
    for record in lock['assets']:
        target = cache / record['file']
        if target.exists():
            verify(target.read_bytes(), record)
            continue
        if args.offline:
            raise RuntimeError(f"Missing cached asset: {record['file']}; rerun without --offline")
        url = record['url']
        parsed = urllib.parse.urlsplit(url)
        if f'{parsed.scheme}://{parsed.netloc}' != ORIGIN:
            raise RuntimeError('Manifest contains an unapproved origin')
        request = urllib.request.Request(url + '?v=' + lock['version'], headers={'User-Agent': 'curl/8.7.1'})
        with opener.open(request, timeout=60) as response:
            blob = response.read(record['size'] + 1)
        verify(blob, record)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + '.partial')
        temporary.write_bytes(blob)
        os.replace(temporary, target)
        print('Downloaded', record['file'])
    wasm = (cache / 'part0.wasm').read_bytes() + (cache / 'part1.wasm').read_bytes()
    expected = lock['embedded']['source_sha256']
    if hashlib.sha256(wasm).hexdigest() != expected:
        raise RuntimeError('Combined Wasm hash mismatch')
    (cache / 'reference.wasm').write_bytes(wasm)
    recovered = cache / 'recovered'
    recovered.mkdir(exist_ok=True)
    # Exact verified ranges make a fresh standard-library-only setup possible.
    # The independent format-aware recovery tool additionally builds a contact sheet
    # when Pillow is available; all its output is checked against this locked inventory.
    for record in lock['embedded']['assets']:
        blob = wasm[record['offset']:record['offset'] + record['size']]
        verify(blob, record)
        (recovered / record['file']).write_bytes(blob)
    (recovered / 'manifest.json').write_text(json.dumps(lock['embedded'], indent=2) + '\n')
    if importlib.util.find_spec('PIL') is not None:
        subprocess.run([sys.executable, str(ROOT / 'tools/recover-darkveil-assets.py'), str(cache / 'reference.wasm'), '--out', str(recovered)], check=True, stdout=subprocess.DEVNULL)
        for record in lock['embedded']['assets']:
            verify((recovered / record['file']).read_bytes(), record)
    destination = ROOT / 'rust/web/reference-assets'
    destination.mkdir(parents=True, exist_ok=True)
    for source, name in COPY.items():
        shutil.copyfile(cache / source, destination / name)
    (destination / 'PROVENANCE.txt').write_text(
        'Dark Veil public reference assets, retrieved 2026-10-06.\n'
        + ORIGIN + '/\nVersion: ' + lock['version']
        + '\nLocal reconstruction only. Upstream redistribution license is not established; '
        'these assets are not covered by this repository MIT license.\n'
        'Hashes and source mapping: docs/reference/darkveil-assets.lock.json\n')
    print(f"Verified {len(lock['assets'])} downloads and {len(lock['embedded']['assets'])} embedded resources; prepared {len(COPY)} local runtime assets.")

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, urllib.error.URLError) as error:
        sys.exit(f'Reference setup failed: {error}')
