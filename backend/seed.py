from datetime import datetime, timezone, timedelta
from .domain import simulated_context

USERS = [
    {'id':'patient-live','name':'Alex Morgan','email':'patient@numa.demo','role':'patient','source':'live','preferences':['walk','music','breathe','connect']},
    {'id':'patient-sample','name':'Robin Ellis','email':'sample@numa.demo','role':'patient','source':'simulated','preferences':['walk','music','breathe','connect']},
    {'id':'patient-jamie','name':'Jamie Chen','email':'jamie@numa.demo','role':'patient','source':'simulated','preferences':['music','breathe']},
    {'id':'patient-sam','name':'Sam Taylor','email':'sam@numa.demo','role':'patient','source':'simulated','preferences':['connect','walk']},
    {'id':'psychologist','name':'Dr. Emma Reed','email':'psychologist@numa.demo','role':'psychologist','source':'demo','assigned':['patient-live','patient-sample','patient-jamie','patient-sam']},
]
TEXTS = [
 ('A slower start', 'Made coffee and read a few pages by the window. I am looking forward to seeing my sister.', ['reading','family'], []),
 ('A pocket of fresh air', 'Went around the park after lunch. The trees are turning gold. I felt calm sitting on a bench.', ['outside','walking'], [{'feeling':'calm','evidence':'I felt calm sitting on a bench.'}]),
 ('An ordinary little day', 'Worked from home and made soup. Listened to an old favourite album while cooking.', ['music','cooking'], []),
 ('A familiar voice', 'My friend called this afternoon. We talked about her new puppy and planned a coffee.', ['social','friends'], []),
 ('Room to pause', 'Took a quieter morning. I felt tired, so I left the washing until later.', ['rest'], [{'feeling':'tired','evidence':'I felt tired'}]),
 ('Small things', 'A short walk before work and a warm lunch. I noticed the light coming through the kitchen.', ['walking','routine'], []),
 ('Back to my playlist', 'Put my headphones on for the bus. It was nice to hear something familiar.', ['music','routine'], []),
 ('Making a little space', 'Finished work early and took my tea outside. Watched the neighbours walking their dogs.', ['outside','rest'], []),
 ('A rainy afternoon', 'Stayed indoors most of the day. I did not sleep much and felt overwhelmed by my to-do list.', ['sleep','routine'], [{'feeling':'overwhelmed','evidence':'felt overwhelmed by my to-do list'}]),
 ('Keeping things simple', 'Cancelled some plans and made an easy dinner. Did not get outside today.', ['routine','rest'], []),
 ('One thing at a time', 'Another slow morning. Answered a message from my friend and watered the plants.', ['social','routine'], []),
 ('A small step outside', 'Went to the corner shop and took the longer way home. The air was cool and the street was quiet.', ['outside','walking'], []),
]

def seed(repo):
    for user in USERS:
        if not repo.get('users',user['id']): repo.put('users',user['id'],user)
    for pi, uid in enumerate(['patient-sample','patient-jamie','patient-sam']):
        if repo.get('metadata',f'seed-{uid}'): continue
        for i,(title,text,tags,explicit) in enumerate(TEXTS):
            date = (datetime.now(timezone.utc)-timedelta(days=11-i)).replace(hour=9,minute=15,second=0,microsecond=0).isoformat()
            drift = uid=='patient-sample' and i>=9
            kind = ['walk','music','walk','connect','breathe','walk','music','walk','breathe','music','walk','walk'][i]
            entry = {'id':f'seed-{uid}-{i}','patient_id':uid,'created_at':date,'saved':True,'source':'simulated','status':'completed','transcript':text,'summary':text,'title':title,'tags':tags,'explicit':explicit,'semantic_source':'simulated','context':simulated_context(date),'voice':{'quality':'valid','source':'simulated','model':'illustrative-fixture','model_revision':'fixture-v1','probabilities':{'neutral':.6,'happy':.2,'sad':.15,'angry':.05},'features':{'energy':(.026 if drift else .065)+.002*(i%3),'pause_ratio':(.54 if drift else .22)+.01*(i%3),'duration_sec':32},'observation':'Illustrative voice measurements from a fictional journal.'},'action':{'kind':kind,'completed_at':date,'feedback':'helpful' if kind=='walk' or i%3 else 'not_helpful'}}
            repo.put('entries',entry['id'],entry,uid)
        repo.put('metadata',f'seed-{uid}',{'version':1})
