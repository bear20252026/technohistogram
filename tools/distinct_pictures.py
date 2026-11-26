#!/usr/bin/env python3
"""The number of distinct pictures on the Histomap, for the arrival's line ("4,823 records, 2,162 pictures").

The page holds two sets of pictures: one file per record that has one (img/moments, events_text*.json picture.src) and
the globe's pool (the crops in arrival/thumb0-4.jpg that sit on a record: arrival/data2.json images with e >= 0, named
through data/pictures.json). Their sum counts some pictures twice: one file used on two records, and a pool crop that is
the record's own picture. Here every picture is counted once.

Two pictures are one picture when
  1. their files are identical (same bytes), or
  2. their pixels line up: SIFT matches between them fit one similarity (scale, turn, shift; RANSAC), at least MIN_INLIERS
     of them, and over the area the two share the aligned images correlate at MIN_NCC or more. That holds for a resize, a
     crop and another scan of the same picture, and fails for two photographs of one object or two prints of one subject.

Writes arrival/data2.json: pictures (the count) and pictures_from ([record pictures, pool crops] it was counted from).
js/arrival.js prints the count only while pictures_from matches the file's own record_pictures and pool, so a record
that has moved on prints no picture count instead of an old one. Run after tools/pack_events.py whenever a picture is
added, changed or removed.  Needs: pip install opencv-python-headless numpy.   usage: distinct_pictures.py [site dir]
"""
import collections, hashlib, json, os, sys
import cv2, numpy as np

SITE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_INLIERS, MIN_NCC, EDGE = 20, 0.85, 360

def read_record_pictures():
    T = {}
    data = os.path.join(SITE, 'data')
    for f in sorted(os.listdir(data)):
        if f.startswith('events_text') and f.endswith('.json'):
            j = json.load(open(os.path.join(data, f), encoding='utf-8')); T.update(j.get('events', j))
    return {i: v['picture']['src'] for i, v in T.items() if isinstance(v, dict) and v.get('picture') and v['picture'].get('src')}

def read_pool():
    P = json.load(open(os.path.join(SITE, 'data', 'pictures.json'), encoding='utf-8'))['pictures']
    D = json.load(open(os.path.join(SITE, 'arrival', 'data2.json'), encoding='utf-8'))
    key = lambda im: (im['atlas'], round(im['u'], 6), round(im['v'], 6))
    name = {key(p): p['id'] for p in P}
    return [(name.get(key(im)) or f"pool@{im['atlas']}:{im['u']:.5f}:{im['v']:.5f}", im) for im in D['images'] if im['e'] >= 0], D

_atlas = {}
def pool_crop(im):
    a = im['atlas']
    if a not in _atlas: _atlas[a] = cv2.imread(os.path.join(SITE, 'arrival', f'thumb{a}.jpg'))
    A = _atlas[a]; H, W = A.shape[:2]
    x0, w, h = int(round(im['u'] * W)), int(round(im['uw'] * W)), int(round(im['vh'] * H)); y0 = int(round((1 - im['v'] - im['vh']) * H))  # v is bottom-origin
    return A[max(0, y0):y0 + h, max(0, x0):x0 + w]

def grey(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); h, w = g.shape; s = EDGE / max(h, w)
    return cv2.resize(g, (max(8, int(w * s)), max(8, int(h * s))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)

def aligned(A, B):
    """inliers of the best similarity from A onto B, and the correlation of the two over the area they share"""
    (ga, pa, da), (gb, pb, db) = A, B
    if len(da) < 8 or len(db) < 8: return 0, 0.0
    m = cv2.BFMatcher(cv2.NORM_L2).knnMatch(da, db, k=2)
    good = [x[0] for x in m if len(x) == 2 and x[0].distance < 0.75 * x[1].distance]
    if len(good) < 8: return 0, 0.0
    M, mask = cv2.estimateAffinePartial2D(pa[[g.queryIdx for g in good]], pb[[g.trainIdx for g in good]], method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if M is None: return 0, 0.0
    wa = cv2.warpAffine(ga, M, (gb.shape[1], gb.shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)
    on = cv2.warpAffine(np.full(ga.shape, 255, np.uint8), M, (gb.shape[1], gb.shape[0]), flags=cv2.INTER_NEAREST, borderValue=0) > 0
    if on.sum() < 400: return int(mask.sum()), 0.0
    a = cv2.GaussianBlur(wa, (0, 0), 1.5).astype(np.float32)[on]; b = cv2.GaussianBlur(gb, (0, 0), 1.5).astype(np.float32)[on]
    a -= a.mean(); b -= b.mean(); d = float(np.linalg.norm(a) * np.linalg.norm(b))
    return int(mask.sum()), (float(a @ b / d) if d else 0.0)

def main():
    rec = read_record_pictures(); pool, D = read_pool()
    sift = cv2.SIFT_create(nfeatures=800, contrastThreshold=0.03)
    nodes, F, sha = [], [], {}
    def add(node, img):
        g = grey(img); kp, des = sift.detectAndCompute(g, None)
        nodes.append(node); F.append((g, np.float32([k.pt for k in kp]) if kp else np.zeros((0, 2), np.float32), des if des is not None else np.zeros((0, 128), np.float32)))
    for i in sorted(rec):
        path = os.path.join(SITE, rec[i]); sha[i] = hashlib.sha1(open(path, 'rb').read()).hexdigest(); add(('rec', i), cv2.imread(path))
    for name, im in pool: add(('pool', name), pool_crop(im))
    # candidates: every descriptor asks one index of all descriptors for its nearest; pictures that answer often are compared
    owner = np.concatenate([np.full(len(f[2]), k, np.int32) for k, f in enumerate(F)]); allD = np.concatenate([f[2] for f in F]).astype(np.float32)
    flann = cv2.FlannBasedMatcher(dict(algorithm=1, trees=6), dict(checks=96)); flann.add([allD]); flann.train()
    pairs = set()
    for k, f in enumerate(F):
        if not len(f[2]): continue
        votes = collections.Counter()
        for mm in flann.knnMatch(f[2], k=6):
            for o in {int(owner[m.trainIdx]) for m in mm if m.distance < 260}:
                if o != k: votes[o] += 1
        for o, v in votes.most_common(4):
            if v >= 6: pairs.add((min(k, o), max(k, o)))
    at = {n: k for k, n in enumerate(nodes)}
    for kind, name in nodes:  # a pool crop against its own record's picture, whatever the index said
        if kind == 'pool' and ('rec', name) in at: pairs.add((at[('rec', name)], at[('pool', name)]))
    par = list(range(len(nodes)))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    why = collections.Counter()
    def union(a, b, w):
        a, b = find(a), find(b)
        if a != b: par[a] = b; why[w] += 1
    by = collections.defaultdict(list)
    for i, h in sha.items(): by[h].append(at[('rec', i)])
    for v in by.values():
        for x in v[1:]: union(v[0], x, 'identical file')
    for a, b in sorted(pairs):
        best = max(aligned(F[a], F[b]), aligned(F[b], F[a]), key=lambda r: (r[1] if r[0] >= MIN_INLIERS else -1, r[0]))
        if best[0] >= MIN_INLIERS and best[1] >= MIN_NCC: union(a, b, 'same image')
    distinct = len({find(k) for k in range(len(nodes))})
    rec_distinct = len({find(k) for k, n in enumerate(nodes) if n[0] == 'rec'})
    print(f"{len(rec)} record pictures + {len(pool)} pool crops = {len(nodes)}; {len(nodes) - distinct} repeats ({why['identical file']} identical files, {why['same image']} more by content)")
    print(f"distinct pictures: {distinct} ({rec_distinct} among the record pictures, {distinct - rec_distinct} added by the pool)")
    D['pictures'] = distinct; D['pictures_from'] = [len(rec), len(pool)]
    json.dump(D, open(os.path.join(SITE, 'arrival', 'data2.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
