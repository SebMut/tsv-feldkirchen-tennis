#!/usr/bin/env python3
"""Safely publish the already-tested Astro dist to the existing SFTP hosting folder.

Only hashed, obsolete _astro/.js or .css files older than 48h may be pruned.
No other remote content is removed. Never prune an asset in the current dist.
All required directories are created explicitly and remote asset sizes verified.
"""
from __future__ import annotations

import os
import posixpath
import re
import stat
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path("dist")
HASHED = re.compile(r"\.[A-Za-z0-9_-]{8}\.(?:js|css)$")
RETENTION_SECONDS = 48 * 60 * 60
MAX_PRUNE = 500


def connect():
    host = os.environ["SFTP_HOST"].strip()
    user = os.environ["SFTP_USER"].strip()
    password = os.environ["SFTP_PASSWORD"]
    port = int(os.environ.get("SFTP_PORT") or "22")
    remote = os.environ["SFTP_REMOTE_PATH"].strip()
    if not host or not user or not password or remote in {"", "/", ".", ".."} or ".." in remote.split("/"):
        raise RuntimeError("Invalid or unsafe SFTP deployment destination")
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    # Same SSH first-use policy as the existing OpenSSH command: accept new host keys.
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=host, port=port, username=user, password=password,
                   look_for_keys=False, allow_agent=False, timeout=20,
                   auth_timeout=20, banner_timeout=20)
    sftp = client.open_sftp()
    return client, sftp, posixpath.normpath(remote)


def ensure_dir(sftp, path):
    missing = []
    current = path
    while current and current not in {"/", "."}:
        try:
            if not stat.S_ISDIR(sftp.stat(current).st_mode):
                raise RuntimeError("Remote path exists but is not a folder")
            break
        except FileNotFoundError:
            missing.append(current)
            parent = posixpath.dirname(current)
            if parent == current:
                raise RuntimeError("Invalid nested remote path")
            current = parent
    for folder in reversed(missing):
        sftp.mkdir(folder)


def prune_obsolete(sftp, remote_root):
    old_folder = posixpath.join(remote_root, "_astro")
    ensure_dir(sftp, old_folder)
    local_current = {p.name for p in (ROOT / "_astro").iterdir() if p.is_file()}
    candidates = []
    deadline = time.time() - RETENTION_SECONDS
    for entry in sftp.listdir_attr(old_folder):
        if entry.filename in local_current:
            continue
        if entry.st_mode and not stat.S_ISREG(entry.st_mode):
            continue
        if HASHED.search(entry.filename) and entry.st_mtime and entry.st_mtime < deadline:
            candidates.append(entry)
    if len(candidates) > MAX_PRUNE:
        raise RuntimeError("Refusing to prune an unusually large number of stale assets")
    # These names are absent from the new build and old enough to not be live assets.
    for entry in candidates:
        sftp.remove(posixpath.join(old_folder, entry.filename))
    print(f"Removed {len(candidates)} obsolete hashed assets; "
          f"recovered {sum(i.st_size or 0 for i in candidates)} bytes. "
          f"Preserved all current and newer remote assets.", flush=True)


def publish(sftp, remote_root):
    if not (ROOT / "index.html").is_file() or not (ROOT / "admin/index.html").is_file():
        raise RuntimeError("Expected tested public and admin entrypoints are missing")
    if not (ROOT / "forderungspyramide/index.html").is_file():
        raise RuntimeError("The new hidden member route is missing from the build")
    if not (ROOT / ".htaccess").is_file():
        raise RuntimeError("Required hosting configuration is missing")
    files = [p for p in ROOT.rglob("*") if p.is_file()]
    # Upload all JS/CSS dependencies before new HTML can reference them.
    files.sort(key=lambda p: (
        0 if p.relative_to(ROOT).parts[0] == "_astro" else
        2 if p.suffix == ".html" else 1,
        str(p.relative_to(ROOT)),
    ))
    created = set()
    uploaded = skipped = 0
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        remote_file = posixpath.join(remote_root, rel)
        parent = posixpath.dirname(remote_file)
        if parent not in created:
            ensure_dir(sftp, parent)
            created.add(parent)
        # Hashed bundle names are content-addressed; an identical-sized existing
        # file can be left intact, avoiding needless writes and quota churn.
        if rel.startswith("_astro/") and HASHED.search(path.name):
            try:
                if sftp.stat(remote_file).st_size == path.stat().st_size:
                    skipped += 1
                    continue
            except FileNotFoundError:
                pass
        sftp.put(str(path), remote_file, confirm=True)
        if sftp.stat(remote_file).st_size != path.stat().st_size:
            raise RuntimeError(f"Remote size mismatch for {rel}")
        uploaded += 1
    for important in ("index.html", "admin/index.html", "forderungspyramide/index.html", ".htaccess"):
        if sftp.stat(posixpath.join(remote_root, important)).st_size <= 0:
            raise RuntimeError(f"Missing or empty remote {important}")
    for asset in (ROOT / "_astro").iterdir():
        if asset.is_file() and sftp.stat(posixpath.join(remote_root, "_astro", asset.name)).st_size != asset.stat().st_size:
            raise RuntimeError(f"Asset could not be verified: {asset.name}")
    print(f"Verified SFTP delivery: {uploaded} files uploaded, {skipped} unchanged hashed assets; "
          "public homepage, private admin, hidden pyramid and CSS/JS assets present.", flush=True)


def main():
    if not ROOT.exists():
        raise RuntimeError("Run the production build before the SFTP deployment")
    client = sftp = None
    try:
        client, sftp, remote_root = connect()
        print("SFTP connected; checking stale build assets safely.", flush=True)
        prune_obsolete(sftp, remote_root)
        publish(sftp, remote_root)
    finally:
        if sftp is not None:
            sftp.close()
        if client is not None:
            client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never log password, target absolute path or connection details.
        print(f"SFTP delivery failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
