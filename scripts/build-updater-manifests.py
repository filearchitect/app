#!/usr/bin/env python3
"""Build the current updater feed and preserve the final legacy-client feed."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

version = sys.argv[1].removeprefix('v')
if not re.fullmatch(r'\d+\.\d+\.\d+', version) or tuple(map(int, version.split('.'))) < (0, 13, 0):
    raise SystemExit('The Intel transition policy requires version 0.13.0 or newer')
repo = 'filearchitect/app'
bridge = '0.13.0'
arches = ['darwin-aarch64'] + (['darwin-x86_64'] if version == bridge else [])
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    platforms = {}
    for arch in arches:
        asset = f'filearchitect_{version}_{arch}.app.tar.gz'
        subprocess.run(['gh', 'release', 'download', f'v{version}', '--repo', repo,
                        '--pattern', asset + '.sig', '--dir', directory], check=True)
        platforms[arch] = {'url': f'https://github.com/{repo}/releases/download/v{version}/{asset}',
                           'signature': (root / (asset + '.sig')).read_text().strip()}
        if not platforms[arch]['signature']:
            raise SystemExit('Empty updater signature')
    current = {'version': version, 'notes': '', 'platforms': platforms}
    Path('apple-silicon.json').write_text(json.dumps(current, indent=2) + '\n')
    if version == bridge:
        legacy = current
    else:
        subprocess.run(['gh', 'release', 'download', f'v{bridge}', '--repo', repo,
                        '--pattern', 'latest.json', '--dir', directory], check=True)
        legacy = json.loads((root / 'latest.json').read_text())
        if legacy.get('version') != bridge or sorted(legacy.get('platforms', {})) != ['darwin-aarch64', 'darwin-x86_64']:
            raise SystemExit('Invalid final legacy feed; refusing to strand old clients')
    Path('latest.json').write_text(json.dumps(legacy, indent=2) + '\n')
