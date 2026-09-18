#!/usr/bin/env python3
"""Local age vault: prepare, seal, check, and conservative three-way merge."""
import argparse
from contextlib import contextmanager
import fcntl
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
RECIPIENT = 'age1pg78x3vqq4qa05ruh6cuew4wsegustw8gr9mr3knn0nj272txg8qxh8pdh'
ROOTS = ('.private', 'PUBLISHING.md', 'NGINX.md', 'fixes.md',
         '_agent_notes.md', 'DEPLOYMENT.md', 'I18N_GUIDE.md',
         '.dev-nginx-conf', 'sudoers.d', '.agents', '.codex')
# Readable before unsealing; contains no secrets.
BOOTSTRAP = '.codex/hooks.json'
SKIP = {'.git', 'public', 'resources', '.history', 'node_modules'}
TEXT = {'.md', '.txt', '.toml', '.json', '.yaml', '.yml', '.conf', '.ini'}


def allowed(name):
    p = PurePosixPath(name)
    return (name != BOOTSTRAP and name == p.as_posix()
            and not p.is_absolute() and '..' not in p.parts and bool(p.parts)
            and not any(part in SKIP for part in p.parts)
            and (p.parts[0] in ROOTS or p.name in ('AGENTS.md', 'SKILL.md')))


def atomic_write(target, data):
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.vault-write-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Vault:
    def __init__(self, root=ROOT, recipient=RECIPIENT):
        self.root = Path(root).resolve()
        self.archive = self.root / 'private.age'
        self.recipient = recipient
        self.identity = Path(os.environ.get('AGE_IDENTITY', '~/_AI/codex-age-key.txt')).expanduser()
        self.state = Path(self.git('rev-parse', '--path-format=absolute',
                                   '--git-path', 'private-vault').decode().strip())
        self.base = self.state / 'base.age'

    def git(self, *args):
        result = subprocess.run(['git', *args], cwd=self.root, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE)
        if result.returncode:
            raise ValueError('Git command failed: ' + ' '.join(args))
        return result.stdout

    @contextmanager
    def locked(self):
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (self.state / 'lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            yield

    def safe_target(self, name):
        if not allowed(name):
            raise ValueError('Invalid protected path: ' + name)
        target = self.root / name
        for part in (target, *target.parents):
            if part == self.root:
                break
            if part.is_symlink():
                raise ValueError('Symlink in protected path: ' + name)
            if part != target and part.exists() and not part.is_dir():
                raise ValueError('Not a directory: ' + name)
        if target.exists() and not target.is_file():
            raise ValueError('Not a regular file: ' + name)
        return target

    def files(self):
        result = {}
        for directory, dirs, names in os.walk(self.root, followlinks=False):
            dirs[:] = [d for d in dirs if d not in SKIP]
            for name in dirs + names:
                p = Path(directory) / name
                relative = p.relative_to(self.root).as_posix()
                if allowed(relative) and p.is_symlink():
                    raise ValueError('Symlink in protected path: ' + relative)
            for name in names:
                relative = (Path(directory) / name).relative_to(self.root).as_posix()
                if allowed(relative):
                    result[relative] = self.safe_target(relative).read_bytes()
        return result

    def age(self, args, data):
        result = subprocess.run(['age', *args], input=data, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE)
        if result.returncode:
            raise ValueError('age failed; check AGE_IDENTITY/key access and archive integrity')
        return result.stdout

    def decode(self, encrypted):
        plain = self.age(['--decrypt', '-i', str(self.identity)], encrypted)
        contents = {}
        with tarfile.open(fileobj=io.BytesIO(plain), mode='r:gz') as archive:
            for member in archive:
                if not member.isfile() or not allowed(member.name) or member.name in contents:
                    raise ValueError('Invalid archive entry: ' + member.name)
                contents[member.name] = archive.extractfile(member).read()
        return contents

    def encode(self, contents):
        payload = io.BytesIO()
        with tarfile.open(fileobj=payload, mode='w:gz') as archive:
            for name, data in sorted(contents.items()):
                if not allowed(name):
                    raise ValueError('Invalid protected path: ' + name)
                if b'AGE-SECRET-KEY-' in data:
                    raise ValueError('Do not archive an age identity: ' + name)
                entry = tarfile.TarInfo(name)
                entry.mode, entry.size = 0o600, len(data)
                archive.addfile(entry, io.BytesIO(data))
        return self.age(['--encrypt', '-r', self.recipient], payload.getvalue())

    def assert_untracked(self):
        tracked = self.git('ls-files', '-z').decode().split('\0')
        exposed = [name for name in tracked if name and allowed(name)]
        if exposed:
            raise ValueError('Protected plaintext staged/tracked: ' + ', '.join(exposed))

    def check(self, staged=False):
        self.assert_untracked()
        encrypted = self.archive.read_bytes()
        if staged and self.git('show', ':private.age') != encrypted:
            raise ValueError('Staged archive differs: run git add private.age')
        contents = self.decode(encrypted)
        if contents != self.files():
            raise ValueError('Plaintext differs from archive: prepare/merge if pulled, then seal')
        return f'OK: {len(contents)} files match {"staged " if staged else ""}archive'

    def seal(self, allow_delete=False):
        local = self.files()
        if not local:
            raise ValueError('No plaintext files; run prepare first')
        previous = self.archive.read_bytes() if self.archive.exists() else None
        if previous is not None:
            remote = self.decode(previous)
            if self.base.exists() and self.decode(self.base.read_bytes()) != remote:
                raise ValueError('Archive changed since preparation; run merge before seal')
            missing = set(remote) - set(local)
            if missing and not allow_delete:
                raise ValueError('Missing files (use --allow-delete for intentional deletion): '
                                 + ', '.join(sorted(missing)))
            if local == remote:
                atomic_write(self.base, previous)
                return 'Archive already up to date'
        encrypted = self.encode(local)
        atomic_write(self.archive, encrypted)
        atomic_write(self.base, encrypted)
        return f'Encrypted {len(local)} files into private.age'

    def unseal(self):
        encrypted = self.archive.read_bytes()
        remote = self.decode(encrypted)
        for name, data in remote.items():
            target = self.safe_target(name)
            if target.exists() and target.read_bytes() != data:
                raise ValueError('Local file differs; use merge: ' + name)
        for name, data in remote.items():
            target = self.safe_target(name)
            if not target.exists():
                atomic_write(target, data)
        atomic_write(self.base, encrypted)
        return f'Restored/verified {len(remote)} files'

    def prepare(self):
        if not self.base.exists():
            return self.unseal()
        remote = self.decode(self.archive.read_bytes())
        base = self.decode(self.base.read_bytes())
        if remote != base:
            return self.merge()
        local = self.files()
        return ('Workspace prepared; local private edits preserved (seal before commit)'
                if local != remote else 'Workspace already prepared')

    def merge_text(self, name, local, base, remote):
        if name.startswith('.private/') or PurePosixPath(name).suffix.lower() not in TEXT:
            return None
        try:
            for content in (local, base, remote):
                content.decode('utf-8')
                if b'\0' in content:
                    return None
        except UnicodeDecodeError:
            return None
        with tempfile.TemporaryDirectory(prefix='merge-', dir=self.state) as temporary:
            paths = [Path(temporary) / part for part in ('local', 'base', 'remote')]
            for p, content in zip(paths, (local, base, remote)):
                atomic_write(p, content)
            result = subprocess.run(['git', 'merge-file', '-p', *map(str, paths)],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return result.stdout if result.returncode == 0 else None

    def merge(self, base_ref=None, theirs_ref=None):
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        if base_ref:
            base_bytes = self.git('show', base_ref + ':private.age')
        elif self.base.exists():
            base_bytes = self.base.read_bytes()
        else:
            raise ValueError('No merge base; use unseal or --base-ref <common-commit>')
        remote_bytes = (self.git('show', theirs_ref + ':private.age') if theirs_ref
                        else self.archive.read_bytes())
        base, remote, local = self.decode(base_bytes), self.decode(remote_bytes), self.files()
        merged, conflicts = {}, []
        for name in sorted(set(base) | set(remote) | set(local)):
            b, r, l = base.get(name), remote.get(name), local.get(name)
            if l == r or r == b:
                chosen = l
            elif l == b:
                chosen = r
            elif b is not None and l is not None and r is not None:
                chosen = self.merge_text(name, l, b, r)
                if chosen is None:
                    conflicts.append(name)
                    continue
            else:
                conflicts.append(name)
                continue
            if chosen is not None:
                merged[name] = chosen
        if conflicts:
            raise ValueError('Merge conflicts; no files changed: ' + ', '.join(conflicts))
        for name in set(local) | set(merged):
            self.safe_target(name)
        if local != merged:
            backup = self.state / 'backups' / (uuid.uuid4().hex + '.age')
            atomic_write(backup, self.encode(local))
        for name, data in merged.items():
            if local.get(name) != data:
                atomic_write(self.safe_target(name), data)
        for name in set(local) - set(merged):
            self.safe_target(name).unlink()
        if theirs_ref:
            atomic_write(self.archive, remote_bytes)
        atomic_write(self.base, remote_bytes)
        return 'Merged private files; run seal and git add private.age before commit'

    def install_hooks(self):
        configured = subprocess.run(['git', 'config', '--get', 'core.hooksPath'],
                                    cwd=self.root, stdout=subprocess.PIPE, check=False)
        value = configured.stdout.decode().strip()
        if value == '.githooks':
            return
        if value:
            raise ValueError('Existing core.hooksPath; integrate private check manually: ' + value)
        default = Path(self.git('rev-parse', '--path-format=absolute', '--git-path', 'hooks').decode().strip())
        if default.exists() and any(p.is_file() and not p.name.endswith('.sample')
                                    and os.access(p, os.X_OK) for p in default.iterdir()):
            raise ValueError('Existing Git hooks; integrate private check without replacing them')
        hook = self.root / '.githooks/pre-commit'
        if not hook.is_file() or not os.access(hook, os.X_OK):
            raise ValueError('Missing executable .githooks/pre-commit')
        self.git('config', '--local', 'core.hooksPath', '.githooks')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('seal', 'unseal', 'check', 'prepare', 'merge'))
    parser.add_argument('--staged', action='store_true', help='Check index archive (pre-commit)')
    parser.add_argument('--allow-delete', action='store_true', help='Seal intentional deletions')
    parser.add_argument('--base-ref', help='Explicit common Git commit for merge')
    parser.add_argument('--theirs-ref', help='Explicit incoming Git commit for merge')
    parser.add_argument('--install-hooks', action='store_true', help='Install repo pre-commit hook')
    parser.add_argument('--session-start', action='store_true', help='Emit Codex hook JSON')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if not shutil.which('age'):
            raise ValueError('age is not installed')
        vault = Vault()
        if args.command == 'check':
            message = vault.check(args.staged)
        else:
            with vault.locked():
                if args.command == 'seal':
                    message = vault.seal(args.allow_delete)
                elif args.command == 'unseal':
                    message = vault.unseal()
                elif args.command == 'merge':
                    message = vault.merge(args.base_ref, args.theirs_ref)
                else:
                    message = vault.prepare()
                if args.install_hooks:
                    vault.install_hooks()
        if args.session_start:
            print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                'additionalContext': message + '. Read restored AGENTS.md if present. '
                'For private files use .agents/skills/private-vault/SKILL.md. '
                'Never print keys or passwords; Git pre-commit checks the staged age archive.'}}))
        else:
            print(message)
        return 0
    except (ValueError, OSError, tarfile.TarError) as error:
        if args.session_start:
            print(json.dumps({'continue': False, 'stopReason': str(error),
                              'systemMessage': 'Private workspace preparation failed: ' + str(error)}))
            return 0
        print('private.py: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
