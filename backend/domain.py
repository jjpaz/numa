"""Transparent demo heuristics; neither a clinical score nor causal inference."""
from datetime import datetime, timezone, timedelta
from statistics import median

ACTIONS = {
    'walk': {'title': 'A small change of scenery', 'description': 'Take a gentle five-minute walk, if that feels comfortable and accessible.', 'minutes': 5, 'label': 'Short walk'},
    'music': {'title': 'Make room for a favourite song', 'description': 'Choose a familiar song. Give yourself a few minutes just to listen.', 'minutes': 3, 'label': 'Your music'},
    'breathe': {'title': 'A moment to slow down', 'description': 'Follow the circle for a minute. Breathe comfortably, without holding your breath.', 'minutes': 1, 'label': 'Quiet breathing'},
    'connect': {'title': 'A little human connection', 'description': 'Send someone you trust a low-pressure hello. You do not have to explain everything.', 'minutes': 2, 'label': 'Reach out'},
}
FEATURE_FLOORS = {'energy': .01, 'pause_ratio': .06}

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def baseline_and_trend(entries):
    # A later entry on a given day replaces that day's representative; follow-ups never train baseline.
    days = {}
    for entry in sorted(entries, key=lambda e: e['created_at']):
        voice = entry.get('voice') or {}
        if entry.get('saved') and voice.get('quality') == 'valid':
            days[entry['created_at'][:10]] = entry
    ordered = list(days.values())
    baseline_rows = ordered[:5]
    if len(baseline_rows) < 5:
        return {'ready': False, 'days': len(baseline_rows), 'required_days': 5, 'persistent_change': False, 'points': []}
    centre = {key: median(e['voice']['features'][key] for e in baseline_rows) for key in FEATURE_FLOORS}
    spread = {key: max(FEATURE_FLOORS[key], 1.4826 * median(abs(e['voice']['features'][key]-centre[key]) for e in baseline_rows)) for key in FEATURE_FLOORS}
    points = []
    for index, entry in enumerate(ordered):
        features = entry['voice']['features']
        deviations = {key: round((features[key]-centre[key])/spread[key], 3) for key in FEATURE_FLOORS}
        outside = index >= 5 and any(abs(v) > 3 for v in deviations.values())
        points.append({'date': entry['created_at'][:10], 'deviation': max(abs(v) for v in deviations.values()), 'outside': outside, 'baseline': index < 5, 'energy': features['energy'], 'pause_ratio': features['pause_ratio']})
    return {'ready': True, 'days': len(ordered), 'required_days': 5, 'centre': centre, 'spread': spread, 'persistent_change': len(points) >= 8 and all(p['outside'] for p in points[-3:]), 'points': points}

def patterns(entries):
    results = []
    for kind, spec in ACTIONS.items():
        trials = [e['action'] for e in entries if e.get('saved') and e.get('action', {}).get('kind') == kind and e['action'].get('feedback') in ('helpful','not_helpful')]
        if trials:
            helpful = sum(t['feedback'] == 'helpful' for t in trials)
            results.append({'kind': kind, 'label': spec['label'], 'observations': len(trials), 'helpful': helpful, 'text': f"You reported {spec['label'].lower()} helpful in {helpful} of {len(trials)} responses. This is a personal association, not proof of cause."})
    return sorted(results, key=lambda p: (-p['observations'], p['kind']))

def recommend(entries, preferences, context):
    allowed = [k for k in preferences if k in ACTIONS] or list(ACTIONS)
    scored = []
    for kind in allowed:
        trials = [e for e in entries if e.get('saved') and e.get('action', {}).get('kind') == kind and e['action'].get('feedback') in ('helpful', 'not_helpful')]
        similar = [e for e in trials if (e.get('context', {}).get('sleep_hours', 8) < 7) == (context.get('sleep_hours', 8) < 7)]
        evidence = similar or trials
        helpful = sum(e['action']['feedback'] == 'helpful' for e in evidence)
        scored.append(((helpful+1)/(len(evidence)+2), len(evidence), kind, helpful, bool(similar)))
    score, count, kind, helpful, matched_context = max(scored, key=lambda p: (p[0], p[1], -allowed.index(p[2])))
    reason = f"You found this helpful in {helpful} of {count} previous responses{' on days with similar sleep' if matched_context else ''}." if count else 'A small option based on your preferences. We are still learning what works for you.'
    return {'kind': kind, **ACTIONS[kind], 'reason': reason, 'evidence_count': count}

def simulated_context(date=None):
    day = int((date or utcnow())[:10].replace('-', ''))
    return {'source': 'simulated', 'sleep_hours': [6.2,7.4,8.1,5.8][day % 4], 'steps': [2400,5100,7200,3900][day % 4], 'outdoor_minutes': [12,25,40,8][day % 4], 'weather': ['Cloudy','Light rain','Clear','Overcast'][day % 4], 'temperature_c': 9 + day % 5, 'music_minutes': 15 + day % 35}

def clinical_projection(user, entries, notes):
    saved = sorted([e for e in entries if e.get('saved')], key=lambda e:e['created_at'])
    trend = baseline_and_trend(saved)
    return {'id': user['id'], 'name': user['name'], 'initials': ''.join(x[0] for x in user['name'].split()), 'source': user['source'], 'entry_count': len(saved), 'last_entry_at': saved[-1]['created_at'] if saved else None, 'trend': trend, 'context': saved[-1].get('context') if saved else simulated_context(), 'contexts': [{'date':e['created_at'][:10], **e['context']} for e in saved], 'patterns': patterns(saved), 'actions_completed': sum(bool(e.get('action',{}).get('completed_at')) for e in saved), 'follow_up_count': sum(bool(e.get('follow_up',{}).get('voice')) for e in saved), 'notes': notes, 'status': 'review' if trend['persistent_change'] else 'learning' if not trend['ready'] else 'steady'}
