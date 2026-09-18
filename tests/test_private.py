import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('vault_module', PROJECT / 'scripts/private.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VaultTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keydir = tempfile.TemporaryDirectory()
        cls.key = Path(cls.keydir.name) / 'identity'
        subprocess.run(['age-keygen', '-o', str(cls.key)], check=True, capture_output=True)
        cls.recipient = subprocess.check_output(['age-keygen', '-y', str(cls.key)]).decode().strip()

    @classmethod
    def tearDownClass(cls):
        cls.keydir.cleanup()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='vault-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.env = patch.dict(os.environ, {'AGE_IDENTITY': str(self.key)})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.run_git('init', '-q')
        self.run_git('config', 'user.name', 'Vault Test')
        self.run_git('config', 'user.email', 'vault@example.invalid')
        self.v = module.Vault(self.root, self.recipient)
        self.v.state.mkdir(mode=0o700)

    def run_git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)

    def write(self, name, data):
        module.atomic_write(self.root / name, data)

    def seed(self, contents=None):
        contents = contents or {'PUBLISHING.md': b'one\ntwo\nthree\nfour\nfive\n'}
        for name, data in contents.items():
            self.write(name, data)
        self.v.seal()
        return contents

    def remote(self, contents):
        self.write('private.age', self.v.encode(contents))

    def install(self):
        self.write('.githooks/pre-commit', (PROJECT / '.githooks/pre-commit').read_bytes())
        (self.root / '.githooks/pre-commit').chmod(0o700)
        script = (PROJECT / 'scripts/private.py').read_text().replace(module.RECIPIENT, self.recipient)
        self.write('scripts/private.py', script.encode())
        self.v.install_hooks()

    def test_fresh_restore_and_repeat_prepare(self):
        original = self.seed()
        (self.root / 'PUBLISHING.md').unlink()
        self.v.base.unlink()
        self.v.prepare()
        self.v.prepare()
        self.assertEqual(self.v.files(), original)
        self.assertEqual((self.root / 'PUBLISHING.md').stat().st_mode & 0o777, 0o600)

    def test_prepare_preserves_local_edits_and_seal_is_idempotent(self):
        self.seed()
        self.write('PUBLISHING.md', b'local\n')
        self.v.prepare()
        self.assertEqual((self.root / 'PUBLISHING.md').read_bytes(), b'local\n')
        self.v.seal()
        before = self.v.archive.read_bytes()
        self.v.seal()
        self.assertEqual(before, self.v.archive.read_bytes())

    def test_updated_archive_prevents_blind_seal(self):
        self.seed()
        self.remote({'PUBLISHING.md': b'remote\n'})
        with self.assertRaisesRegex(ValueError, 'run merge'):
            self.v.seal()
        self.v.prepare()
        self.assertEqual((self.root / 'PUBLISHING.md').read_bytes(), b'remote\n')

    def test_disjoint_text_edits_merge_and_backup(self):
        base = self.seed()
        self.write('PUBLISHING.md', base['PUBLISHING.md'].replace(b'one', b'local'))
        self.remote({'PUBLISHING.md': base['PUBLISHING.md'].replace(b'five', b'remote')})
        self.v.merge()
        self.assertEqual((self.root / 'PUBLISHING.md').read_bytes(), b'local\ntwo\nthree\nfour\nremote\n')
        backup = next((self.v.state / 'backups').glob('*.age'))
        self.assertTrue(self.v.decode(backup.read_bytes())['PUBLISHING.md'].startswith(b'local'))
        self.v.seal()
        self.v.check()

    def test_conflict_writes_nothing(self):
        self.seed({'PUBLISHING.md': b'base\n', 'NGINX.md': b'old\n'})
        self.write('PUBLISHING.md', b'ours\n')
        self.remote({'PUBLISHING.md': b'theirs\n', 'NGINX.md': b'new\n'})
        before, base, archive = self.v.files(), self.v.base.read_bytes(), self.v.archive.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Merge conflicts'):
            self.v.merge()
        self.assertEqual(self.v.files(), before)
        self.assertEqual(self.v.base.read_bytes(), base)
        self.assertEqual(self.v.archive.read_bytes(), archive)

    def test_divergent_credentials_are_not_text_merged(self):
        name = '.private/passwords.txt'
        self.seed({name: b'one\ntwo\nthree\nfour\nfive\n'})
        self.write(name, b'ours\ntwo\nthree\nfour\nfive\n')
        self.remote({name: b'one\ntwo\nthree\nfour\ntheirs\n'})
        with self.assertRaisesRegex(ValueError, 'Merge conflicts'):
            self.v.merge()

    def test_remote_addition_and_deletion(self):
        self.seed({'PUBLISHING.md': b'same', 'NGINX.md': b'delete'})
        self.remote({'PUBLISHING.md': b'same', 'fixes.md': b'new'})
        self.v.merge()
        self.assertFalse((self.root / 'NGINX.md').exists())
        self.assertEqual((self.root / 'fixes.md').read_bytes(), b'new')

    def test_delete_edit_conflict(self):
        self.seed()
        (self.root / 'PUBLISHING.md').unlink()
        self.remote({'PUBLISHING.md': b'edited'})
        with self.assertRaisesRegex(ValueError, 'Merge conflicts'):
            self.v.merge()

    def test_intentional_deletion_requires_flag(self):
        self.seed({'PUBLISHING.md': b'keep', 'NGINX.md': b'delete'})
        (self.root / 'NGINX.md').unlink()
        with self.assertRaisesRegex(ValueError, 'allow-delete'):
            self.v.seal()
        self.v.seal(allow_delete=True)
        self.v.check()

    def test_staged_old_archive_is_rejected(self):
        self.seed()
        self.run_git('add', 'private.age')
        self.write('PUBLISHING.md', b'new')
        with self.assertRaisesRegex(ValueError, 'Plaintext differs'):
            self.v.check(staged=True)
        self.v.seal()
        with self.assertRaisesRegex(ValueError, 'git add'):
            self.v.check(staged=True)
        self.run_git('add', 'private.age')
        self.v.check(staged=True)

    def test_staged_plaintext_rejected(self):
        self.seed()
        self.run_git('add', 'PUBLISHING.md', 'private.age')
        with self.assertRaisesRegex(ValueError, 'plaintext staged'):
            self.v.check(staged=True)

    def test_real_precommit_blocks_and_then_accepts(self):
        self.seed()
        self.install()
        self.v.install_hooks()
        self.run_git('add', 'private.age', 'scripts', '.githooks')
        self.write('PUBLISHING.md', b'changed')
        result = subprocess.run(['git', 'commit', '-m', 'blocked'], cwd=self.root, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.v.seal()
        self.run_git('add', 'private.age')
        self.run_git('commit', '-qm', 'accepted')

    def test_existing_hook_path_not_overwritten(self):
        self.run_git('config', 'core.hooksPath', '/some/other/hooks')
        with self.assertRaisesRegex(ValueError, 'Existing core.hooksPath'):
            self.v.install_hooks()
        self.assertEqual(self.run_git('config', '--get', 'core.hooksPath').stdout.strip(), b'/some/other/hooks')

    def test_existing_default_hook_not_overwritten(self):
        p = self.root / '.git/hooks/pre-push'
        p.write_text('#!/bin/sh\nexit 0\n')
        p.chmod(0o700)
        with self.assertRaisesRegex(ValueError, 'Existing Git hooks'):
            self.v.install_hooks()

    def test_git_ref_merge(self):
        self.seed()
        self.run_git('add', 'private.age')
        self.run_git('commit', '-qm', 'base')
        common = self.run_git('rev-parse', 'HEAD').stdout.decode().strip()
        self.remote({'PUBLISHING.md': b'one\ntwo\nthree\nfour\nremote\n'})
        self.run_git('add', 'private.age')
        self.run_git('commit', '-qm', 'remote')
        self.write('PUBLISHING.md', b'local\ntwo\nthree\nfour\nfive\n')
        self.v.merge(base_ref=common, theirs_ref='HEAD')
        self.v.seal()
        self.assertIn(b'remote', self.v.files()['PUBLISHING.md'])
        self.assertIn(b'local', self.v.files()['PUBLISHING.md'])

    def test_symlink_target_rejected(self):
        self.remote({'.private/secret': b'private'})
        outside = self.root / 'outside'
        outside.mkdir()
        (self.root / '.private').symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.v.unseal()
        self.assertFalse((outside / 'secret').exists())

    def test_archive_path_traversal_rejected(self):
        payload = io.BytesIO()
        with tarfile.open(fileobj=payload, mode='w:gz') as tf:
            item = tarfile.TarInfo('../escape')
            item.size = 1
            tf.addfile(item, io.BytesIO(b'x'))
        encrypted = self.v.age(['--encrypt', '-r', self.recipient], payload.getvalue())
        with self.assertRaisesRegex(ValueError, 'Invalid archive entry'):
            self.v.decode(encrypted)

    def test_identity_never_archived_and_wrong_key_fails(self):
        with self.assertRaisesRegex(ValueError, 'age identity'):
            self.v.encode({'.private/identity': self.key.read_bytes()})
        self.seed()
        self.v.identity = self.root / 'nonexistent'
        with self.assertRaisesRegex(ValueError, 'age failed'):
            self.v.prepare()

    def test_bootstrap_is_public_and_excluded(self):
        self.seed()
        self.write('.codex/hooks.json', b'{}')
        self.run_git('add', '.codex/hooks.json')
        self.assertNotIn('.codex/hooks.json', self.v.files())
        self.v.check()

    def test_session_start_json_without_secret_values(self):
        self.seed()
        self.install()
        result = subprocess.run(['python3', 'scripts/private.py', 'prepare',
                                 '--session-start', '--install-hooks'],
                                cwd=self.root, capture_output=True, check=True)
        response = json.loads(result.stdout)
        self.assertEqual(response['hookSpecificOutput']['hookEventName'], 'SessionStart')
        self.assertNotIn('AGE-SECRET-KEY-', result.stdout.decode())

    def test_launcher_prepares_before_codex_and_passes_args(self):
        self.seed()
        self.install()
        self.write('scripts/codex', (PROJECT / 'scripts/codex').read_bytes())
        (self.root / 'scripts/codex').chmod(0o700)
        self.write('bin/codex', b'#!/bin/sh\ntest -f PUBLISHING.md || exit 42\nprintf "%s\\n" "$SOPS_AGE_KEY_FILE" "$@"\n')
        (self.root / 'bin/codex').chmod(0o700)
        (self.root / 'PUBLISHING.md').unlink()
        self.v.base.unlink()
        env = dict(os.environ, CODEX_LAUNCHER=str(self.root / 'bin/codex'))
        result = subprocess.run([str(self.root / 'scripts/codex'), 'exec', 'a spaced prompt'],
                                cwd='/tmp', env=env, capture_output=True, check=True)
        self.assertIn(b'a spaced prompt', result.stdout)
        self.assertIn(str(self.key).encode(), result.stdout)


if __name__ == '__main__':
    unittest.main()
