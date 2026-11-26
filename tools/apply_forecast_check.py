#!/usr/bin/env python3
"""apply_forecast_check.py: write a day's forecast check onto data/forecasts.json.

A check file (data/forecast_status_YYYY-MM-DD.json in the repo) scores forecasts due soon against the record. Each
scored row that points at forecasts.json (ref.file == 'forecasts', ref.index) gets a `chk` object on its forecast:

  on    the day of the check, YYYY-MM-DD (--on, else the check file's name)
  at    the day the measure stands at, YYYY-MM-DD or YYYY-MM (absent when the row gives none)
  s     came_true | on_track | behind | contradicted | too_early | unresolvable
  now   the measure today (number, or absent)
  line  the forecaster's own number (number, or absent)
  u     the measure in a few words (absent when the row has no number)
  lab   the forecast in a short line, for a chart row (absent when the row has no number)
  note  one or two sentences on where it stands
  ev    [{title, url, fact}] the pages read for the check

Forecasts the check does not score lose any older `chk`. The row order and every other field stay as they were.

Usage
  python3 tools/apply_forecast_check.py ../../data/forecast_status_2026-11-10.json --on 2026-11-10 [--labels ../../data/forecast_labels.json]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
FC = os.path.join(APP, 'data', 'forecasts.json')
PR = os.path.join(APP, 'data', 'predictions.json')  # Ledger rows, ref.file == 'predictions', ref.id


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    check = json.load(open(argv[1]))
    labels = {}
    if '--labels' in argv:
        labels = json.load(open(argv[argv.index('--labels') + 1]))
    import re
    on = argv[argv.index('--on') + 1] if '--on' in argv else (re.search(r'(\d{4}-\d{2}-\d{2})', os.path.basename(argv[1])) or [None, None])[1]
    fcs = json.load(open(FC))
    prs = json.load(open(PR))
    byid = {x.get('id'): x for x in prs}
    for f in fcs + prs:
        f.pop('chk', None)
    n = m = 0
    for r in check:
        ref = r.get('ref') or {}
        if ref.get('file') == 'predictions':
            f = byid.get(ref.get('id'))
            if not f:
                print('no prediction with id', ref.get('id'), file=sys.stderr)
                continue
            i = None
            m += 1
        elif ref.get('file') == 'forecasts':
            i = ref.get('index')
            if not isinstance(i, int) or i >= len(fcs):
                print('no forecast at index', i, file=sys.stderr)
                continue
            f = fcs[i]
            if f.get('text') != r.get('text'):
                print('text differs at', i, file=sys.stderr)
            n += 1
        else:
            continue
        chk = {'on': on, 's': r['status']}
        if r.get('as_of'):
            chk['at'] = r['as_of']
        fv, cv = r.get('forecast_value'), r.get('current_value')
        if isinstance(fv, (int, float)) and isinstance(cv, (int, float)) and fv not in (0,):
            chk['now'], chk['line'] = cv, fv
            lab = labels.get(str(i)) if i is not None else None
            if lab:
                chk['lab'], chk['u'] = lab[0], lab[1]
            else:
                chk['u'] = (r.get('unit') or '').split('(')[0].strip()
        if r.get('note'):
            chk['note'] = r['note']
        ev = [{'title': e.get('title'), 'url': e.get('url'), 'fact': e.get('fact')} for e in r.get('evidence') or [] if e.get('url')]
        if ev:
            chk['ev'] = ev
        f['chk'] = chk
    json.dump(fcs, open(FC, 'w'), ensure_ascii=False, indent=1)
    json.dump(prs, open(PR, 'w'), ensure_ascii=False, indent=1)
    print(f'{n} forecasts and {m} ledger statements carry the check of {on}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
