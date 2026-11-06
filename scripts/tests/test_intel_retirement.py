"""Verify old clients stay on the bridge while Apple Silicon advances."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
MOCK = r'''#!/usr/bin/env python3
import json,sys
from pathlib import Path
args=sys.argv[1:]; out=Path(args[args.index('--dir')+1]); name=args[args.index('--pattern')+1]
if name=='latest.json':
    data={'version':'0.13.0','platforms':{arch:{'signature':'signature','url':f'https://github.com/filearchitect/app/releases/download/v0.13.0/filearchitect_0.13.0_{arch}.app.tar.gz'} for arch in ['darwin-aarch64','darwin-x86_64']}}
    (out/name).write_text(json.dumps(data))
else: (out/name).write_text('signature')
'''

class IntelRetirementTests(unittest.TestCase):
    def generate(self, version):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'bin').mkdir()
            gh=root/'bin/gh'; gh.write_text(MOCK); gh.chmod(0o755)
            subprocess.run(['python3',str(SCRIPTS/'build-updater-manifests.py'),version],cwd=root,
                           env=dict(os.environ,PATH=str(root/'bin')+os.pathsep+os.environ['PATH']),check=True)
            return json.loads((root/'latest.json').read_text()),json.loads((root/'apple-silicon.json').read_text())

    def test_bridge_serves_both_architectures_to_old_clients(self):
        legacy,current=self.generate('0.13.0')
        self.assertEqual(legacy,current)
        self.assertEqual(sorted(current['platforms']),['darwin-aarch64','darwin-x86_64'])

    def test_future_release_preserves_bridge_and_builds_only_arm(self):
        legacy,current=self.generate('0.13.1')
        self.assertEqual(legacy['version'],'0.13.0')
        self.assertEqual(current['version'],'0.13.1')
        self.assertEqual(list(current['platforms']),['darwin-aarch64'])
        self.assertIn('/v0.13.0/',legacy['platforms']['darwin-x86_64']['url'])
        names=subprocess.check_output(['bash','-c','VERSION=0.13.1; source "$1"; printf "%s\\n" "${NAMES[@]}"','bash',str(SCRIPTS/'release-policy.sh')],text=True)
        self.assertNotIn('darwin-x86_64',names)
        self.assertEqual(len(names.splitlines()),6)

if __name__=='__main__': unittest.main()
