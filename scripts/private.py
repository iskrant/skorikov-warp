#!/usr/bin/env python3
"""Version local operational files as an age-encrypted archive."""
import argparse
import io
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'private.age'
RECIPIENT = 'age1pg78x3vqq4qa05ruh6cuew4wsegustw8gr9mr3knn0nj272txg8qxh8pdh'
ROOTS = ('.private', 'PUBLISHING.md', 'NGINX.md', 'fixes.md',
         '_agent_notes.md', 'DEPLOYMENT.md', 'I18N_GUIDE.md',
         '.dev-nginx-conf', 'sudoers.d', '.agents', '.codex')


def allowed(name):
    p = PurePosixPath(name)
    return (not p.is_absolute() and '..' not in p.parts and bool(p.parts)
            and (p.parts[0] in ROOTS or p.name in ('AGENTS.md', 'SKILL.md')))


def files():
    result = []
    for directory, dirs, names in os.walk(ROOT, followlinks=False):
        dirs[:] = [d for d in dirs if d not in
                   ('.git', 'public', 'resources', '.history', 'node_modules')]
        for name in names:
            p = Path(directory) / name
            relative = p.relative_to(ROOT).as_posix()
            if allowed(relative):
                if p.is_symlink() or any(q.is_symlink() for q in p.parents if q != ROOT):
                    raise ValueError('Symlinks are not supported: ' + relative)
                result.append(p)
    return sorted(result)


def run_age(args, payload):
    return subprocess.run(['age', *args], input=payload, stdout=subprocess.PIPE,
                          check=True).stdout


def decrypt():
    identity = Path(os.environ.get('AGE_IDENTITY', '~/\u005fAI/codex-age-key.txt')).expanduser()
    return run_age(['--decrypt', '-i', str(identity)], ARCHIVE.read_bytes())


def entries(payload):
    result = {}
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        for member in archive:
            if not member.isfile() or not allowed(member.name) or member.name in result:
                raise ValueError('Invalid archive entry: ' + member.name)
            result[member.name] = archive.extractfile(member).read()
    return result


def atomic_write(target, data):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.private-write-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('seal', 'unseal', 'check'))
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == 'seal':
        selected = files()
        if not selected:
            raise ValueError('No plaintext files; run unseal first')
        # Refuse to silently drop files when packing a partially restored checkout.
        if ARCHIVE.exists():
            missing = set(entries(decrypt())) - {p.relative_to(ROOT).as_posix() for p in selected}
            if missing:
                raise ValueError('Missing plaintext files: ' + ', '.join(sorted(missing)))
        payload = io.BytesIO()
        with tarfile.open(fileobj=payload, mode='w:gz') as archive:
            for p in selected:
                if b'AGE-SECRET-KEY-' in p.read_bytes():
                    raise ValueError('Do not archive age identity: ' + p.relative_to(ROOT).as_posix())
                archive.add(p, arcname=p.relative_to(ROOT).as_posix(), recursive=False)
        encrypted = run_age(['--encrypt', '-r', RECIPIENT], payload.getvalue())
        atomic_write(ARCHIVE, encrypted)
        print(f'Encrypted {len(selected)} files into private.age')
    elif args.command == 'unseal':
        contents = entries(decrypt())
        # Validate everything before writing; never overwrite divergent local work.
        for name, data in contents.items():
            target = ROOT / name
            if any(p.is_symlink() for p in (target, *target.parents)):
                raise ValueError('Symlink in destination: ' + name)
            if target.exists() and (not target.is_file() or target.read_bytes() != data):
                raise ValueError('Local file differs; save/move it first: ' + name)
        for name, data in contents.items():
            target = ROOT / name
            if not target.exists():
                atomic_write(target, data)
        print(f'Restored/verified {len(contents)} files; keys remain under .private/')
    else:
        contents = entries(decrypt())
        current = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in files()}
        if contents != current:
            raise ValueError('Plaintext differs from private.age; run seal')
        tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
        exposed = [name for name in tracked if name and allowed(name)]
        if exposed:
            raise ValueError('Plaintext still tracked: ' + ', '.join(exposed))
        print(f'OK: {len(contents)} files match archive, no protected plaintext tracked')


if __name__ == '__main__':
    main()
