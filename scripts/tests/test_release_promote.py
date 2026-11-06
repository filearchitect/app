"""Exercise promotion orchestration without contacting GitHub or the website."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'release-promote.sh'
MOCK = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args=sys.argv[1:]; name=Path(sys.argv[0]).name
with open(os.environ['CALL_LOG'], 'a') as f: f.write(name+' '+ ' '.join(args)+'\n')
scenario=os.environ['SCENARIO']
if name=='gh':
    if args[:2]==['release','view']: print('true')
    elif args[:2]==['run','list']: print('success')
    elif args[:1]==['api']: print('{"tag_name":"v0.12.4","draft":false}')
elif name=='git': print('testcommit')
elif name=='curl':
    url=args[-1]
    if url.endswith('/promote') or url.endswith('/rollback'):
        if url.endswith('/rollback') and scenario=='rollback-failure': sys.exit(22)
        print(json.dumps({'version':'0.12.4','state':'active' if url.endswith('/promote') else 'rolled_back'}))
    elif 'latest/download/apple-silicon.json' in url:
        if '--location' not in args: sys.exit(22)
        print('{"version":"0.12.4","platforms":{"darwin-aarch64":{},"darwin-x86_64":{}}}')
    elif '/api/updates/' in url:
        if scenario in ('postcheck-failure','rollback-failure'): sys.exit(22)
        print('{"version":"0.12.4","active":true}')
    elif '/download/' in url and 'redirect_url' in ' '.join(args):
        print('https://github.com/filearchitect/app/releases/download/v0.12.4/filearchitect_0.12.4_darwin-x86_64.dmg' if 'arch=intel' in url else 'https://github.com/filearchitect/app/releases/download/v0.12.4/test')
'''

class PromotionTests(unittest.TestCase):
    def run_scenario(self, scenario, action='promote'):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'scripts').mkdir(); (root/'bin').mkdir()
            shutil.copy(SCRIPT, root/'scripts/release-promote.sh')
            shutil.copy(SCRIPT.parent/'release-policy.sh', root/'scripts/release-policy.sh')
            (root/'scripts/release-stage.sh').write_text('exit '+('1' if scenario=='stage-failure' else '0')+'\n')
            for name in ('gh','git','curl','node'):
                p=root/'bin'/name; p.write_text(MOCK); p.chmod(0o755)
            env=dict(os.environ, PATH=str(root/'bin')+os.pathsep+os.environ['PATH'],
                     RELEASE_API_TOKEN='disposable-test-token', SCENARIO=scenario, CALL_LOG=str(root/'calls'))
            result=subprocess.run(['bash','scripts/release-promote.sh','0.12.4',action],cwd=root,env=env,capture_output=True,text=True)
            return result, (root/'calls').read_text()

    def test_success_follows_manifest_redirect_and_promotes(self):
        result, calls=self.run_scenario('success')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('/promote',calls)
        self.assertNotIn('/rollback',calls)

    def test_partial_preparation_failure_never_publishes(self):
        result,calls=self.run_scenario('stage-failure')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('release edit',calls)

    def test_postcheck_failure_rolls_back_then_drafts(self):
        result,calls=self.run_scenario('postcheck-failure')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('/rollback',calls)
        self.assertTrue(calls.rstrip().endswith('--draft'))

    def test_failed_website_rollback_keeps_downloads_public(self):
        result,calls=self.run_scenario('rollback-failure')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('/rollback',calls)
        self.assertNotIn('--draft\n',calls)

    def test_explicit_rollback(self):
        result,calls=self.run_scenario('success','rollback')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('/rollback',calls)
        self.assertTrue(calls.rstrip().endswith('--draft'))

if __name__=='__main__': unittest.main()
