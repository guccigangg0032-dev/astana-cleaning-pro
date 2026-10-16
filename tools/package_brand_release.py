#!/usr/bin/env python3
"""Package only the ACPro PNG branding release. No unrelated site files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
from hashlib import sha256
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"deployment/acpro-brand-png-2026-10-17.zip"
PNGS=["logo-512.png","logo-1024.png","favicon-32.png","favicon-48.png","apple-touch-icon.png","og-image-1200x630.png"]
files=[ROOT/"assets"/name for name in PNGS]
files += sorted(x for x in ROOT.glob("*.html") if x.is_file())
for sub in ("kk","en"):
    files+=sorted((ROOT/sub).glob("*.html"))
if len(files)<52:
    raise RuntimeError(f"Unexpected release contents: {len(files)} (need 6 PNGs + 46 HTML pages)")
for path in files:
    if not path.is_file():
        raise FileNotFoundError(path)
for path in files:
    if path.suffix==".html":
        data=path.read_text(encoding="utf-8")
        assert "https://acpro.kz/assets/og-image-1200x630.png" in data, path
        assert "https://acpro.kz/assets/logo-512.png" in data, path
        assert 'apple-touch-icon.png' in data, path
OUT.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(OUT,"w",compression=ZIP_DEFLATED,compresslevel=9) as z:
    for path in files:
        arc="httpdocs/"+path.relative_to(ROOT).as_posix()
        info=ZipInfo(arc, (2026,10,17,0,0,0))
        info.compress_type=ZIP_DEFLATED
        info.external_attr=(0o100644 <<16)
        z.writestr(info,path.read_bytes())
print(json.dumps({"release":str(OUT),"file_count":len(files),"bytes":OUT.stat().st_size,"sha256":sha256(OUT.read_bytes()).hexdigest()}))
