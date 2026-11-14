"""Progressive disclosure is chosen by the patient, never assigned by mental state."""
from copy import deepcopy
from .domain import ACTIONS, patterns, baseline_and_trend, utcnow

MODULES = ('sleep', 'activity', 'music', 'habits', 'patterns', 'voice', 'experiments')
DEFAULT_GROWTH = {
    'modules': [],
    'simple_mode': False,
    'dismissed_invitations': [],
    'snoozed_on': None,
    'remembered_pages': 0,
    'habit_label': '',
    'habit_days': [],
}

def growth_settings(user):
    return {**deepcopy(DEFAULT_GROWTH), **deepcopy(user.get('growth', {}))}

def growth_projection(user, entries):
    settings = growth_settings(user)
    saved = [e for e in entries if e.get('saved')]
    depth = max(settings['remembered_pages'], len(saved))
    invitations = []
    if not settings['simple_mode'] and settings['snoozed_on'] != utcnow()[:10]:
        if 'patterns' not in settings['modules']:
            for pattern in patterns(saved):
                key = 'pattern-' + pattern['kind']
                if pattern['observations'] >= 3 and key not in settings['dismissed_invitations']:
                    invitations.append({
                        'id': key, 'module': 'patterns',
                        'title': 'A small thread in your story',
                        'text': f"You have left feedback on {pattern['label'].lower()} {pattern['observations']} times. Would you like to explore what you noticed?",
                        'evidence_count': pattern['observations'],
                    })
        if 'voice' not in settings['modules'] and 'voice-reference' not in settings['dismissed_invitations'] and baseline_and_trend(saved)['ready']:
            invitations.append({'id': 'voice-reference', 'module': 'voice', 'title': 'Your own reference is taking shape', 'text': 'There is enough recorded history to explore your voice over time. Only if you are curious.', 'evidence_count': len(saved)})
    return {
        **settings,
        'remembered_pages': depth,
        'art_stage': 'bloom' if depth >= 8 else 'leaves' if depth >= 3 else 'sprout',
        'invitations': invitations[:1],
        'habit_done_today': utcnow()[:10] in settings['habit_days'],
    }
