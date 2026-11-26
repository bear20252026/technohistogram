#!/usr/bin/env python3
"""Writes css/shell.css (palette + style), css/views-<page>.css, css/views-shared.css and css/views.css from the
stylesheet list kept as a comment in index.html (data-page marks a page sheet; no mark means shared).
Stops with exit 1, writing nothing, if a bundle on disk holds lines no source sheet has (--force writes anyway);
--check writes nothing and says which bundles differ from their sources."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
links = re.findall(r'<link rel="stylesheet" href="css/([a-z_]+\.css)\?v=[0-9a-f]+"(?: data-page="([a-z]+)")? />', html)
shell = ['palette.css', 'style.css']
pages = {}
shared = []
for f, page in links:
    if f in shell or f == 'shell.css' or f.startswith('views'): continue
    (pages.setdefault(page, []) if page else shared).append(f)
def bundle(files):
    out = []
    for f in files:
        css = (root / 'css' / f).read_text()
        css = re.sub(r"@import url\([^)]*\);\s*", '', css)  # no remote fonts
        out.append(f"/* ==== css/{f} ==== */\n{css.strip()}\n")
    return '\n'.join(out)
# every bundle is worked out first; a bundle on disk that holds rules its sources lack means someone edited the bundle
# and not the source, and writing over it would drop those rules from the page. Refuse, list them, write nothing.
outs = {'shell.css': bundle(shell), 'views-shared.css': bundle(shared), 'views.css': bundle(shared + [f for fs in pages.values() for f in fs])}
for page, files in pages.items(): outs[f'views-{page}.css'] = bundle(files)
lost = {}
for name, new in outs.items():
    f = root / 'css' / name
    if not f.exists(): continue
    keep = {l.strip() for l in new.split('\n')}
    gone = [l for l in f.read_text().split('\n') if l.strip() and l.strip() not in keep]
    if gone: lost[name] = gone
if lost and '--force' not in sys.argv:
    for name, gone in lost.items():
        print(f'{name}: {len(gone)} lines on disk are in no source sheet and would be dropped:')
        for l in gone[:40]: print('   ', l[:200])
    print('Nothing written. Carry those lines into their source sheets (css/<name>.css) and run again; --force writes anyway.')
    sys.exit(1)
if '--check' in sys.argv:
    stale = [n for n, new in outs.items() if not (root / 'css' / n).exists() or (root / 'css' / n).read_text() != new]
    print('bundles match their sources' if not stale else 'stale: ' + ', '.join(stale)); sys.exit(1 if stale else 0)
for name, new in outs.items(): (root / 'css' / name).write_text(new)
print('shell', shell, '| shared', shared, '| pages', {p: len(v) for p, v in pages.items()})
