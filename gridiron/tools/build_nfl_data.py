#!/usr/bin/env python3
"""
Build gridiron/src/nfl_data.js from public nflverse data.

Inputs (download into a folder and pass it as argv[1]):
  roster_2026.csv, stats_player_week_2026.csv, stats_player_reg_2025.csv,
  snap_counts_2026.csv, snap_counts_2025.csv, combine.csv,
  historical_contracts.csv.gz, games.csv
from https://github.com/nflverse/nflverse-data/releases and nflverse/nfldata.

Player OVRs are this game's own model: a blend of on-field production (2026 so far
plus 2025), playing time (snap share), draft pedigree and age, ranked within each
position and mapped onto a 45-99 scale. Speed/Strength/Agility come from real
combine results when available. No ratings are copied from any video game.
"""
import csv, gzip, json, os, sys, collections, datetime, math, re

D = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'nfl_data.js')
SEASON = 2026
REF_DATE = datetime.date(SEASON, 9, 1)

TEAMS = {  # abbr: city, nickname, primary, secondary, conf, div
    'BUF': ('Buffalo', 'Bills', '#00338D', '#C60C30', 'AFC', 'East'), 'MIA': ('Miami', 'Dolphins', '#008E97', '#FC4C02', 'AFC', 'East'),
    'NE': ('New England', 'Patriots', '#002244', '#C60C30', 'AFC', 'East'), 'NYJ': ('New York', 'Jets', '#125740', '#FFFFFF', 'AFC', 'East'),
    'BAL': ('Baltimore', 'Ravens', '#241773', '#9E7C0C', 'AFC', 'North'), 'CIN': ('Cincinnati', 'Bengals', '#FB4F14', '#000000', 'AFC', 'North'),
    'CLE': ('Cleveland', 'Browns', '#311D00', '#FF3C00', 'AFC', 'North'), 'PIT': ('Pittsburgh', 'Steelers', '#101820', '#FFB612', 'AFC', 'North'),
    'HOU': ('Houston', 'Texans', '#03202F', '#A71930', 'AFC', 'South'), 'IND': ('Indianapolis', 'Colts', '#002C5F', '#FFFFFF', 'AFC', 'South'),
    'JAX': ('Jacksonville', 'Jaguars', '#006778', '#D7A22A', 'AFC', 'South'), 'TEN': ('Tennessee', 'Titans', '#0C2340', '#4B92DB', 'AFC', 'South'),
    'DEN': ('Denver', 'Broncos', '#FB4F14', '#002244', 'AFC', 'West'), 'KC': ('Kansas City', 'Chiefs', '#E31837', '#FFB81C', 'AFC', 'West'),
    'LV': ('Las Vegas', 'Raiders', '#000000', '#A5ACAF', 'AFC', 'West'), 'LAC': ('Los Angeles', 'Chargers', '#0080C6', '#FFC20E', 'AFC', 'West'),
    'DAL': ('Dallas', 'Cowboys', '#003594', '#869397', 'NFC', 'East'), 'NYG': ('New York', 'Giants', '#0B2265', '#A71930', 'NFC', 'East'),
    'PHI': ('Philadelphia', 'Eagles', '#004C54', '#A5ACAF', 'NFC', 'East'), 'WAS': ('Washington', 'Commanders', '#5A1414', '#FFB612', 'NFC', 'East'),
    'CHI': ('Chicago', 'Bears', '#0B162A', '#C83803', 'NFC', 'North'), 'DET': ('Detroit', 'Lions', '#0076B6', '#B0B7BC', 'NFC', 'North'),
    'GB': ('Green Bay', 'Packers', '#203731', '#FFB612', 'NFC', 'North'), 'MIN': ('Minnesota', 'Vikings', '#4F2683', '#FFC62F', 'NFC', 'North'),
    'ATL': ('Atlanta', 'Falcons', '#A71930', '#000000', 'NFC', 'South'), 'CAR': ('Carolina', 'Panthers', '#0085CA', '#101820', 'NFC', 'South'),
    'NO': ('New Orleans', 'Saints', '#101820', '#D3BC8D', 'NFC', 'South'), 'TB': ('Tampa Bay', 'Buccaneers', '#D50A0A', '#34302B', 'NFC', 'South'),
    'ARI': ('Arizona', 'Cardinals', '#97233F', '#FFB612', 'NFC', 'West'), 'LA': ('Los Angeles', 'Rams', '#003594', '#FFA300', 'NFC', 'West'),
    'SF': ('San Francisco', '49ers', '#AA0000', '#B3995D', 'NFC', 'West'), 'SEA': ('Seattle', 'Seahawks', '#002244', '#69BE28', 'NFC', 'West'),
}
STARTERS = {'QB': 1, 'RB': 1, 'WR': 3, 'TE': 1, 'OL': 5, 'DL': 4, 'LB': 2, 'CB': 2, 'S': 2, 'K': 1, 'P': 1}


def rd(name):
    p = os.path.join(D, name)
    f = gzip.open(p, 'rt', encoding='utf-8') if name.endswith('.gz') else open(p, encoding='utf-8')
    return list(csv.DictReader(f))


def num(x, d=0.0):
    try:
        v = float(x)
        return d if math.isnan(v) else v
    except (TypeError, ValueError):
        return d


def norm(s):
    return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', (s or '').lower()))


def game_pos(r, wt):
    dp, p = r['depth_chart_position'] or r['position'], r['position']
    if p == 'QB': return 'QB'
    if dp in ('RB', 'FB', 'HB') or p == 'RB': return 'RB'
    if p == 'WR': return 'WR'
    if p == 'TE': return 'TE'
    if p == 'OL' or dp in ('T', 'G', 'C', 'OT', 'OG'): return 'OL'
    if dp in ('DE', 'DT', 'NT') or p == 'DL': return 'DL'
    if dp == 'OLB': return 'DL' if wt >= 246 else 'LB'
    if dp in ('ILB', 'MLB', 'LB') or p == 'LB': return 'LB'
    if dp in ('CB', 'NB'): return 'CB'
    if dp in ('FS', 'SS', 'S', 'SAF'): return 'S'
    if p == 'DB': return 'CB'
    if p == 'K': return 'K'
    if p == 'P': return 'P'
    return None


roster = rd('roster_2026.csv')
latest = {}
for r in roster:
    k = r['gsis_id'] or r['full_name']
    if k not in latest or int(num(r['week'])) >= int(num(latest[k]['week'])):
        latest[k] = r

# ---- stats: 2026 weekly sums + 2025 season ----
STAT_KEYS = ['completions', 'attempts', 'passing_yards', 'passing_tds', 'passing_interceptions', 'sacks_suffered', 'passing_epa', 'carries', 'rushing_yards',
             'rushing_tds', 'rushing_epa', 'receptions', 'targets', 'receiving_yards', 'receiving_tds', 'def_tackles_solo', 'def_tackle_assists', 'def_tackles_for_loss',
             'def_sacks', 'def_qb_hits', 'def_interceptions', 'def_pass_defended', 'def_fumbles_forced', 'fg_made', 'fg_att', 'fg_made_50_59', 'fg_made_60_', 'pt_att', 'pt_yards', 'pt_net_yards']
s26 = collections.defaultdict(lambda: collections.Counter()); g26 = collections.Counter()
for r in rd('stats_player_week_2026.csv'):
    if r['season_type'] != 'REG': continue
    pid = r['player_id']; g26[pid] += 1
    for k in STAT_KEYS: s26[pid][k] += num(r.get(k))
s25 = {}; g25 = {}
for r in rd('stats_player_reg_2025.csv'):
    pid = r['player_id']; s25[pid] = {k: num(r.get(k)) for k in STAT_KEYS}; g25[pid] = num(r.get('games'), 0) or 1

def rate(pid, k):
    a, ga = s26[pid][k] if pid in s26 else 0, g26.get(pid, 0)
    b, gb = (s25[pid][k], g25[pid]) if pid in s25 else (0, 0)
    g = ga + 0.5 * gb
    return (a + 0.5 * b) / g if g else 0.0

def games(pid):
    return g26.get(pid, 0) + 0.5 * g25.get(pid, 0)

# ---- snap share ----
team_games = collections.Counter(); snaps = collections.defaultdict(lambda: [0.0, 0.0])
for fn, w in (('snap_counts_2026.csv', 1.0), ('snap_counts_2025.csv', 0.5)):
    seen = set()
    for r in rd(fn):
        if r['game_type'] != 'REG': continue
        tg = (r['game_id'], r['team'])
        if tg not in seen: seen.add(tg); team_games[(fn, r['team'])] += 1
        pct = max(num(r['offense_pct']), num(r['defense_pct']), num(r['st_pct']) * 0.25)
        snaps[r['pfr_player_id']][0] += pct * w
        snaps[r['pfr_player_id']][1] += w
avg_team_g26 = max(1, sum(v for (f, t), v in team_games.items() if f == 'snap_counts_2026.csv') / 32)
def snap_share(pfr):
    s = snaps.get(pfr)
    if not s: return 0.0
    return s[0] / (avg_team_g26 + 0.5 * 17)

# ---- combine ----
comb = {r['pfr_id']: r for r in rd('combine.csv') if r['pfr_id']}

# ---- contracts ----
NICK2ABBR = {v[1]: k for k, v in TEAMS.items()}
contracts = {}
for c in rd('historical_contracts.csv.gz'):
    if c['is_active'] not in ('TRUE', 'True', 'true', '1'): continue
    key = norm(c['player'])
    if key not in contracts or num(c['year_signed']) > num(contracts[key]['year_signed']): contracts[key] = c

# ---- coaches ----
coach = {}
for g in rd('games.csv'):
    if g['season'] != str(SEASON): continue
    if g['home_coach']: coach[g['home_team']] = (int(num(g['week'])), g['home_coach']) if g['home_coach'] and (g['home_team'] not in coach or int(num(g['week'])) >= coach[g['home_team']][0] and g['home_score'] != '') else coach.get(g['home_team'], (0, g['home_coach']))
    if g['away_coach']: coach[g['away_team']] = (int(num(g['week'])), g['away_coach']) if g['away_coach'] and (g['away_team'] not in coach or int(num(g['week'])) >= coach[g['away_team']][0] and g['away_score'] != '') else coach.get(g['away_team'], (0, g['away_coach']))
schedule = collections.defaultdict(list)
for g in rd('games.csv'):
    if g['season'] == str(SEASON) and g['game_type'] == 'REG':
        schedule[int(num(g['week']))].append([g['home_team'], g['away_team']])

# ---- build player records ----
players = []
for r in latest.values():
    if r['status'] not in ('ACT', 'CUT', 'RES'): continue
    if r['status'] in ('ACT', 'RES') and r['team'] not in TEAMS: continue
    wt = num(r['weight'], 220)
    pos = game_pos(r, wt)
    if not pos: continue
    try: bd = datetime.date.fromisoformat(r['birth_date'])
    except ValueError: bd = None
    age = (REF_DATE - bd).days // 365 if bd else 22 + int(num(r['years_exp']))
    pid = r['gsis_id']
    rec = dict(r=r, pos=pos, age=age, wt=wt, pid=pid, exp=int(num(r['years_exp'])), gp=games(pid), snap=snap_share(r['pfr_id']))
    R = lambda k: rate(pid, k)
    if pos == 'QB':
        plays = R('attempts') + R('sacks_suffered') + R('carries')
        epa = (R('passing_epa') + R('rushing_epa')) / plays if plays > 1 else -0.3
        prod = epa * 12 + R('passing_yards') / 30 + R('passing_tds') * 1.5 - R('passing_interceptions') * 2 + R('rushing_yards') / 20
        if R('attempts') < 8: prod -= 6
    elif pos == 'RB': prod = (R('rushing_yards') + R('receiving_yards')) / 12 + (R('rushing_tds') + R('receiving_tds')) * 3 + (R('rushing_yards') / max(1, R('carries'))) * 0.6
    elif pos in ('WR', 'TE'): prod = R('receiving_yards') / 8 + R('receptions') * 0.6 + R('receiving_tds') * 4
    elif pos == 'DL': prod = R('def_sacks') * 9 + R('def_qb_hits') * 2.5 + R('def_tackles_for_loss') * 2.5 + (R('def_tackles_solo') + R('def_tackle_assists') * .5) * .5
    elif pos == 'LB': prod = R('def_tackles_solo') + R('def_tackle_assists') * .5 + R('def_tackles_for_loss') * 2 + R('def_sacks') * 4 + R('def_pass_defended') * 3 + R('def_interceptions') * 8
    elif pos == 'CB': prod = R('def_pass_defended') * 5 + R('def_interceptions') * 12 + R('def_tackles_solo') * .5
    elif pos == 'S': prod = R('def_tackles_solo') * .8 + R('def_pass_defended') * 3.5 + R('def_interceptions') * 10 + R('def_fumbles_forced') * 4
    elif pos == 'K':
        fa = R('fg_att'); prod = (R('fg_made') / fa * 100 if fa else 60) + R('fg_made_50_59') * 20 + R('fg_made_60_') * 30
    else:
        pa = R('pt_att'); prod = (R('pt_net_yards') / pa) if pa else 30
    dn = num(r['draft_number'], 0)
    ped = (300 - dn) / 300 if dn else 0.0
    rec['prod'] = prod; rec['ped'] = ped
    players.append(rec)

def pct_rank(vals):
    srt = sorted(vals)
    return lambda v: (sum(1 for x in srt if x < v) + 0.5 * sum(1 for x in srt if x == v)) / max(1, len(srt))

by_pos = collections.defaultdict(list)
for p in players: by_pos[p['pos']].append(p)
W = {'QB': (.6, .25, .15), 'OL': (0, .72, .28), 'K': (.75, .1, .15), 'P': (.75, .1, .15)}
for pos, arr in by_pos.items():
    fp, fs, fd = pct_rank([p['prod'] for p in arr]), pct_rank([p['snap'] for p in arr]), pct_rank([p['ped'] for p in arr])
    wp, ws, wd = W.get(pos, (.45, .37, .18))
    for p in arr:
        age = p['age']
        agef = -0.04 if age >= 33 else (-0.02 if age >= 31 else 0)
        expf = min(p['exp'], 6) / 6 * (0.14 if pos == 'OL' else 0.07)  # proven vets over one-year flashes
        if p['exp'] == 0: agef -= 0.07
        elif p['exp'] == 1: agef -= 0.03
        p['score'] = wp * fp(p['prod']) + ws * fs(p['snap']) + wd * fd(p['ped']) + agef + expf
        if p['r']['status'] == 'CUT': p['score'] -= 0.25
        if p['r']['status'] == 'RES': p['score'] += 0.04  # stats shortened by injury
    arr.sort(key=lambda p: -p['score'])
    S = STARTERS[pos] * 32
    for i, p in enumerate(arr):
        k = i / S
        ovr = 97 - 24 * (k ** 0.62) if k <= 1 else 73 - 17 * (k - 1)
        if i == 0 and pos not in ('K', 'P'): ovr = 99 if pos in ('QB', 'WR', 'DL', 'CB') else 98
        if pos in ('K', 'P'): ovr = min(ovr, 94)
        p['ovr'] = int(round(max(45, min(99, ovr))))

out_players = []
for p in players:
    r = p['r']; ovr = p['ovr']; age = p['age']
    dn = int(num(r['draft_number'], 0))
    if (ovr >= 87 and age <= 31) or (ovr >= 84 and age <= 24) or (ovr >= 92 and age <= 34): dev = 'X'
    elif ovr >= 82 or (age <= 24 and 0 < dn <= 24) or (ovr >= 78 and age <= 25): dev = 'S'
    else: dev = 'N'
    ov = {}
    c = comb.get(r['pfr_id'])
    if c:
        f = num(c['forty'], 0)
        if f: ov['spd'] = round(max(40, min(99, 98 - (f - 4.25) * 40 - max(0, age - 28) * 1.2)))
        b = num(c['bench'], 0)
        if b: ov['str'] = round(max(40, min(99, 48 + b * 1.45)))
        cone = num(c['cone'], 0)
        if cone: ov['agi'] = round(max(40, min(99, 95 - (cone - 6.7) * 37 - max(0, age - 29))))
    if p['pos'] == 'QB' and rate(p['pid'], 'rushing_yards') > 25: ov['spd'] = max(ov.get('spd', 0), round(min(94, 74 + rate(p['pid'], 'rushing_yards') / 4)))
    con = contracts.get(norm(r['full_name']))
    if con and (NICK2ABBR.get(con['team']) == r['team'] or r['status'] == 'CUT'):
        sal = round(num(con['apy']) / 1e6, 2); yrs = int(max(1, min(6, num(con['year_signed']) + num(con['years']) - SEASON)))
    else:
        sal = round(max(0.84, (11 - dn * 0.04) if 0 < dn <= 32 else 1.1), 2) if p['exp'] <= 3 else 1.3; yrs = max(1, 4 - p['exp']) if p['exp'] <= 3 else 1
    if r['status'] == 'CUT': yrs = 1
    entry_year = int(num(r['entry_year'] or r['rookie_year'], SEASON - p['exp']))
    out_players.append([
        r['football_name'] or r['first_name'], r['last_name'], p['pos'], age, int(num(r['jersey_number'], 0)), ovr, dev,
        (r['college'] or '').split(';')[0].strip(), sal, yrs, r['team'] if r['status'] in ('ACT', 'RES') else '', entry_year, dn, ov or 0, p['exp'], (5 + sum(map(ord, r['full_name'])) % 8) if r['status'] == 'RES' else 0,
    ])

teams = []
for abbr, (city, nick, c1, c2, conf, div) in TEAMS.items():
    teams.append([abbr, city, nick, c1, c2, conf, div, coach.get(abbr, (0, ''))[1]])
weeks = [schedule[w] for w in sorted(schedule)]
data = {'season': SEASON, 'source': 'nflverse (rosters, stats, snap counts, combine, OverTheCap contracts, schedules)', 'asOf': max(int(num(r['week'])) for r in roster),
        'teams': teams, 'players': out_players, 'schedule': weeks}
with open(OUT, 'w') as f:
    f.write('// Generated by tools/build_nfl_data.py from public nflverse data. Ratings are this game\'s own model.\n')
    f.write('const NFL_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
cnt = collections.Counter(p[10] for p in out_players)
print('players', len(out_players), 'FA', cnt[''], 'per team min/max', min(v for k, v in cnt.items() if k), max(cnt.values() if False else [v for k, v in cnt.items() if k]))
print('weeks', len(weeks), 'games', sum(len(w) for w in weeks), 'size KB', os.path.getsize(OUT) // 1024)
top = sorted(out_players, key=lambda p: -p[5])[:12] + sorted([p for p in out_players if p[2]=='QB' and p[10]], key=lambda p: -p[5])[:20]
for p in top: print(p[5], p[6], p[2], p[0], p[1], p[10], p[3])

