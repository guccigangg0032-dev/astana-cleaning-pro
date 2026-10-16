"""Create a Plesk archive to extract in the subscription HOME (outside httpdocs)."""
from pathlib import Path
import hashlib
import json
import stat
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release.zip'
files = [p for p in root.rglob('*') if p.is_file()
         and not any(part in {'.git', 'node_modules', 'tools', 'deployment'} for part in p.relative_to(root).parts)
         and (p.suffix in {'.html', '.js', '.css', '.svg'}
              or p.name in {'.htaccess', 'robots.txt', 'sitemap.xml', 'metrics.php'})]
manifest = []
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        relative = file.relative_to(root).as_posix()
        info = zipfile.ZipInfo.from_file(file, 'httpdocs/' + relative)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        body = file.read_bytes()
        archive.writestr(info, body)
        manifest.append({'path': relative, 'bytes': len(body), 'mode': '0644', 'sha256': hashlib.sha256(body).hexdigest()})
output.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'{len(files)} runtime files, explicit 0644, httpdocs/ prefix; extract in subscription home.')
