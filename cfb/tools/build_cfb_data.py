#!/usr/bin/env python3
"""
Build cfb/src/cfb_data.js from public ESPN college football JSON.

Sources (all public, no key; cached under cfb/tools/raw/ so reruns are offline):
  - core API conference groups -> the 2026 FBS teams and their conferences
  - site API team pages + rosters (colors, coach, players, class, hometown)
  - core API team pages (stadium)
  - site.web byathlete stat leaderboards, 2026 and 2025 regular season
  - core API recruiting classes 2021-2026 (public ESPN grade -> star count)
  - FPI power index 2026 + 2025 (team strength)
  - weekly FBS scoreboards for the 2026 schedule and final scores

Player OVR/POT is this game's own model: a blend of per-game production (2026, plus
2025 at half weight), games played, high-school recruiting grade, class year and team
strength, ranked within each position across FBS and mapped onto a 45-99 curve.
No ratings are copied from any video game or recruiting service beyond public
star counts. Usage: python3 build_cfb_data.py [--offline]
"""
import collections, concurrent.futures as cf, hashlib, json, math, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'src', 'cfb_data.js')
SEASON = 2026
OFFLINE = '--offline' in sys.argv
SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football'
CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football'
WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football'
FITT = 'https://site.web.api.espn.com/apis/fitt/v3/sports/football/college-football'
CONF = {'8': 'SEC', '5': 'Big Ten', '4': 'Big 12', '1': 'ACC', '9': 'Pac-12', '17': 'Mountain West', '37': 'Sun Belt',
        '15': 'MAC', '151': 'American', '12': 'C-USA', '18': 'Ind'}
P4 = {'SEC', 'Big Ten', 'Big 12', 'ACC'}
# Historic program brand (0-3) layered on top of current talent for prestige.
BRAND = {'Alabama': 3, 'Ohio State': 3, 'Georgia': 3, 'Texas': 3, 'Michigan': 3, 'USC': 3, 'Notre Dame': 3, 'LSU': 3,
         'Oklahoma': 3, 'Clemson': 2.5, 'Penn State': 2.5, 'Oregon': 2.5, 'Florida': 2.5, 'Florida State': 2.5, 'Miami': 2.5,
         'Tennessee': 2.5, 'Auburn': 2, 'Texas A&M': 2, 'Nebraska': 1.5, 'Wisconsin': 1.5, 'Washington': 1.5, 'UCLA': 1.5,
         'Ole Miss': 1.5, 'Iowa': 1, 'Michigan State': 1, 'Virginia Tech': 1, 'Arkansas': 1, 'South Carolina': 1, 'Utah': 1,
         'Kentucky': 0.5, 'Missouri': 1, 'Colorado': 1, 'Stanford': 1, 'West Virginia': 1, 'TCU': 1, 'Baylor': 0.5,
         'Oklahoma State': 1, 'Louisville': 0.5, 'Pittsburgh': 0.5, 'Boise State': 1, 'BYU': 1, 'Kansas State': 1,
         'Indiana': 1, 'Mississippi State': 0.5, 'Arizona State': 0.5, 'Texas Tech': 1, 'SMU': 0.5, 'NC State': 0.5,
         'North Carolina': 0.5, 'Minnesota': 0.5, 'Illinois': 0.5, 'Cincinnati': 0.5, 'Houston': 0.5}

# ---------------------------------------------------------------- fetching
def get(url, tries=5):
    os.makedirs(RAW, exist_ok=True)
    fn = os.path.join(RAW, hashlib.sha1(url.encode()).hexdigest()[:20] + '.json')
    if os.path.exists(fn):
        with open(fn) as f: return json.load(f)
    if OFFLINE: return None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (cfb-data-builder)', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=40) as r: data = json.load(r)
            with open(fn, 'w') as f: json.dump(data, f, separators=(',', ':'))
            return data
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
            time.sleep(1.5 * 2 ** i)
        except Exception:
            time.sleep(1.5 * 2 ** i)
    print('FAILED', url, file=sys.stderr); return None

def pmap(fn, items, workers=6):
    with cf.ThreadPoolExecutor(workers) as ex: return list(ex.map(fn, items))

def num(x, d=0.0):
    try: return float(str(x).replace(',', ''))
    except (TypeError, ValueError): return d

def norm(s):
    return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', (s or '').lower()))

def hsh(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)

# ---------------------------------------------------------------- teams
team_conf = {}
for gid, conf in CONF.items():
    d = get(f'{CORE}/seasons/{SEASON}/types/2/groups/{gid}/teams?limit=100') or {}
    for it in d.get('items', []):
        tid = re.search(r'/teams/(\d+)', it['$ref']).group(1)
        team_conf[tid] = conf
tids = sorted(team_conf, key=int)
print('FBS teams', len(tids))
tdet = dict(zip(tids, pmap(lambda t: (get(f'{SITE}/teams/{t}') or {}).get('team', {}), tids)))
tcore = dict(zip(tids, pmap(lambda t: get(f'{CORE}/seasons/{SEASON}/teams/{t}') or {}, tids)))
rosters = dict(zip(tids, pmap(lambda t: get(f'{SITE}/teams/{t}/roster') or {}, tids)))

def fpi(year):
    out = {}
    for page in range(1, 6):
        d = get(f'{FITT}/powerindex?season={year}&limit=50&page={page}')
        if not d: break
        for t in d.get('teams', []):
            cats = {c['name']: c for c in t.get('categories', [])}
            vals = cats.get('fpi', {}).get('values') or []
            names = [n for c in d.get('categories', []) if c['name'] == 'fpi' for n in c.get('names', [])]
            if vals and names and 'fpi' in names: out[t['team']['id']] = num(vals[names.index('fpi')])
            elif vals: out[t['team']['id']] = num(vals[0])
        if page >= d.get('pagination', {}).get('pages', 1): break
    return out
fpi26, fpi25 = fpi(SEASON), fpi(SEASON - 1)
if len(fpi26) < 100:  # fall back to the core API index
    for page in range(1, 4):
        d = get(f'{CORE}/seasons/{SEASON}/powerindex?limit=100&page={page}') or {}
        for it in d.get('items', []):
            t = re.search(r'/teams/(\d+)', it['team']['$ref']).group(1)
            for p in it.get('predictives', []) + it.get('stats', []):
                if p.get('name') == 'fpi': fpi26[t] = num(p.get('value'))
print('FPI', len(fpi26), len(fpi25))

# ---------------------------------------------------------------- recruits
recruits = {}  # espn college athlete id -> (grade, class, state, pos)
rec_by_name = {}
for year in range(SEASON - 5, SEASON + 1):
    first = get(f'{CORE}/recruiting/{year}/athletes?limit=1000&page=1') or {}
    pages = [first] + [get(f'{CORE}/recruiting/{year}/athletes?limit=1000&page={p}') or {} for p in range(2, first.get('pageCount', 1) + 1)]
    for d in pages:
        for it in d.get('items', []):
            a = it.get('athlete', {}); g = num(it.get('grade'), 0)
            st = (a.get('hometown') or {}).get('stateAbbreviation') or ((a.get('highSchool') or {}).get('address') or {}).get('stateAbbreviation') or ''
            rec = (g, it.get('recruitingClass', year), st, (a.get('position') or {}).get('abbreviation', ''))
            if a.get('alternateId'): recruits[str(a['alternateId'])] = rec
            rec_by_name.setdefault(norm(a.get('fullName')), []).append(rec)
print('recruits', len(recruits))

def stars_of(g):
    return 0 if g <= 0 else 5 if g >= 90 else 4 if g >= 80 else 3 if g >= 70 else 2

# ---------------------------------------------------------------- stats
CATS = [('offense:passing', 'passing.passingYards'), ('offense:rushing', 'rushing.rushingYards'),
        ('offense:receiving', 'receiving.receivingYards'), ('defense', 'defensive.totalTackles'),
        ('specialTeams:kicking', 'kicking.fieldGoalAttempts'), ('specialTeams:punting', 'punting.punts')]

def load_stats(year):
    st = collections.defaultdict(dict); team = {}
    for cat, sort in CATS:
        page, pages = 1, 1
        while page <= pages:
            d = get(f'{WEB}/statistics/byathlete?isqualified=false&season={year}&seasontype=2&limit=1000&page={page}'
                    f'&category={cat.replace(":", "%3A")}&sort={sort.replace(".", ".")}%3Adesc')
            if not d: break
            pages = d['pagination']['pages']
            names = {c['name']: c['names'] for c in d['categories']}
            for a in d['athletes']:
                aid = a['athlete']['id']; team[aid] = a['athlete'].get('teamId')
                for c in a['categories']:
                    if all(t == '-' for t in c['totals']): continue
                    for n, v in zip(names[c['name']], c['totals']):
                        st[aid][c['name'] + '.' + n] = num(v)
            page += 1
    return st, team
s26, steam26 = load_stats(SEASON)
s25, _ = load_stats(SEASON - 1)
print('stat lines', len(s26), len(s25))

# ---------------------------------------------------------------- schedule
id2abbr = {}
teams_out = []
used = set()
def hexc(c, d):
    c = (c or d).lstrip('#').lower()
    return '#' + (c if re.fullmatch(r'[0-9a-f]{6}', c) else d).upper()
def lum(h): r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5)); return 0.299 * r + 0.587 * g + 0.114 * b
def cdist(a, b): return sum(abs(int(a[i:i + 2], 16) - int(b[i:i + 2], 16)) for i in (1, 3, 5))
for t in tids:
    d = tdet[t]
    ab = re.sub(r'[^A-Z&]', '', (d.get('abbreviation') or '').upper()).replace('&', '')
    if len(ab) > 4: ab = {'UMASS': 'MASS', 'BGSU': 'BGSU'}.get(ab, ab[:4])
    while ab in used or len(ab) < 2: ab = (ab + 'X')[:4] if len(ab) < 4 else ab[:3] + chr(ord('A') + len(used) % 26)
    used.add(ab); id2abbr[t] = ab

sched = collections.defaultdict(list); completed_weeks = {}
for w in range(1, 17):
    d = get(f'{SITE}/scoreboard?groups=80&week={w}&seasontype=2&dates={SEASON}&limit=500') or {}
    alldone = True; n = 0
    for e in d.get('events', []):
        c = e['competitions'][0]
        h = next((x for x in c['competitors'] if x['homeAway'] == 'home'), None)
        a = next((x for x in c['competitors'] if x['homeAway'] == 'away'), None)
        if not h or not a or h['team']['id'] not in id2abbr or a['team']['id'] not in id2abbr: continue
        done = c['status']['type'].get('completed', False)
        alldone &= done; n += 1
        sched[w].append([id2abbr[h['team']['id']], id2abbr[a['team']['id']], 1 if c.get('neutralSite') else 0,
                         int(num(h.get('score'))) if done else None, int(num(a.get('score'))) if done else None])
    if n: completed_weeks[w] = alldone
weeks = [sched[w] for w in sorted(sched)]
as_of = max([w for w, ok in completed_weeks.items() if ok] or [0])
team_games26 = collections.Counter(); team_wins = collections.Counter()
for wk in weeks:
    for h, a, _, hs, as_ in wk:
        if hs is None: continue
        team_games26[h] += 1; team_games26[a] += 1
        team_wins[h if hs > as_ else a] += 1

# ---------------------------------------------------------------- players
POSMAP = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'HB': 'RB', 'TB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OL': 'OL', 'OT': 'OL', 'OG': 'OL',
          'G': 'OL', 'T': 'OL', 'C': 'OL', 'IOL': 'OL', 'DL': 'DL', 'DE': 'DL', 'DT': 'DL', 'NT': 'DL', 'EDGE': 'DL',
          'LB': 'LB', 'ILB': 'LB', 'MLB': 'LB', 'OLB': 'LB', 'CB': 'CB', 'NB': 'CB', 'S': 'S', 'FS': 'S', 'SS': 'S', 'SAF': 'S',
          'PK': 'K', 'K': 'K', 'P': 'P'}

def R(aid, k, g26, g25):
    a = s26.get(aid, {}).get(k, 0); b = s25.get(aid, {}).get(k, 0)
    g = g26 + 0.5 * g25
    return (a + 0.5 * b) / g if g else 0.0

players = []
team_recs = collections.defaultdict(list)
def roster_items():
    seen = set()
    for t in tids:
        for grp in rosters[t].get('athletes', []):
            for a in grp.get('items', []):
                seen.add(a['id']); yield t, a
    # productive 2026 players missing from ESPN's published roster (injured / not yet listed)
    miss = [aid for aid, st in s26.items() if aid not in seen and steam26.get(aid) in team_conf and st.get('general.gamesPlayed', 0) >= 2
            and any(k.split('.')[0] in ('passing', 'rushing', 'receiving', 'defensive', 'kicking', 'punting') for k in st)]
    for aid, a in zip(miss, pmap(lambda i: get(f'{CORE}/seasons/{SEASON}/athletes/{i}'), miss)):
        if a and a.get('position'): yield steam26[aid], a
for t, a in roster_items():
    ab = id2abbr[t]
    aid = a['id']; raw = (a.get('position') or {}).get('abbreviation', '')
    wt = num(a.get('weight'), 220)
    st = s26.get(aid, {}); st5 = s25.get(aid, {})
    rec = recruits.get(aid)
    if not rec:
        cands = [r for r in rec_by_name.get(norm(a.get('fullName')), [])
                 if not (a.get('birthPlace') or {}).get('state') or r[2] == (a.get('birthPlace') or {}).get('state')]
        rec = cands[0] if len(cands) == 1 else None
    if raw == 'LS': continue
    pos = POSMAP.get(raw)
    dtk = st.get('defensive.totalTackles', 0) + st5.get('defensive.totalTackles', 0)
    otk = sum(st.get(k, 0) + st5.get(k, 0) for k in ('rushing.rushingAttempts', 'receiving.receptions', 'passing.passingAttempts'))
    if raw in ('DB',) or (raw == 'ATH' and dtk > otk):
        rp = rec[3] if rec else ''
        if rp in ('CB',): pos = 'CB'
        elif rp in ('S',): pos = 'S'
        else:
            pd = st.get('defensive.passesDefended', 0) + st5.get('defensive.passesDefended', 0)
            tk = dtk
            pos = 'S' if (wt >= 200 or (tk > 25 and pd * 8 < tk)) else 'CB'
        if raw == 'ATH' and wt >= 225: pos = 'LB'
    elif raw == 'ATH':
        pos = 'QB' if st.get('passing.passingAttempts', 0) > 30 else ('RB' if wt >= 205 and st.get('rushing.rushingAttempts', 0) >= st.get('receiving.receptions', 0) else 'WR')
    if raw in ('DE', 'EDGE', 'DL') and wt < 235: pos = 'LB'
    if not pos: continue
    exp = (a.get('experience') or {}).get('years') or 1
    cls = max(1, min(4, int(exp)))
    rs = 0
    if rec:
        yr = SEASON - rec[1] + 1
        if yr >= 5 or yr > cls: rs = 1
        if yr >= 5: cls = 4
    bp = a.get('birthPlace') or {}
    country = (a.get('birthCountry') or {}).get('abbreviation') or bp.get('country') or 'USA'
    home = (rec[2] if rec and rec[2] else '') or bp.get('state') or ''
    if country not in ('USA', 'United States') and not (rec and rec[2]): home = 'INT'
    if len(home) != 2 and home != 'INT': home = ''
    g26 = st.get('general.gamesPlayed', 0); g25 = st5.get('general.gamesPlayed', 0)
    players.append(dict(aid=aid, a=a, pos=pos, wt=wt, cls=cls, rs=rs, home=home, abbr=ab, tid=t,
                        grade=rec[0] if rec else 0, g26=g26, g25=g25))
    if rec: team_recs[t].append(rec[0])

# ---- team talent: roster recruiting composite + FPI
def comp(gr):
    gr = sorted(gr, reverse=True)[:60]
    return sum(max(0, g - 60) ** 1.6 for g in gr)
fp = {t: fpi26.get(t, -10) * 0.7 + fpi25.get(t, fpi26.get(t, -10)) * 0.3 for t in tids}
rc = {t: comp(team_recs[t]) for t in tids}
def z(d):
    v = list(d.values()); m = sum(v) / len(v); s = (sum((x - m) ** 2 for x in v) / len(v)) ** .5 or 1
    return {k: (x - m) / s for k, x in d.items()}
zr, zf = z(rc), z(fp)
raw_t = {t: 0.55 * zr[t] + 0.45 * zf[t] + (0.25 if team_conf[t] in P4 else 0) for t in tids}
lo, hi = min(raw_t.values()), max(raw_t.values())
talent = {t: round(100 * (raw_t[t] - lo) / (hi - lo)) for t in tids}
avg_grade = {t: (sum(team_recs[t]) / len(team_recs[t]) if team_recs[t] else 65) for t in tids}

# ---- team offense line proxy: rushing ypc and sacks allowed per pass play
tstat = collections.defaultdict(collections.Counter)
for aid, st in s26.items():
    t = steam26.get(aid)
    if not t: continue
    for k in ('rushing.rushingYards', 'rushing.rushingAttempts', 'passing.sacks', 'passing.passingAttempts', 'passing.passingYards'):
        tstat[t][k] += st.get(k, 0)
olq = {}
for t in tids:
    s = tstat[t]
    ypc = s['rushing.rushingYards'] / max(1, s['rushing.rushingAttempts'])
    sk = s['passing.sacks'] / max(1, s['passing.passingAttempts'] + s['passing.sacks'])
    olq[t] = ypc * 1.0 - sk * 25 + fp[t] * 0.04
zo = z(olq)

# ---- production per position
for p in players:
    aid, g26, g25 = p['aid'], p['g26'], p['g25']
    r = lambda k: R(aid, k, g26, g25)
    pos = p['pos']
    if pos == 'QB':
        att = r('passing.passingAttempts')
        ypa = (r('passing.passingYards') / att) if att else 0
        prod = r('passing.passingYards') / 25 + r('passing.passingTouchdowns') * 1.8 - r('passing.interceptions') * 2.2 \
            + r('rushing.rushingYards') / 14 + r('rushing.rushingTouchdowns') * 2 + (ypa - 7) * 2.2 - r('passing.sacks') * 0.4
        if att < 10: prod = prod * (att / 10) - 6
    elif pos == 'RB':
        car = r('rushing.rushingAttempts')
        prod = (r('rushing.rushingYards') + r('receiving.receivingYards')) / 10 + (r('rushing.rushingTouchdowns') + r('receiving.receivingTouchdowns')) * 3 \
            + (r('rushing.rushingYards') / car if car else 0) * 0.6
    elif pos in ('WR', 'TE'):
        prod = r('receiving.receivingYards') / 8 + r('receiving.receptions') * 0.6 + r('receiving.receivingTouchdowns') * 4
    elif pos == 'DL':
        prod = r('defensive.sacks') * 9 + r('defensive.tacklesForLoss') * 3 + r('defensive.totalTackles') * 0.6 + r('general.fumblesForced') * 4 + r('defensive.passesDefended') * 1.5
    elif pos == 'LB':
        prod = r('defensive.soloTackles') + r('defensive.assistTackles') * .5 + r('defensive.tacklesForLoss') * 2 + r('defensive.sacks') * 4 \
            + r('defensive.passesDefended') * 3 + r('defensiveinterceptions.interceptions') * 8 + r('general.fumblesForced') * 3
    elif pos == 'CB':
        prod = r('defensive.passesDefended') * 5 + r('defensiveinterceptions.interceptions') * 12 + r('defensive.soloTackles') * .6
    elif pos == 'S':
        prod = r('defensive.soloTackles') * .8 + r('defensive.assistTackles') * .3 + r('defensive.passesDefended') * 3.5 \
            + r('defensiveinterceptions.interceptions') * 10 + r('general.fumblesForced') * 4
    elif pos == 'K':
        fa = r('kicking.fieldGoalAttempts')
        prod = (r('kicking.fieldGoalsMade') / fa * 100 if fa else 50) + r('kicking.fieldGoalsMade50') * 25 + min(fa, 2) * 5
    elif pos == 'P':
        pa = r('punting.punts'); prod = r('punting.puntYards') / pa if pa else 30
    else:
        prod = 0
    t = p['tid']
    tg = max(1, team_games26.get(p['abbr'], 9))
    share = min(1.0, (g26 + 0.5 * g25) / (tg + 6))  # playing-time proxy
    mult = 0.72 + 0.36 * talent[t] / 100 + (0.06 if team_conf[t] in P4 else 0)
    p['prod'] = (prod * mult if prod > 0 else prod) * (0.65 + 0.35 * share)
    p['share'] = share

def pct_rank(vals):
    srt = sorted(vals); n = max(1, len(srt))
    import bisect
    return lambda v: (bisect.bisect_left(srt, v) + 0.5 * (bisect.bisect_right(srt, v) - bisect.bisect_left(srt, v))) / n

STARTERS = {'QB': 1, 'RB': 1, 'WR': 3, 'TE': 1, 'OL': 5, 'DL': 4, 'LB': 3, 'CB': 2, 'S': 2, 'K': 1, 'P': 1}
by_pos = collections.defaultdict(list)
for p in players: by_pos[p['pos']].append(p)
NT = len(tids)
for pos, arr in by_pos.items():
    fpr = pct_rank([p['prod'] for p in arr])
    for p in arr:
        t = p['tid']
        g = p['grade'] or (avg_grade[t] - 6)          # unranked: assume a bit below the team's typical recruit
        recf = max(0, min(1, (g - 62) / 32))
        tal = talent[t] / 100
        clsf = (p['cls'] - 1) / 3 + 0.1 * p['rs']
        if pos == 'OL':
            olf = (zo[t] + 2.5) / 5
            # likely starters: older, higher recruits, heavier
            p['score'] = 0.30 * tal + 0.22 * recf + 0.30 * clsf + 0.12 * max(0, min(1, olf)) + 0.06 * max(0, min(1, (p['wt'] - 285) / 40))
        elif pos in ('K', 'P'):
            p['score'] = 0.8 * fpr(p['prod']) + 0.1 * tal + 0.1 * clsf
        else:
            has = p['g26'] + p['g25'] > 0
            p['score'] = 0.58 * fpr(p['prod']) + 0.14 * recf + 0.12 * tal + 0.10 * clsf + 0.06 * p['share'] - (0 if has else 0.05)
    arr.sort(key=lambda p: -p['score'])
    S = STARTERS[pos] * NT
    for i, p in enumerate(arr):
        k = i / S
        ovr = 98 - 30 * (k ** 0.75) if k <= 1 else 68 - 9 * (k - 1)
        if i == 0 and pos in ('QB', 'WR', 'DL', 'CB', 'RB'): ovr = 99
        if pos == 'OL': ovr = min(ovr, 96)
        if pos in ('K', 'P'): ovr = min(ovr, 94)
        p['ovr'] = int(round(max(45, min(99, ovr))))

# within each team keep depth order sane: a backup with no production cannot outrank the team's
# productive starter by more than the curve suggests -> nothing to do; but bump true freshmen floors
for p in players:
    st = stars_of(p['grade'])
    if p['cls'] == 1 and p['g26'] == 0:
        floor = {5: 66, 4: 60, 3: 54, 2: 50}.get(st, 50)
        cap = {5: 74, 4: 70, 3: 66, 2: 62}.get(st, 64)
        p['ovr'] = max(floor, min(cap, p['ovr']))

# ---- trim rosters
KEEP = {'QB': 3, 'RB': 4, 'WR': 7, 'TE': 4, 'OL': 10, 'DL': 9, 'LB': 7, 'CB': 6, 'S': 5, 'K': 1, 'P': 1}
by_team = collections.defaultdict(list)
for p in players: by_team[p['abbr']].append(p)
final = []
for ab, arr in by_team.items():
    arr.sort(key=lambda p: -p['ovr'])
    keep, cnt = [], collections.Counter()
    for p in arr:
        if cnt[p['pos']] < KEEP[p['pos']]: keep.append(p); cnt[p['pos']] += 1
    rest = [p for p in arr if p not in keep and p['pos'] not in ('K', 'P')]
    keep += rest[:max(0, 78 - len(keep))]
    final += keep

allo = sorted((p['ovr'] for p in final), reverse=True)
x_cut = allo[int(len(allo) * 0.015)]; s_cut = allo[int(len(allo) * 0.11)]
out_players = []
for p in final:
    a = p['a']; ovr = p['ovr']; st = stars_of(p['grade']); cls = p['cls']
    h = hsh(a.get('fullName', '') + p['abbr'])
    up = {1: 11 + h % 9, 2: 7 + h % 7, 3: 3 + h % 5, 4: h % 3}[cls] + max(0, st - 3) * 2 + (2 if p['rs'] and cls <= 2 else 0)
    pot = min(99, ovr + up)
    if ovr >= x_cut and ovr >= 88: dev = 'X'
    elif ovr >= s_cut or (st == 5 and cls <= 2) or (pot >= 90 and cls <= 2): dev = 'S'
    else: dev = 'N'
    ov = {}
    if p['pos'] == 'QB':
        ry = R(p['aid'], 'rushing.rushingYards', p['g26'], p['g25'])
        if ry > 30: ov['spd'] = round(min(93, 72 + ry / 3.5))
    out_players.append([a.get('firstName', ''), a.get('lastName', ''), p['pos'], cls, p['rs'], int(num(a.get('jersey'), 0)), ovr, pot, dev,
                        p['home'], st, p['abbr'], ov or 0])

# ---- teams
psc = {}
for t in tids:
    d = tdet[t]; ab = id2abbr[t]
    c1 = hexc(d.get('color'), '333333'); c2 = hexc(d.get('alternateColor'), 'FFFFFF')
    if cdist(c1, c2) < 120: c2 = '#FFFFFF' if lum(c1) < 140 else '#000000'
    if cdist(c1, c2) < 120: c2 = '#000000'
    coach = ' '.join(filter(None, [(rosters[t].get('coach') or [{}])[0].get('firstName'), (rosters[t].get('coach') or [{}])[0].get('lastName')]))
    v = tcore[t].get('venue') or {}
    state = (v.get('address') or {}).get('state', '')
    school = d.get('location') or d.get('shortDisplayName') or ab
    sc = talent[t] / 100 * 4 + BRAND.get(school, 0) * 0.8 + team_wins[ab] / max(1, team_games26[ab]) * 0.6
    psc[ab] = sc
    teams_out.append([ab, school, d.get('name') or '', c1, c2, team_conf[t], coach, re.sub(r'\s*\(.*\)$', '', v.get('fullName', '')), state if len(state) == 2 else '', 0, talent[t]])

rk = {ab: i for i, ab in enumerate(sorted(psc, key=lambda a: -psc[a]))}
for t in teams_out:
    i = rk[t[0]]; t[9] = 6 if i < 11 else 5 if i < 24 else 4 if i < 48 else 3 if i < 76 else 2 if i < 106 else 1
data = {'season': SEASON, 'source': 'ESPN public college football data (rosters, stats, recruiting grades, FPI, schedules)', 'asOf': as_of,
        'teams': teams_out, 'players': out_players, 'schedule': weeks}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write("// Generated by tools/build_cfb_data.py from public CollegeFootballData.com / ESPN data. Ratings and NIL values are this game's own estimates.\n")
    f.write('const CFB_DATA = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')

# ---------------------------------------------------------------- summary
print('teams', len(teams_out), dict(collections.Counter(t[5] for t in teams_out)))
print('players', len(out_players), 'per team min/max', min(collections.Counter(p[11] for p in out_players).values()), max(collections.Counter(p[11] for p in out_players).values()))
print('weeks', len(weeks), 'games', sum(len(w) for w in weeks), 'asOf', as_of, 'size KB', os.path.getsize(OUT) // 1024)
print('stars', collections.Counter(p[10] for p in out_players), 'rs', sum(p[4] for p in out_players), 'dev', collections.Counter(p[8] for p in out_players))
print('TOP 15'); [print(' ', p[6], p[8], p[2], p[0], p[1], p[11]) for p in sorted(out_players, key=lambda p: -p[6])[:15]]
print('TOP QBs'); [print(' ', p[6], p[2], p[0], p[1], p[11]) for p in sorted([p for p in out_players if p[2] == 'QB'], key=lambda p: -p[6])[:12]]
print('prestige 6/5:', [t[0] for t in teams_out if t[9] >= 5])
for ab in ('OSU', 'UGA', 'TEX', 'IU', 'ALA', 'TOL'):
    t = next((x for x in teams_out if x[0] == ab), None)
    if not t: continue
    print(t)
    ps = sorted([p for p in out_players if p[11] == ab], key=lambda p: -p[6])
    print('   ', ', '.join(f'{p[2]} {p[0][0]}.{p[1]} {p[6]}' for p in ps[:14]))
    print('    QBs', [(p[1], p[6], p[3], p[10]) for p in ps if p[2] == 'QB'])
