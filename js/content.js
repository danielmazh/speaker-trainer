// Speaker Trainer - content module (owner: content).
// All practice content for the game. Pure data, no side effects.
// Public site: no colleague names (use "Alex" or "a colleague"), no company names,
// no internal money figures, user counts or speed numbers. Placeholders: [X], [N].
//
// BADGE RULE KEYS (implemented by js/engine.js):
//   'first_mic'          first completed speaking task (type 'speak') with a transcript or recording
//   'streak:N'           streak.count reaches N days in a row (used: 3, 7, 14, 30)
//   'xp:N'               total XP reaches N (used: 500, 2000, 5000)
//   'level:N'            level from levelFromXp reaches N (used: 5, 10)
//   'fillerfree:N'       N speak results with fillerTotal 0 (counted across history) (used: 1, 10)
//   'perfect:N'          N results with score 100 (counted across history) (used: 5)
//   'cat:<catId>:N'      N completed results on items of that category (used: grammar 20, pronoun 15, phrasing 20, pronunciation 20)
//   'boss:N'             N completed boss tasks (task kind 'boss') (used: 5)
//   'night_owl'          a task completed between 22:00 and 04:59 local time
//   'early_bird'         a task completed between 05:00 and 07:59 local time
//   'daily:N'            N days where all daily tasks were done (used: 1, 10)
//   'wpm_band:N'         N speak results with wpm between 110 and 150 (calm pace) (used: 5)
//   'mastered:N'         N items with reps >= 3 and interval >= 7 days (used: 25)

export const CATEGORIES = [
  { id: 'grammar', label_he: `דקדוק`, label_en: 'Grammar', icon: 'spell-check', color: '#6C3BF5', desc_he: `is/are שנשמט, התאמה, a/the וסדר מילים בשאלה.` },
  { id: 'pronoun', label_he: `it, לא he`, label_en: 'Pronouns', icon: 'user', color: '#5A2BE0', desc_he: `מודל ו-agent הם it. משתמש כללי הוא they.` },
  { id: 'phrasing', label_he: `ניסוח טבעי`, label_en: 'Natural phrasing', icon: 'swap', color: '#FF7A1A', desc_he: `תרגום ישיר מעברית. בחר את מה שדובר אנגלית היה אומר.` },
  { id: 'fillers', label_he: `בלי מילות מילוי`, label_en: 'No fillers', icon: 'mute', color: '#F04438', desc_he: `שתיקה במקום so, basically ו-whatever.` },
  { id: 'speaking', label_he: `דיבור חופשי`, label_en: 'Speaking', icon: 'mic', color: '#22C55E', desc_he: `מסבירים נושא בקול, עם מילות חובה ובזמן.` },
  { id: 'scripts', label_he: `טקסטים בעל פה`, label_en: 'Scripts', icon: 'scroll', color: '#F5A524', desc_he: `פתיחה, סיום, הדגמה ומעברים. מילה במילה.` },
  { id: 'qa', label_he: `שאלות קשות`, label_en: 'Tough Q&A', icon: 'help', color: '#1B1530', desc_he: `תשובה קודם, הסבר אחר כך.` },
  { id: 'pronunciation', label_he: `הגייה`, label_en: 'Pronunciation', icon: 'volume', color: '#FFB020', desc_he: `מילים שדוברי עברית נוטים להגות לא נכון. חזור אחרי.` },
  { id: 'presenting', label_he: `איך להציג`, label_en: 'Presenting', icon: 'presentation', color: '#8A84A3', desc_he: `טכניקה: פתיחה, סיום, שאלות, קהל והדגמות.` },
  // Phase 3: professional English
  { id: 'status', label_he: `עדכוני סטטוס`, label_en: 'Status updates', icon: 'clock', color: '#6C3BF5', desc_he: `סטנדאפ, עדכון שבועי וסטטוס להנהלה.` },
  { id: 'incident', label_he: `תקלות ופוסטמורטם`, label_en: 'Incidents', icon: 'bolt', color: '#F04438', desc_he: `גשר תקלה, הודעות ללקוחות, פוסטמורטם בלי אשמה.` },
  { id: 'systems', label_he: `להציג מערכת`, label_en: 'Presenting systems', icon: 'wrench', color: '#0EA5E9', desc_he: `ארכיטקטורה, מסלול של בקשה, פשרות וכשלים.` },
  { id: 'meetings', label_he: `פגישות`, label_en: 'Meetings', icon: 'users', color: '#22C55E', desc_he: `להסכים, לא להסכים, להתפרץ ולבקש החלטה.` },
  { id: 'numbers', label_he: `מספרים ונתונים`, label_en: 'Numbers', icon: 'chart', color: '#FFB020', desc_he: `אחוזים, תאריכים, מגמות ו-p95 בקול.` },
  { id: 'vocab', label_he: `אוצר מילים טכני`, label_en: 'Tech vocabulary', icon: 'book', color: '#5A2BE0', desc_he: `roll out, spin up, phase out ועוד.` },
  { id: 'stress', label_he: `דגש ואינטונציה`, label_en: 'Stress and intonation', icon: 'wave', color: '#FF7A1A', desc_he: `RE-cord מול re-CORD. שאלה עולה, תשובה יורדת.` },
  { id: 'interview', label_he: `ראיון והשפעה`, label_en: 'Interview', icon: 'star', color: '#1B1530', desc_he: `התפקיד שלך, השפעה במספרים, סיפורי STAR.` },
  { id: 'smalltalk', label_he: `שיחת חולין`, label_en: 'Small talk', icon: 'smile', color: '#F5A524', desc_he: `פתיחה לפני פגישה, סוף שבוע וסיום נעים.` }
];

export const FILLERS = ['so', 'basically', 'whatever', 'like', 'um', 'uh', 'let\'s say', 'again', 'actually', 'you know'];

// ---------- item builders (keep shapes exactly as in CONTRACT.md) ----------
const fix = (cat) => (id, level, src, wrong, right, note_he, why_he) =>
  ({ id, cat, type: 'fix', level, why_he, src, wrong, right, note_he });
const G = fix('grammar');
const P = fix('pronoun');
const C = (id, level, src, wrong, options, correct, note_he, why_he) =>
  ({ id, cat: 'phrasing', type: 'choice', level, why_he, src, wrong, options, correct, note_he });
const speak = (cat) => (id, level, src, o) =>
  ({ id, cat, type: 'speak', level, why_he: o.why_he, src, title_he: o.title_he, prompt_en: o.prompt_en, seconds: o.seconds, must: o.must, banned: o.banned, model_en: o.model_en, bad: o.bad || '' });
const F = speak('fillers');
const S = speak('speaking');
const R = (id, level, src, title_he, text_en, why_he) =>
  ({ id, cat: 'scripts', type: 'recall', level, why_he, src, title_he, text_en });
const Q = (id, level, src, question_en, model_en, note_he, why_he) =>
  ({ id, cat: 'qa', type: 'qa', level, why_he, src, question_en, model_en, note_he });
const H = (id, level, src, word, hint_he, sentence_en, why_he) =>
  ({ id, cat: 'pronunciation', type: 'shadow', level, why_he, src, word, hint_he, sentence_en });

const BE = `טעות נפוצה אצל דוברי עברית: משמיטים is/are. בעברית אין "להיות" בהווה.`;
const AGR = `טעות נפוצה: אין התאמה בין הנושא לפועל, ביחיד או ברבים.`;
const ART = `טעות נפוצה ב-a/the: ה' הידיעה בעברית לא עובדת כמו the.`;
const QWO = `טעות נפוצה בשאלה: הפועל בא לפני הנושא.`;
const ONE = `משפט מבולבל שנשמע לא מקצועי. משפט קצר עדיף.`;
const PRO = `טעות נפוצה אצל דוברי עברית: he על מודל, מערכת או משתמש. בעברית לכל דבר יש מין.`;
const CAL = `טעות נפוצה: תרגום ישיר מעברית שנשמע זר.`;
const WEAK = `ניסוח נפוץ שמחליש אותך ואת העבודה שלך.`;
const ALL = FILLERS;

// =====================================================================
// PHASE 3 - professional English (status, incident, systems, meetings,
// numbers, vocab, stress, interview, smalltalk). Same 6 item types.
// src is always null.
// =====================================================================
const mkFix = (cat) => (id, level, wrong, right, note_he, why_he) =>
  ({ id, cat, type: 'fix', level, why_he, src: null, wrong, right, note_he });
const mkChoice = (cat) => (id, level, wrong, options, correct, note_he, why_he) =>
  ({ id, cat, type: 'choice', level, why_he, src: null, wrong, options, correct, note_he });
const mkRecall = (cat) => (id, level, title_he, text_en, why_he) =>
  ({ id, cat, type: 'recall', level, why_he, src: null, title_he, text_en });
const mkQa = (cat) => (id, level, question_en, model_en, note_he, why_he) =>
  ({ id, cat, type: 'qa', level, why_he, src: null, question_en, model_en, note_he });
const mkShadow = (cat) => (id, level, word, hint_he, sentence_en, why_he) =>
  ({ id, cat, type: 'shadow', level, why_he, src: null, word, hint_he, sentence_en });
const kit = (cat) => ({ fix: mkFix(cat), choice: mkChoice(cat), speak: (id, level, o) => speak(cat)(id, level, null, o), recall: mkRecall(cat), qa: mkQa(cat), shadow: mkShadow(cat) });

const ST = kit('status');
const IN = kit('incident');
const SY = kit('systems');
const MT = kit('meetings');
const NU = kit('numbers');
const VO = kit('vocab');
const WS = kit('stress');
const IV = kit('interview');
const SM = kit('smalltalk');

const NOFILL = ['so', 'basically', 'um', 'uh'];

const PRO_ITEMS = [
  // =====================================================================
  // STATUS - status updates, standups, exec status
  // =====================================================================
  ST.fix('st-001', 1, `I am blocking from the security team.`, `I'm blocked by the security team.`, `blocked by = מישהו חוסם אותך. blocking = אתה חוסם.`, `מילת סטטוס בסיסית.`),
  ST.fix('st-002', 1, `The task is in the middle.`, `The task is in progress.`, `in progress = בעבודה.`, `מילת סטטוס בסיסית.`),
  ST.fix('st-003', 2, `We are in late with the migration.`, `We're behind schedule on the migration.`, `behind schedule = מאחרים בלוח הזמנים.`, `לדווח על איחור בלי תרגום מעברית.`),
  ST.fix('st-004', 1, `I will finish it until Thursday.`, `I'll finish it by Thursday.`, `by = לא יאוחר מ. until = כל הזמן עד.`, `תאריך יעד נשמע ברור.`),
  ST.fix('st-005', 1, `I didn't succeed to finish the upgrade.`, `I didn't manage to finish the upgrade.`, `manage to = להצליח לעשות משהו.`, `תרגום ישיר של "הצלחתי ל".`),
  ST.fix('st-006', 1, `There is no news about the ticket.`, `There's no update on the ticket yet.`, `update on = עדכון לגבי.`, `סטטוס של משימה פתוחה.`),
  ST.fix('st-007', 1, `We are on the track.`, `We're on track.`, `on track בלי the.`, `ביטוי קבוע בעדכונים.`),
  ST.fix('st-008', 1, `The ETA is in Thursday.`, `The ETA is Thursday.`, `ETA + יום, בלי in.`, `שפה של זמן הגעה.`),
  ST.fix('st-009', 2, `I need from you an approval.`, `I need your approval.`, `לא "צריך ממך". your approval.`, `בקשה ברורה מהמנהל.`),
  ST.fix('st-010', 2, `I have no idea.`, `I don't know yet. I'll find out and get back to you by 3 PM.`, `"yet" ועוד צעד הבא עם שעה.`, `"לא יודע" בלי לאבד אמון.`),
  ST.fix('st-011', 2, `The release is postponed in one week.`, `The release is pushed back by one week.`, `pushed back by = נדחה ב.`, `לדווח על דחייה.`),
  ST.fix('st-012', 1, `Me and Alex finished the review.`, `Alex and I finished the review.`, `בתור נושא: Alex and I.`, `נשמע מקצועי בסטנדאפ.`),
  ST.choice('st-013', 1, `We are stuck because of them.`, [`We're blocked on their API change.`, `We are standing because of them.`, `We are stucked by them.`], 0, `blocked on + מה בדיוק חוסם.`, `חסימה עם סיבה ברורה.`),
  ST.choice('st-014', 2, `The project is on red color.`, [`The project is on red color today.`, `The project is red: we'll miss the date without help.`, `The project makes red.`], 1, `red + מה זה אומר + מה צריך.`, `סטטוס ירוק, צהוב, אדום.`),
  ST.choice('st-015', 2, `It will take more or less a week, I hope.`, [`It is taking around a week I am hoping.`, `It will take a week more or less maybe.`, `It should take about a week.`], 2, `should = הערכה בביטחון סביר.`, `הערכת זמן בלי לגמגם.`),
  ST.choice('st-016', 1, `I'll update you when I'll know.`, [`I'll update you when I know.`, `I'll update you when I will know.`, `I update you when I'll know.`], 0, `אחרי when באים בהווה, גם על העתיד.`, `טעות נפוצה אצל דוברי עברית.`),
  ST.choice('st-017', 1, `The deploy is finished it?`, [`The deploy is done it?`, `Is the deploy done?`, `Done is the deploy?`], 1, `שאלה: is לפני הנושא.`, `לשאול על סטטוס.`),
  ST.choice('st-018', 2, `There is a danger the vendor is late.`, [`The vendor has a danger of late.`, `There is dangerous the vendor late.`, `There's a risk the vendor will be late.`], 2, `risk ולא danger בעבודה.`, `לדבר על סיכונים.`),
  ST.choice('st-019', 1, `Small update: is all fine, nothing, okay.`, [`Quick update: we're on track, no blockers.`, `Small update: is all fine and good and okay.`, `Little news: no problem, nothing, fine.`], 0, `quick update + on track + no blockers.`, `עדכון קצר שאומר משהו.`),
  ST.choice('st-020', 2, `My asking is that you will approve.`, [`I am asking that you will approve it maybe.`, `My ask is simple: approve the extra node by Friday.`, `My asking is you approve.`], 1, `my ask = הבקשה שלי. עם מה ועד מתי.`, `לסיים סטטוס בבקשה.`),
  ST.choice('st-021', 2, `It's slipping a little bit, more or less, maybe a week.`, [`It slips maybe little week.`, `It's slipping a little bit more less a week.`, `It's slipping by about a week.`], 2, `slipping by + כמה.`, `לדווח על החלקה בלו"ז.`),
  ST.speak('st-022', 1, { title_he: `סטנדאפ ב-30 שניות`, prompt_en: `Give your standup in 30 seconds: yesterday, today, blockers.`, seconds: 30, must: ['yesterday', 'today', 'blockers'], banned: NOFILL, model_en: `Yesterday I finished the alert rules for the payment service. Today I'm testing them in staging. No blockers.`, bad: `so yesterday I did some stuff with the alerts and um today also continue`, why_he: `סטנדאפ קצר וממוקד.` }),
  ST.speak('st-023', 2, { title_he: `עדכון שבועי למנהל`, prompt_en: `Give your manager a weekly update in 45 seconds: overall status, done this week, next week, one risk.`, seconds: 45, must: ['on track', 'this week', 'next week'], banned: ['so', 'basically', 'whatever', 'um'], model_en: `Here's my weekly update. The database upgrade is on track. This week we moved two of the three clusters. Next week we move the last one, and then we clean up. One risk: the old backups are slow. I'm watching it.`, bad: `so basically everything is more or less okay, we did a lot of things`, why_he: `מבנה קבוע לעדכון שבועי.` }),
  ST.speak('st-024', 3, { title_he: `סטטוס להנהלה`, prompt_en: `Give an exec status in 45 seconds: color (green, amber or red), why, the main risk, and your ask.`, seconds: 45, must: ['amber', 'risk', 'ask'], banned: ['basically', 'I think', 'um', 'so'], model_en: `The migration is amber. We're two weeks behind because of a vendor delay. The main risk is the end of the old contract on June 30th. My ask: approve 200 extra hours of contractor time, and we're back to green by the end of the month.`, bad: `um it's a bit complicated, I think we are kind of late`, why_he: `הנהלה רוצה צבע, סיכון ובקשה.` }),
  ST.speak('st-025', 2, { title_he: `"אני לא יודע עדיין"`, prompt_en: `Your manager asks: "When will it be fixed?" You don't know yet. Say it honestly, with a next step and a time.`, seconds: 20, must: ["don't know yet", 'by'], banned: ['maybe', 'probably', 'um', 'so'], model_en: `I don't know yet. We found the cause, but not the fix. I'll have an estimate by 3 PM, and I'll send it to you directly.`, bad: `um maybe tomorrow, probably, I'm not sure`, why_he: `כנות עם צעד הבא.` }),
  ST.speak('st-026', 2, { title_he: `אני חסום`, prompt_en: `Tell the team you're blocked. Say what blocks you, who can unblock you, and what you'll do meanwhile.`, seconds: 30, must: ['blocked on', 'meanwhile'], banned: NOFILL, model_en: `I'm blocked on the firewall change. The network team owns it, and Alex is following up with them today. Meanwhile, I'm writing the tests. We can ship as soon as it's open.`, bad: `so I can't do nothing because of the network guys`, why_he: `חסימה בלי להאשים.` }),
  ST.speak('st-027', 3, { title_he: `הפרויקט מחליק`, prompt_en: `Tell your manager the project is slipping. Say by how much, why, and what you need.`, seconds: 30, must: ['slipping', 'because', 'need'], banned: ['sorry', 'um', 'basically', 'so'], model_en: `The project is slipping by one week, because the load tests found a memory leak. We're fixing it now. I need one more day of QA time next week to stay on the new date.`, bad: `sorry, um, we have a small problem, basically it will be late`, why_he: `חדשות רעות, ישר ועם בקשה.` }),
  ST.recall('st-028', 1, `סטנדאפ מושלם`, `Yesterday I finished the alert rules. Today I'm testing them in staging. One blocker: I need access to the staging cluster. Alex, can you help me after the standup?`, `תבנית סטנדאפ שאפשר לחזור עליה כל יום.`),
  ST.recall('st-029', 2, `עדכון שבועי`, `Quick weekly update. Overall, we're on track. Done this week: the new backup job is live. Next week: we move the last two services. One risk: the vendor might be late with the certificate. I'll know by Wednesday, and I'll tell you right away.`, `מבנה: מצב, מה נעשה, מה הלאה, סיכון.`),
  ST.recall('st-030', 3, `סטטוס להנהלה ב-3 משפטים`, `Status is amber. We're one week behind because of a vendor delay, and the date is still safe if we get help. My ask: one more engineer for two weeks.`, `שלושה משפטים: צבע, סיבה, בקשה.`),
  ST.qa('st-031', 3, `Are we going to make the deadline?`, `Not with the current scope. If we move the reporting feature to the next release, yes. I need a decision on that by Friday.`, `תשובה קודם, אחר כך תנאי ובקשה.`, `שאלה ישירה של מנהל.`),
  ST.qa('st-032', 3, `Why didn't you tell us earlier?`, `Fair point. I saw the risk last week, and I hoped we could absorb it. Next time, I'll raise it as soon as I see it, even if it's not confirmed yet.`, `מקבלים אחריות בלי להתגונן.`, `ביקורת על עדכון מאוחר.`),
  ST.qa('st-033', 2, `What's the ETA?`, `Thursday end of day, with medium confidence. The unknown is the vendor patch. I'll confirm or update the date tomorrow morning.`, `תאריך, רמת ביטחון, ומתי תעדכן.`, `הערכת זמן מקצועית.`),

  // =====================================================================
  // INCIDENT - incident comms, bridge, postmortems
  // =====================================================================
  IN.fix('in-001', 1, `The site is falling.`, `The site is down.`, `down = לא עובד. falling זה ליפול פיזית.`, `המילה הראשונה בכל תקלה.`),
  IN.fix('in-002', 1, `We have a downtime of the login.`, `Login is down.`, `קצר: login is down.`, `הודעה קצרה בזמן לחץ.`),
  IN.fix('in-003', 1, `The problem started in 10:15.`, `The problem started at 10:15.`, `at לשעה.`, `ציר זמן מדויק.`),
  IN.fix('in-004', 1, `Some users can't to log in.`, `Some users can't log in.`, `אחרי can't בלי to.`, `תיאור השפעה.`),
  IN.fix('in-005', 2, `We did a rollback to the version from yesterday.`, `We rolled back to yesterday's version.`, `roll back כפועל. rollback כשם עצם.`, `לתאר פעולה בתקלה.`),
  IN.fix('in-006', 2, `Who did the mistake?`, `What failed, and why?`, `blameless: שואלים על התהליך, לא על אדם.`, `תרבות פוסטמורטם בלי אשמה.`),
  IN.fix('in-007', 3, `The root cause was Alex.`, `The root cause was a config change without a review step.`, `root cause הוא תהליך או מערכת, לא בן אדם.`, `ניסוח בלי אשמה.`),
  IN.fix('in-008', 1, `We will give update every half hour.`, `We'll post an update every 30 minutes.`, `post an update = לפרסם עדכון.`, `קצב עדכונים בגשר.`),
  IN.fix('in-009', 1, `The impact is on all the customers of Europe.`, `The impact is on all customers in Europe.`, `customers in Europe. בלי the.`, `תיאור היקף.`),
  IN.fix('in-010', 1, `We are investigating about it.`, `We're investigating it.`, `investigate בלי about.`, `משפט שחוזר בכל תקלה.`),
  IN.fix('in-011', 2, `The fix is deployed and now it's stable, I think.`, `The fix is deployed. Error rates are back to normal. We're monitoring.`, `עובדות במקום "I think".`, `סגירה בטוחה של תקלה.`),
  IN.fix('in-012', 1, `We apologize on the inconvenience.`, `We apologize for the inconvenience.`, `apologize for.`, `הודעה ללקוחות.`),
  IN.choice('in-013', 3, `The reason was the deploy.`, [`The trigger was the deploy. The root cause was a missing health check.`, `The reason of the trigger was the deploy root.`, `The deploy did the cause.`], 0, `trigger = מה שהפעיל. root cause = למה זה בכלל יכול היה לקרות.`, `להפריד בין טריגר לסיבת שורש.`),
  IN.choice('in-014', 2, `We are mitigating the fire.`, [`We are extinguishing the problem now fully.`, `We've mitigated the impact. The fix is next.`, `We mitigated on the fire.`], 1, `mitigate = להקטין נזק. fix = לתקן לגמרי.`, `שלבים בתקלה.`),
  IN.choice('in-015', 2, `Our DB exploded because someone pushed bad config.`, [`We have a big crash because of a guy.`, `The database exploded, sorry, someone did bad push.`, `Some customers are seeing errors. We've identified the cause and are working on a fix.`], 2, `ללקוחות: השפעה, מה עושים, בלי פרטים פנימיים.`, `שפה מול לקוחות.`),
  IN.choice('in-016', 2, `Action item: to be more careful.`, [`Action item: add a review step to config changes. Owner: platform team. Due: [date].`, `Action item: everybody be careful more.`, `Action item: not doing mistakes again.`], 0, `action item = משימה ברורה, בעלים ותאריך.`, `משימות אחרי תקלה.`),
  IN.choice('in-017', 1, `How much it's bad?`, [`How much bad is it?`, `How bad is the impact?`, `How it is bad?`], 1, `how bad is.`, `שאלה ראשונה בגשר.`),
  IN.choice('in-018', 1, `Everything is back to work.`, [`All is back to the work.`, `Everything is returning to working.`, `Everything is back to normal.`], 2, `back to normal.`, `סגירת תקלה.`),
  IN.choice('in-019', 1, `We don't know nothing yet.`, [`We don't know the cause yet.`, `We not know nothing yet.`, `We are not knowing anything still.`], 0, `שלילה אחת בלבד.`, `כנות בזמן תקלה.`),
  IN.choice('in-020', 2, `Let's do a postmortem on Alex.`, [`Let's make a post-mortal on the incident.`, `Let's run a blameless postmortem.`, `Let's do an after-death on it.`], 1, `run a postmortem. blameless = בלי אשמה.`, `קולוקציה של פוסטמורטם.`),
  IN.speak('in-021', 2, { title_he: `עדכון בגשר`, prompt_en: `Give an incident bridge update in 30 seconds: time, impact, mitigation, next update.`, seconds: 30, must: ['impact', 'mitigation', 'next update'], banned: ['so', 'um', 'basically', 'I think'], model_en: `Update at 10:40. Impact: about 5 percent of checkout requests are failing in Europe. Mitigation: we rolled back the last deploy, and errors are dropping. Next update at 11:00.`, bad: `so um we think it's maybe the deploy, we are checking stuff`, why_he: `מבנה קבוע לעדכון תקלה.` }),
  IN.speak('in-022', 2, { title_he: `פותחים גשר תקלה`, prompt_en: `You're the incident commander. Open the bridge: what we know, roles, and the next update time.`, seconds: 30, must: ['incident commander', 'scribe', 'next update'], banned: NOFILL, model_en: `Hi everyone, I'm the incident commander. Here's what we know: login errors started at 9:12, and they affect all regions. Alex is the scribe. Database team, please check the primary. Next update in 15 minutes.`, bad: `okay so guys, um, something is broken, let's all look`, why_he: `לנהל את הגשר מהדקה הראשונה.` }),
  IN.speak('in-023', 2, { title_he: `הודעה ללקוחות`, prompt_en: `Write out loud a short customer-facing message. No internal details.`, seconds: 30, must: ['some customers', 'working on', 'update'], banned: ['root cause', 'database', 'um', 'so'], model_en: `Some customers can't load their dashboards right now. We know about the issue, and our team is working on a fix. We'll share an update within 30 minutes. Thank you for your patience.`, bad: `our database crashed because of a bad config`, why_he: `טון רגוע מול לקוחות.` }),
  IN.speak('in-024', 3, { title_he: `טריגר מול סיבת שורש`, prompt_en: `Explain the trigger, the root cause and the main action item of an incident. 45 seconds.`, seconds: 45, must: ['trigger', 'root cause', 'action item'], banned: NOFILL, model_en: `The trigger was a config change that set the connection limit too low. The root cause was deeper: we had no validation on that config, and no alert on connection errors. The main action item is a validation step in the pipeline, with an owner and a date.`, bad: `the problem was the config, someone changed it`, why_he: `ניתוח מקצועי בלי אשמה.` }),
  IN.speak('in-025', 3, { title_he: `סיכום פוסטמורטם`, prompt_en: `Present a postmortem summary in 45 seconds. No names, no blame.`, seconds: 45, must: ['what happened', 'what we learned', 'action items'], banned: ['fault', 'um', 'so', 'basically'], model_en: `Here's what happened. On Tuesday, a certificate expired, and the API was down for 40 minutes. Here's what we learned: our expiry alert went to an old channel. We have three action items: move the alert, add a weekly check, and document the renewal. Each one has an owner and a date.`, bad: `basically it was the fault of the team that forgot the certificate`, why_he: `מבנה פוסטמורטם ברור.` }),
  IN.speak('in-026', 1, { title_he: `התקלה נפתרה`, prompt_en: `Close the incident in 20 seconds.`, seconds: 20, must: ['resolved', 'monitoring'], banned: NOFILL, model_en: `The incident is resolved. Error rates have been normal for 30 minutes. We'll keep monitoring for the next hour, and the postmortem is on Thursday.`, bad: `so it's working now I think, bye`, why_he: `סגירה עם עובדות וצעד הבא.` }),
  IN.recall('in-027', 1, `עדכון בגשר תקלה`, `Here's the current status. Impact: users in Europe can't log in. Scope: about 20 percent of logins. Mitigation: we're failing over to the second region. Next update in 20 minutes, or sooner if anything changes.`, `השפעה, היקף, פעולה, עדכון הבא.`),
  IN.recall('in-028', 2, `הודעה ללקוחות`, `We're aware that some customers are seeing slow responses. Our team is investigating, and we'll share an update within 30 minutes. We're sorry for the trouble.`, `תבנית קבועה מול לקוחות.`),
  IN.recall('in-029', 2, `פתיחת פוסטמורטם`, `Thanks for joining. This is a blameless postmortem. We're here to understand the system, not to find someone to blame. First, the timeline. Then, the root cause. Last, the action items.`, `לקבוע טון בטוח בתחילת הפגישה.`),
  IN.qa('in-030', 3, `Whose fault was it?`, `It wasn't one person's fault. A change went out without a review step, and our alerts didn't catch it. We're fixing the process, and that's what the action items cover.`, `מסיטים מאדם לתהליך.`, `שאלה שמחפשת אשם.`),
  IN.qa('in-031', 3, `Can you guarantee this won't happen again?`, `No one can guarantee that. What I can say is that this exact failure is now blocked by a test, and we'll catch similar ones faster with the new alert.`, `לא מבטיחים מה שאי אפשר. נותנים עובדות.`, `שאלה של הנהלה אחרי תקלה.`),
  IN.qa('in-032', 2, `Why did it take an hour to detect?`, `Because the alert was on errors, not on traffic. The traffic dropped, but nothing errored. We've added a traffic alert, and we'd now detect it in about 5 minutes.`, `סיבה, תיקון, ומספר.`, `שאלה על זמן גילוי.`),

  // =====================================================================
  // SYSTEMS - presenting a system or architecture
  // =====================================================================
  SY.fix('sy-001', 1, `The request is going to the gateway and after it going to the service.`, `The request goes to the gateway, and then to the service.`, `הווה פשוט לתיאור תהליך. and then.`, `לתאר זרימה של בקשה.`),
  SY.fix('sy-002', 2, `We chose in Postgres because it's more good.`, `We chose Postgres because it's a better fit.`, `chose בלי in. better, לא more good.`, `להסביר בחירה טכנית.`),
  SY.fix('sy-003', 1, `In this slide you can see the cache is sitting before the database.`, `On this slide, the cache sits in front of the database.`, `on a slide. in front of.`, `לדבר על שקף.`),
  SY.fix('sy-004', 1, `It's scaling horizontal.`, `It scales horizontally.`, `scale + horizontally (תואר פועל).`, `מילת סקייל בסיסית.`),
  SY.fix('sy-005', 2, `If the node is falling, the other takes.`, `If a node fails, another one takes over.`, `fails. takes over = לוקח פיקוד.`, `לתאר כשל.`),
  SY.fix('sy-006', 2, `The disadvantage from this is cost.`, `The downside of this is cost.`, `downside of.`, `לדבר על פשרות.`),
  SY.fix('sy-007', 1, `This component responsible on the auth.`, `This component is responsible for auth.`, `is responsible for.`, `תפקיד של רכיב.`),
  SY.fix('sy-008', 1, `The queue is in the middle between them.`, `The queue sits between them.`, `sits between = נמצא בין.`, `מיקום בדיאגרמה.`),
  SY.fix('sy-009', 2, `We did it like this because the latency.`, `We built it this way because of latency.`, `because of + שם עצם. this way.`, `להצדיק החלטה.`),
  SY.fix('sy-010', 1, `The data is saving in object storage.`, `The data is stored in object storage.`, `סביל: is stored.`, `לתאר איפה הנתונים.`),
  SY.fix('sy-011', 1, `It can to handle 500 requests per second.`, `It can handle 500 requests per second.`, `אחרי can בלי to.`, `קיבולת של מערכת.`),
  SY.choice('sy-012', 1, `Let's go to the next box.`, [`Let's move to the next box thing.`, `Let's go jump to the next square.`, `Let's follow the request to the next step.`], 2, `follow the request = מסלול שהקהל מבין.`, `מעבר בין חלקים בדיאגרמה.`),
  SY.choice('sy-013', 2, `The reason we chose Kafka on RabbitMQ...`, [`The reason we chose Kafka over RabbitMQ is replay.`, `The reason we chose Kafka on RabbitMQ is replay.`, `The reason we choose Kafka than RabbitMQ is replay.`], 0, `chose X over Y.`, `השוואה בין אפשרויות.`),
  SY.choice('sy-014', 1, `What is the single point of falling?`, [`What's the one point of falling?`, `What's the single point of failure?`, `Where is the only falling place?`], 1, `single point of failure.`, `מונח קבוע בארכיטקטורה.`),
  SY.choice('sy-015', 1, `It's a bottle neck in the database.`, [`There is a bottle in the database neck.`, `The database makes a bottle neck.`, `The database is the bottleneck.`], 2, `X is the bottleneck.`, `לזהות צוואר בקבוק.`),
  SY.choice('sy-016', 2, `In the left we have the users, okay?`, [`Let's start on the left, with the users.`, `Let's begin at the left, there is the users.`, `In the left we have users, okay so.`], 0, `on the left. מתחילים עם מפה.`, `הכוונה בזמן דיאגרמה.`),
  SY.choice('sy-017', 2, `This design is good for scale but not good for cost.`, [`This design is good scale but bad costing.`, `This design scales well, but it costs more.`, `This design scaling good, costing not.`], 1, `פועל במקום "good for".`, `לנסח פשרה בקצרה.`),
  SY.choice('sy-018', 2, `When the cache is missing, we go to the DB.`, [`If the cache miss, we going to the DB.`, `When the cache is missing itself, we go DB.`, `On a cache miss, we read from the database.`], 2, `cache miss / cache hit.`, `מונח של קאש.`),
  SY.choice('sy-019', 1, `Let me zoom this part.`, [`Let me zoom in on this part.`, `Let me zoom this part inside.`, `Let me do zoom to this part.`], 0, `zoom in on.`, `לכוון את הקהל.`),
  SY.speak('sy-020', 2, { title_he: `מסלול של בקשה`, prompt_en: `Follow one request through a system you know, from the user to the database. 45 seconds.`, seconds: 45, must: ['first', 'then', 'finally'], banned: ['so', 'basically', 'um', 'like'], model_en: `Let's follow one request. First, it hits the load balancer. Then the API gateway checks the token and sends it to the order service. The service writes to the database and puts an event on the queue. Finally, a worker picks up the event and sends the email.`, bad: `so here is the gateway and here basically the service and the DB`, why_he: `סדר ברור: first, then, finally.` }),
  SY.speak('sy-021', 3, { title_he: `למה X ולא Y`, prompt_en: `Explain one technical choice: what you chose, over what, and the trade-off. 30 seconds.`, seconds: 30, must: ['over', 'trade-off'], banned: NOFILL, model_en: `The reason we chose a managed database over our own cluster is time. The trade-off is cost: it's about 20 percent more expensive. For a team of our size, that's worth it.`, bad: `we took the managed one because it's better`, why_he: `להצדיק החלטה עם פשרה.` }),
  SY.speak('sy-022', 3, { title_he: `מצבי כשל`, prompt_en: `Explain what happens when parts of your system fail. 45 seconds.`, seconds: 45, must: ['fails', 'fail over'], banned: NOFILL, model_en: `Let's talk about failure. If one node fails, the load balancer stops sending traffic to it, and the others take over. If the whole zone fails, we fail over to the second region. That takes about 10 minutes, and we test it every quarter.`, bad: `um if something falls, the other one takes it`, why_he: `לדבר על כשלים בביטחון.` }),
  SY.speak('sy-023', 2, { title_he: `סקייל`, prompt_en: `Explain how your system scales and where the bottleneck is. 30 seconds.`, seconds: 30, must: ['horizontally', 'bottleneck'], banned: NOFILL, model_en: `The API scales horizontally. We add pods when CPU goes above 70 percent. The bottleneck today is the database, not the API. That's the next thing we'll fix.`, bad: `it's scaling horizontal and the DB is a bottle neck`, why_he: `סקייל וצוואר בקבוק במשפטים קצרים.` }),
  SY.speak('sy-024', 2, { title_he: `שקף עם דיאגרמה`, prompt_en: `You're showing an architecture diagram. Guide the audience: left, middle, right. 45 seconds.`, seconds: 45, must: ['on the left', 'in the middle', 'on the right'], banned: NOFILL, model_en: `Let me walk you through this diagram. On the left, you see the users and the CDN. In the middle is our API layer, which runs on Kubernetes. On the right are the data stores: a database and a cache. Let's start with the users.`, bad: `so here, and here, and this box is, um, this one`, why_he: `signposting: הקהל יודע לאן להסתכל.` }),
  SY.speak('sy-025', 3, { title_he: `מערכת בדקה`, prompt_en: `Present a whole system in 60 seconds: its parts, why it's split this way, and the trade-off.`, seconds: 60, must: ['three parts', 'the reason', 'trade-off'], banned: ['so', 'basically', 'um', 'uh', 'whatever'], model_en: `The system has three parts: an ingestion service, a processing pipeline, and a reporting API. The reason we split them is scale: ingestion has spikes, and reporting doesn't. The trade-off is more moving parts, and we handle that with good monitoring and one dashboard per part.`, bad: `basically we have a lot of services and they talk to each other`, why_he: `תמונה גדולה לפני פרטים.` }),
  SY.recall('sy-026', 1, `פתיחה להצגת ארכיטקטורה`, `Let me give you the big picture first, then we'll zoom in. The system has three layers: the edge, the services, and the data. I'll follow one request from left to right. Stop me any time if something isn't clear.`, `תמונה גדולה, מפה, והזמנה לשאלות.`),
  SY.recall('sy-027', 2, `הסבר של בחירה טכנית`, `We looked at two options. We chose a message queue over direct calls for one reason: if a service is down, no data is lost. The cost is a bit more latency, about 50 milliseconds. For this use case, that's fine.`, `אפשרויות, בחירה, סיבה, מחיר.`),
  SY.recall('sy-028', 2, `סיום הצגת מערכת`, `To sum up: three layers, one request path, and two known risks. The database is our bottleneck, and the plan to fix it is on the next slide. Any questions so far?`, `סיכום קצר לפני שאלות.`),
  SY.qa('sy-029', 2, `Why didn't you use microservices?`, `We didn't need them yet. One team owns this, and a single service is simpler to run. If the team grows or one part needs to scale on its own, we'll split it.`, `תשובה קודם, ואז מתי זה ישתנה.`, `שאלה על החלטה ארכיטקטונית.`),
  SY.qa('sy-030', 3, `What happens if the queue goes down?`, `Producers retry with backoff for up to 15 minutes. If it's longer, events go to a local buffer, and nothing is lost. We tested this last quarter.`, `התאם למערכת שלך. אמור רק מה שנבדק.`, `שאלה על כשל.`),
  SY.qa('sy-031', 3, `How does this scale to ten times the traffic?`, `The API scales out, no problem. The database is the limit. At ten times, we'd need read replicas, and we've already planned that.`, `מודים בגבול ומראים תוכנית.`, `שאלת סקייל.`),
  SY.qa('sy-032', 3, `Isn't this over-engineered?`, `It's a fair question. Each part solves a problem we had in production. If one stops earning its place, we'll remove it.`, `מסכימים שזו שאלה טובה, ונותנים סיבה.`, `שאלה ספקנית.`),

  // =====================================================================
  // MEETINGS - agree, disagree, interrupt, clarify, push back
  // =====================================================================
  MT.fix('mt-001', 1, `I'm agree with you.`, `I agree with you.`, `agree הוא פועל. בלי am.`, `הטעות הכי נפוצה בפגישות.`),
  MT.fix('mt-002', 1, `Sorry that I interrupt.`, `Sorry to interrupt.`, `sorry to + פועל.`, `להתפרץ בנימוס.`),
  MT.fix('mt-003', 1, `Can you repeat? I didn't understood.`, `Sorry, could you say that again? I didn't catch it.`, `didn't + צורת בסיס. didn't catch it נשמע רך.`, `לבקש חזרה בנימוס.`),
  MT.fix('mt-004', 1, `Let's make a meeting tomorrow.`, `Let's set up a meeting tomorrow.`, `set up / schedule a meeting. לא make.`, `תרגום ישיר מעברית.`),
  MT.fix('mt-005', 2, `You are wrong.`, `I see it a bit differently.`, `אי הסכמה רכה שומרת על השיחה.`, `לא להסכים בלי לפגוע.`),
  MT.fix('mt-006', 1, `I want to say something about it.`, `Can I add something here?`, `שאלה קצרה במקום הודעה.`, `להיכנס לשיחה.`),
  MT.fix('mt-007', 1, `What you think about it?`, `What do you think about it?`, `שאלה: do לפני הנושא.`, `לשאול דעה.`),
  MT.fix('mt-008', 1, `Let's summary.`, `Let's sum up.`, `summary שם עצם. sum up פועל.`, `סיכום פגישה.`),
  MT.fix('mt-009', 2, `We are out of time, so finish.`, `We're almost out of time, so let's wrap up.`, `wrap up = לסגור בנימוס.`, `לסיים פגישה בזמן.`),
  MT.fix('mt-010', 1, `I'm not agree with this decision.`, `I don't agree with this decision.`, `don't agree.`, `שלילה של agree.`),
  MT.fix('mt-011', 2, `Who will own on this?`, `Who will own this?`, `own בלי on.`, `לקבוע בעלים.`),
  MT.fix('mt-012', 2, `Let's speak about it after.`, `Let's take it offline.`, `take it offline = נמשיך מחוץ לפגישה.`, `לשמור על הפגישה ממוקדת.`),
  MT.choice('mt-013', 1, `Wait wait wait, no.`, [`Stop, stop, I talk now.`, `Sorry, can I jump in for a second?`, `Wait you, listen me.`], 1, `jump in = להיכנס לשיחה.`, `להתפרץ בנימוס.`),
  MT.choice('mt-014', 1, `So what we decide?`, [`So decision what is?`, `So what we are deciding it?`, `So, what's the decision?`], 2, `what's the decision.`, `לבקש החלטה.`),
  MT.choice('mt-015', 2, `I didn't understand nothing.`, [`Could you clarify what you mean by "done"?`, `I not understood anything of it.`, `What you meant nothing?`], 0, `clarify + מה בדיוק לא ברור.`, `שאלת הבהרה ממוקדת.`),
  MT.choice('mt-016', 1, `Okay, you speak now Alex.`, [`Alex, now is your turn to speak you.`, `Alex, over to you.`, `Okay Alex, you go talk.`], 1, `over to you = העברת רשות הדיבור.`, `להעביר את הדיבור.`),
  MT.choice('mt-017', 2, `That's a stupid idea.`, [`This idea is not smart at all, no.`, `That's an idea very stupid.`, `I see the point, but I'm worried about the cost.`], 2, `מכירים בנקודה, ואז מעלים דאגה.`, `ביקורת מקצועית.`),
  MT.choice('mt-018', 1, `We are going out from the topic.`, [`Let's get back on track.`, `We are going out from the topic now.`, `Come back to topic, please, all.`], 0, `get back on track.`, `להחזיר את הפגישה למסלול.`),
  MT.choice('mt-019', 2, `I have a small push back.`, [`I'm giving a small push to back the timeline.`, `I'd like to push back a little on the timeline.`, `I push back you on the timeline.`], 1, `push back on + נושא.`, `להתנגד בנימוס.`),
  MT.choice('mt-020', 2, `If I understand right, you say me to delay?`, [`I understand you to delay it, yes?`, `If I understand you right, you say me to delay?`, `Just to make sure I understand: you want to delay it by a week?`], 2, `just to make sure I understand.`, `לוודא הבנה.`),
  MT.speak('mt-021', 2, { title_he: `לא להסכים בנימוס`, prompt_en: `A colleague wants to release on Friday. Disagree politely and suggest something else. 30 seconds.`, seconds: 30, must: ['I see your point', 'but', 'what if'], banned: ['you are wrong', 'um', 'so', 'stupid'], model_en: `I see your point about speed. But I'm worried about the risk of a Friday release. What if we release on Monday morning, when the whole team is online?`, bad: `no no, you are wrong, Friday is bad`, why_he: `הכרה, דאגה, והצעה.` }),
  MT.speak('mt-022', 3, { title_he: `דחיפה חזרה על היקף`, prompt_en: `Your manager adds a feature to the sprint. Push back and offer an option. 30 seconds.`, seconds: 30, must: ['push back', 'if we', 'instead'], banned: NOFILL, model_en: `I'd like to push back on the scope. If we add the reporting feature now, we miss the date. Instead, let's ship the core part first and add reporting in the next sprint.`, bad: `um it's impossible, we can't do it`, why_he: `לא בלי חלופה.` }),
  MT.speak('mt-023', 2, { title_he: `לבקש החלטה`, prompt_en: `The meeting goes in circles. Ask for a decision between two options. 30 seconds.`, seconds: 30, must: ['decision', 'options', 'recommend'], banned: NOFILL, model_en: `We need a decision today. There are two options: delay by a week, or ship without the export feature. I recommend option two. Can we agree on that by the end of this meeting?`, bad: `so what we do? I don't know, what you think?`, why_he: `להוביל להחלטה.` }),
  MT.speak('mt-024', 2, { title_he: `סיכום פגישה`, prompt_en: `Sum up the meeting in 45 seconds: decision, action items, owners.`, seconds: 45, must: ['to sum up', 'action items', 'owner'], banned: NOFILL, model_en: `To sum up: we agreed to ship on Monday. We have two action items. Alex will update the runbook, and I'll talk to the support team. Each one has an owner and a date. I'll send notes in an hour.`, bad: `okay so we said a lot of things, let's see`, why_he: `כולם יוצאים עם אותה הבנה.` }),
  MT.speak('mt-025', 1, { title_he: `פותחים פגישה בזמן`, prompt_en: `Open a 30-minute meeting: time, goal, agenda. 30 seconds.`, seconds: 30, must: ['minutes', 'goal', 'agenda'], banned: NOFILL, model_en: `Hi everyone, let's start. We have 30 minutes. The goal is one decision: which database to use. The agenda has three parts: the two options, the costs, and the decision. Let's keep each part to ten minutes.`, bad: `um okay so let's wait a bit more, maybe someone is coming`, why_he: `פגישה עם מטרה מההתחלה.` }),
  MT.speak('mt-026', 1, { title_he: `להתפרץ ולהבהיר`, prompt_en: `Interrupt politely and ask one clarifying question. 20 seconds.`, seconds: 20, must: ['sorry to interrupt', 'clarify'], banned: NOFILL, model_en: `Sorry to interrupt. Can you clarify one thing? When you say "ready", do you mean tested in staging or live in production?`, bad: `wait, I didn't understand nothing`, why_he: `הבהרה מוקדמת חוסכת טעויות.` }),
  MT.recall('mt-027', 1, `פתיחת פגישה`, `Thanks for joining. We have 30 minutes and one goal: decide on the release date. I'll take notes and send them after. Let's start with the current status.`, `פתיחה עם זמן ומטרה.`),
  MT.recall('mt-028', 2, `סגירת פגישה`, `We're almost out of time, so let's wrap up. Decision: we release on Monday. Action items: Alex updates the runbook, and I brief support. I'll send the notes today. Thanks, everyone.`, `החלטה, משימות, תודה.`),
  MT.recall('mt-029', 2, `אי הסכמה מנומסת`, `I see it a bit differently. I agree that speed matters. My concern is the risk. Can we look at the data before we decide?`, `הסכמה חלקית, דאגה, ובקשה לנתונים.`),
  MT.qa('mt-030', 3, `Why are you blocking this?`, `I'm not trying to block it. I have one concern: we have no rollback plan. If we add one, I'm fully on board.`, `מראים מה צריך כדי להגיד כן.`, `האשמה בחסימה.`),
  MT.qa('mt-031', 2, `Can we just decide later?`, `We can, but it has a cost. Every week we wait, the team works on both options. I'd like a decision by Friday.`, `מסבירים מחיר של דחייה.`, `דחיית החלטה.`),
  MT.qa('mt-032', 2, `Do you agree or not?`, `Mostly, yes. I agree with the plan. I don't agree with the date. I'd add one more week for testing.`, `תשובה קודם, אחר כך פירוק.`, `שאלת כן או לא.`),

  // =====================================================================
  // NUMBERS - saying numbers, data, trends, percentages, dates
  // =====================================================================
  NU.fix('nu-001', 2, `The latency is 200 milliseconds in p ninety-five.`, `The p95 latency is 200 milliseconds.`, `p95 נקרא "P ninety-five" ובא לפני latency.`, `לדבר על אחוזונים.`),
  NU.fix('nu-002', 1, `Errors went up in 20 percents.`, `Errors went up by 20 percent.`, `by + אחוז. percent בלי s.`, `שינוי באחוזים.`),
  NU.fix('nu-003', 1, `It costs three thousands dollars.`, `It costs three thousand dollars.`, `thousand, million, hundred אחרי מספר: בלי s.`, `מספרים גדולים.`),
  NU.fix('nu-004', 1, `The meeting is in the 5 of March.`, `The meeting is on March 5th.`, `on + תאריך.`, `תאריכים.`),
  NU.fix('nu-005', 1, `The CPU is between 60 until 80 percent.`, `CPU is between 60 and 80 percent.`, `between X and Y.`, `טווחים.`),
  NU.fix('nu-006', 1, `Two millions requests per day.`, `Two million requests a day.`, `million בלי s. a day.`, `מספרים גדולים.`),
  NU.fix('nu-007', 2, `The traffic jumped in two times.`, `Traffic doubled.`, `doubled, tripled.`, `לתאר מגמה במילה אחת.`),
  NU.fix('nu-008', 1, `It's half second.`, `It's half a second.`, `half a second.`, `זמנים קצרים.`),
  NU.fix('nu-009', 2, `Errors are less than yesterday in 30 percent.`, `Errors are 30 percent lower than yesterday.`, `X percent lower than.`, `השוואה באחוזים.`),
  NU.fix('nu-010', 1, `The cost is about 300 dollars for month.`, `The cost is about 300 dollars a month.`, `a month = לחודש.`, `עלות חודשית.`),
  NU.fix('nu-011', 1, `In 2025 year we moved to the cloud.`, `In 2025, we moved to the cloud.`, `שנה בלי year.`, `שנים.`),
  NU.choice('nu-012', 2, `The graph went up very much and then stayed.`, [`The graph spiked, then plateaued.`, `The graph upped very much and then staying.`, `The graph jumped high and stood.`], 0, `spiked = קפץ חד. plateaued = התייצב.`, `מילים של מגמה.`),
  NU.choice('nu-013', 1, `The requests fell down strong.`, [`The requests fell strongly down.`, `Requests dropped sharply.`, `Requests went falling strong.`], 1, `dropped sharply.`, `ירידה בגרף.`),
  NU.choice('nu-014', 1, `It's more or less 1000.`, [`It's around about more or less 1000.`, `It's more less one thousand.`, `It's roughly a thousand.`], 2, `roughly / about / around.`, `הערכה מספרית.`),
  NU.choice('nu-015', 2, `p99 makes 2 seconds, it's bad?`, [`The p99 is 2 seconds, which is too slow for checkout.`, `p99 makes 2 seconds, is bad?`, `The p99 have 2 second, bad.`], 0, `מספר ואז מה זה אומר.`, `לפרש מספר.`),
  NU.choice('nu-016', 2, `Compared to last month is more 15%.`, [`It's bigger in 15 percent to last month.`, `It's up 15 percent month over month.`, `Compared last month is more 15%.`], 1, `up X percent month over month.`, `השוואה בין חודשים.`),
  NU.choice('nu-017', 2, `The range is from 100 until 200 more or less.`, [`It's ranging 100-200 more or less around.`, `The range is between from 100 until 200.`, `It ranges from about 100 to 200.`], 2, `ranges from X to Y.`, `טווחים.`),
  NU.choice('nu-018', 3, `Our availability is 99 dot 9.`, [`We have three nines of availability.`, `We are ninety nine nine percent.`, `We are available 99 dot 9.`], 0, `99.9 = three nines. 99.99 = four nines.`, `שפת SLA.`),
  NU.choice('nu-019', 2, `The bill is 1 thousand 2 hundreds dollar.`, [`The bill is one point two K of dollars.`, `The bill is about twelve hundred dollars.`, `The bill is 1 thousand and 2 hundreds dollar.`], 1, `1,200 = twelve hundred.`, `סכומים בקול.`),
  NU.shadow('nu-020', 1, '0.25 / 1.5', `נקודה = point. "zero point two five", "one point five".`, `Latency went from 0.25 seconds to 1.5 seconds.`, `שברים עשרוניים.`),
  NU.shadow('nu-021', 1, '15 / 50', `fif-TEEN: דגש בסוף. FIF-ty: דגש בהתחלה.`, `We have 15 nodes, not 50.`, `teen מול ty מתבלבלים.`),
  NU.shadow('nu-022', 2, 'p95 / p99', `"P ninety-five", "P ninety-nine".`, `The p95 is fine. The p99 is the problem.`, `אחוזונים בקול.`),
  NU.shadow('nu-023', 1, 'milliseconds', `MIL-li-sec-onds. אומרים את המילה המלאה, לא "ms".`, `It takes 300 milliseconds, not 3 seconds.`, `ms מול s.`),
  NU.shadow('nu-024', 1, '2026', `"twenty twenty-six". שנה בשני חלקים.`, `In 2026, we moved everything to the cloud.`, `שנים בקול.`),
  NU.speak('nu-025', 2, { title_he: `מגמה בגרף`, prompt_en: `Describe a graph from last week: a spike, a drop and a plateau. 30 seconds. Use example numbers.`, seconds: 30, must: ['spiked', 'dropped', 'plateaued'], banned: NOFILL, model_en: `On Monday, errors spiked to 8 percent after the deploy. They dropped quickly after the rollback. Since then, they've plateaued at about 1 percent, which is our normal level.`, bad: `the graph went up very much and then it stayed`, why_he: `לספר סיפור עם גרף.` }),
  NU.speak('nu-026', 3, { title_he: `p95 ו-p99`, prompt_en: `Explain your latency numbers: p95, p99, and what they mean. 30 seconds.`, seconds: 30, must: ['p95', 'p99', 'milliseconds'], banned: NOFILL, model_en: `Our p95 latency is 200 milliseconds, which is fine. The p99 is the problem: it's over 2 seconds. That's one request in a hundred, and most of them are on the search page.`, bad: `p ninety five is two hundred ms more or less`, why_he: `מספרים עם משמעות.` }),
  NU.speak('nu-027', 2, { title_he: `עלות עם placeholders`, prompt_en: `Present a cost: per month, per user, and compared to last year. Use example numbers. 30 seconds.`, seconds: 30, must: ['a month', 'per user', 'compared to'], banned: ["let's say", 'um', 'so', 'basically'], model_en: `The new setup costs about 4,000 dollars a month. That's 20 dollars per user. Compared to last year, it's 15 percent cheaper.`, bad: `let's say it's like [X] dollars for month`, why_he: `כסף נאמר ברור ובקצרה.` }),
  NU.speak('nu-028', 2, { title_he: `השוואה`, prompt_en: `Compare a new system to an old one. Use "twice as" and "than". 30 seconds.`, seconds: 30, must: ['twice as', 'than'], banned: NOFILL, model_en: `The new cluster is twice as fast as the old one. It's also cheaper than we expected, by about 10 percent.`, bad: `the new one is more fast two times from the old`, why_he: `מבני השוואה.` }),
  NU.speak('nu-029', 2, { title_he: `תאריכים וטווחים`, prompt_en: `Explain a migration window: dates, pace, and end date. 30 seconds.`, seconds: 30, must: ['between', 'by the end of'], banned: NOFILL, model_en: `The migration window is between March 3rd and March 7th. We'll move about 20 services a day, and we'll be done by the end of the week.`, bad: `from the 3 until the 7 of March more or less`, why_he: `תאריכים בלי בלבול.` }),
  NU.recall('nu-030', 1, `שקף של מספרים`, `Three numbers. Uptime is 99.9 percent. The p95 latency is 180 milliseconds. And cost per request dropped by 25 percent since January.`, `שלושה מספרים, כל אחד במשפט.`),
  NU.recall('nu-031', 2, `גרף בהצגה`, `Here are the last 30 days. Traffic grew steadily, then spiked on the 14th, during the sale. It dropped back the next day, and it has plateaued since.`, `לספר את הגרף מימין לשמאל, בזמן.`),
  NU.qa('nu-032', 2, `Is that number good or bad?`, `It's good for us. Our target is 300 milliseconds, and we're under it. Last quarter, we were 10 percent above it.`, `תשובה קודם, ואז היעד וההשוואה.`, `לפרש מספר לקהל.`),

  // =====================================================================
  // VOCAB - hi-tech verbs, phrasal verbs, collocations
  // =====================================================================
  VO.fix('vo-001', 1, `I'll do a deploy tonight.`, `I'll deploy tonight.`, `deploy הוא פועל. בלי do a.`, `"לעשות דיפלוי" בתרגום ישיר.`),
  VO.fix('vo-002', 1, `We need to do a rollback.`, `We need to roll back.`, `roll back = פועל. rollback = שם עצם.`, `phrasal verb במקום do.`),
  VO.fix('vo-003', 2, `I raised a ticket to the network team.`, `I raised a ticket with the network team.`, `raise a ticket with. גם open a ticket תקין.`, `קולוקציה של טיקטים.`),
  VO.fix('vo-004', 1, `We will lift up a new environment.`, `We'll spin up a new environment.`, `spin up = להרים סביבה.`, `תרגום ישיר של "להרים".`),
  VO.fix('vo-005', 1, `We need to down the old servers.`, `We need to tear down the old servers.`, `tear down = לפרק ולמחוק.`, `phrasal verb לתשתית.`),
  VO.fix('vo-006', 2, `We will finish the old API slowly.`, `We'll phase out the old API.`, `phase out = להוציא משימוש בהדרגה.`, `מילה של תוכנית מעבר.`),
  VO.fix('vo-007', 2, `The client is doing too many requests, so we limit him.`, `The client sends too many requests, so we throttle it.`, `throttle = להגביל קצב. client הוא it.`, `מגבלת קצב.`),
  VO.fix('vo-008', 2, `We will enter the new engineers to the team.`, `We'll onboard the new engineers.`, `onboard = לקלוט עובד חדש.`, `תהליכי צוות.`),
  VO.fix('vo-009', 1, `This feature is deprecate.`, `This feature is deprecated.`, `is deprecated, עם d.`, `הודעת deprecation.`),
  VO.fix('vo-010', 1, `We released the feature to the air.`, `We shipped the feature.`, `ship a feature.`, `קולוקציה של מוצר.`),
  VO.fix('vo-011', 1, `Let's do a postmortem meeting.`, `Let's run a postmortem.`, `run a postmortem.`, `קולוקציה של תהליך.`),
  VO.fix('vo-012', 2, `The system did failover to the second region.`, `The system failed over to the second region.`, `fail over = פועל. failover = שם עצם.`, `שם עצם מול פועל.`),
  VO.fix('vo-013', 1, `I'll close a meeting with them.`, `I'll set up a meeting with them.`, `"לסגור פגישה" = set up. close a deal זה במכירות.`, `תרגום ישיר שמבלבל.`),
  VO.fix('vo-014', 3, `If it fails, the client tries again and again fast.`, `If it fails, the client backs off and retries.`, `back off = לחכות לפני ניסיון נוסף.`, `מונח של עמידות.`),
  VO.choice('vo-015', 1, `We will spread the version slowly to everyone.`, [`We'll roll in the version to all slowly.`, `We'll spread out the version slow.`, `We'll roll it out gradually.`], 2, `roll out = לפרוס בהדרגה.`, `phrasal verb מרכזי.`),
  VO.choice('vo-016', 1, `Can you raise me the permissions?`, [`Can you grant me access?`, `Can you raise me the permissions up?`, `Can you lift my permissions to me?`], 0, `grant access.`, `לבקש הרשאות.`),
  VO.choice('vo-017', 2, `We need to make smaller the risk.`, [`We need to small the risk.`, `We need to mitigate the risk.`, `We need to make less the risk.`], 1, `mitigate = להפחית.`, `מילה של ניהול סיכונים.`),
  VO.choice('vo-018', 1, `Let's do a deciding.`, [`Let's take down the decision.`, `Let's do a deciding now.`, `Let's make a decision.`], 2, `make a decision.`, `קולוקציה בסיסית.`),
  VO.choice('vo-019', 1, `I'll check it and return to you.`, [`I'll look into it and get back to you.`, `I'll check it and return back to you.`, `I'll check and come back you.`], 0, `look into, get back to.`, `phrasal verbs יומיומיים.`),
  VO.choice('vo-020', 2, `We need to push the deadline to forward.`, [`We need to push forward the deadline later.`, `We need to push back the deadline.`, `We need to move ahead back the deadline.`], 1, `push back = לדחות.`, `לוח זמנים.`),
  VO.choice('vo-021', 2, `The bug was fixed in production by hot.`, [`The bug was hot-fixed by hot.`, `We hotted the fix to production.`, `We shipped a hotfix to production.`], 2, `hotfix = תיקון דחוף.`, `מונח של שחרור.`),
  VO.choice('vo-022', 2, `I want to give credits to Alex.`, [`I want to give credit to Alex.`, `I want to give a credits to Alex.`, `I want to credit on Alex.`], 0, `give credit to, בלי a.`, `להכיר בעבודה של אחרים.`),
  VO.choice('vo-023', 1, `We will run on it tomorrow.`, [`We'll make a run on it tomorrow.`, `We'll run it tomorrow.`, `We'll run on it tomorrow morning on.`], 1, `run it = להריץ.`, `"נריץ את זה" בתרגום ישיר.`),
  VO.speak('vo-024', 2, { title_he: `תוכנית פריסה`, prompt_en: `Explain a gradual rollout plan in 45 seconds.`, seconds: 45, must: ['roll out', 'roll back', 'monitor'], banned: NOFILL, model_en: `We'll roll out the new version to five percent of users first. We'll monitor errors and latency for one hour. If anything looks wrong, we roll back in one click. If not, we go to fifty percent, and then to everyone.`, bad: `we do a deploy to some users and then we see`, why_he: `phrasal verbs בתוך הסבר אמיתי.` }),
  VO.speak('vo-025', 1, { title_he: `להרים ולפרק`, prompt_en: `Explain the life of a test environment. Use "spin up" and "tear down". 30 seconds.`, seconds: 30, must: ['spin up', 'tear down'], banned: NOFILL, model_en: `For every pull request, we spin up a test environment. It runs the full test suite. When the PR is merged, we tear down the environment automatically, and we stop paying for it.`, bad: `we lift up an environment and then we delete it`, why_he: `מחזור חיים של סביבה.` }),
  VO.speak('vo-026', 2, { title_he: `הוצאה משימוש`, prompt_en: `Announce that an old API is going away. 30 seconds.`, seconds: 30, must: ['deprecated', 'phase out', 'migrate'], banned: NOFILL, model_en: `The old API is deprecated as of this month. We'll phase out the old version over the next quarter. Teams that still use it should migrate to version two. We'll help each team with the move.`, bad: `the old API is finishing, please move`, why_he: `הודעה רשמית וברורה.` }),
  VO.speak('vo-027', 3, { title_he: `הגבלת קצב`, prompt_en: `Explain rate limiting in 30 seconds. Use "throttle", "back off" and "retry".`, seconds: 30, must: ['throttle', 'back off', 'retry'], banned: NOFILL, model_en: `When a client sends too many requests, we throttle it and return a 429. A good client should back off, wait a few seconds, and retry.`, bad: `if he does too much requests we block him`, why_he: `מונחי עמידות במשפט אחד.` }),
  VO.speak('vo-028', 2, { title_he: `קליטת עובד`, prompt_en: `Explain how you onboard a new engineer. 30 seconds.`, seconds: 30, must: ['onboard', 'provision', 'access'], banned: NOFILL, model_en: `To onboard a new engineer, we provision a laptop and a cloud account on day one. They get read access first, and write access after the first week.`, bad: `we enter him to the team and give him things`, why_he: `פעלים של תהליכי צוות.` }),
  VO.shadow('vo-029', 2, 'provision', `pro-VI-zhen. הדגש בהברה השנייה.`, `We provisioned three new nodes this morning.`, `פועל נפוץ בתשתית.`),
  VO.shadow('vo-030', 2, 'deprecated', `DEP-re-kay-ted. הדגש בהתחלה. לא depreciated.`, `This endpoint is deprecated. Please use version two.`, `מתבלבל עם depreciate.`),
  VO.shadow('vo-031', 2, 'mitigate / mitigation', `MIT-i-gate. mit-i-GAY-shen. הדגש זז.`, `We mitigated the impact. Mitigation came first, the fix came second.`, `דגש שזז בין פועל לשם עצם.`),
  VO.qa('vo-032', 2, `What's the difference between a rollback and a hotfix?`, `A rollback goes back to the last version that worked. A hotfix is a new, small change that fixes the bug. We roll back first when we can, because it's faster and safer.`, `שני מונחים, ההבדל, ומה עדיף.`, `להסביר מונחים בבהירות.`),

  // =====================================================================
  // STRESS - word stress and intonation
  // =====================================================================
  WS.shadow('ws-001', 1, 'record', `שם עצם: RE-cord. פועל: re-CORD.`, `We keep a record of every change. Let me record this demo.`, `אותה מילה, דגש אחר.`),
  WS.shadow('ws-002', 1, 'present', `שם עצם ותואר: PRE-sent. פועל: pre-SENT.`, `Today I'll present the results. Everyone is present.`, `מילה של כל הרצאה.`),
  WS.shadow('ws-003', 1, 'increase', `שם עצם: IN-crease. פועל: in-CREASE.`, `We saw an increase in errors. We need to increase the limit.`, `שם עצם מול פועל.`),
  WS.shadow('ws-004', 1, 'decrease', `שם עצם: DE-crease. פועל: de-CREASE.`, `Latency will decrease. That's a big decrease.`, `שם עצם מול פועל.`),
  WS.shadow('ws-005', 2, 'content', `CON-tent = תוכן. con-TENT = מרוצה.`, `The content is ready, and the team is content with it.`, `דגש משנה משמעות.`),
  WS.shadow('ws-006', 2, 'object', `OB-ject = אובייקט. ob-JECT = להתנגד.`, `Each object has an ID. Does anyone object?`, `דגש משנה משמעות.`),
  WS.shadow('ws-007', 2, 'project', `שם עצם: PRO-ject. פועל: pro-JECT (לחזות).`, `This project will take a year. We project a ten percent saving.`, `שם עצם מול פועל.`),
  WS.shadow('ws-008', 1, 'progress', `שם עצם: PRO-gress. פועל: pro-GRESS.`, `We made good progress. The work will progress next week.`, `מילה של כל עדכון.`),
  WS.shadow('ws-009', 1, 'update', `שם עצם: UP-date. פועל: up-DATE.`, `Here's a quick update. I'll update the ticket.`, `מילה של כל סטנדאפ.`),
  WS.shadow('ws-010', 2, 'contract', `CON-tract = חוזה. con-TRACT = להתכווץ.`, `The contract is signed. The budget may contract next year.`, `דגש משנה משמעות.`),
  WS.shadow('ws-011', 2, 'export / import', `שם עצם: EX-port, IM-port. פועל: ex-PORT, im-PORT.`, `Export the data, then import it into the new system.`, `פעלים של נתונים.`),
  WS.shadow('ws-012', 2, 'analysis / analyze', `a-NAL-y-sis. AN-a-lyze. הדגש זז.`, `Run the analysis first. Then analyze the results.`, `משפחת מילים עם דגש שזז.`),
  WS.shadow('ws-013', 2, 'technology / technical', `tech-NOL-o-gy. TECH-ni-cal.`, `The technology is new, but the technical risk is low.`, `משפחת מילים עם דגש שזז.`),
  WS.shadow('ws-014', 2, 'economy / economic', `e-CON-o-my. e-co-NOM-ic.`, `It's an economic decision, not a technical one.`, `משפחת מילים עם דגש שזז.`),
  WS.shadow('ws-015', 2, 'available / availability', `a-VAIL-a-ble. a-vail-a-BIL-i-ty.`, `The service is available. Availability is 99.9 percent.`, `מילה של SLA.`),
  WS.shadow('ws-016', 2, 'reliable / reliability', `re-LI-a-ble. re-li-a-BIL-i-ty.`, `It's reliable. Reliability is our top goal.`, `מילה של SRE.`),
  WS.shadow('ws-017', 2, 'security / secure', `se-CUR-i-ty. se-CURE.`, `Security is not a feature. Make it secure by default.`, `מילה של כל הצגה.`),
  WS.shadow('ws-018', 2, 'configure / configuration', `con-FIG-ure. con-fig-u-RA-tion.`, `Configure the alert. Then check the configuration.`, `דגש שזז במילה ארוכה.`),
  WS.shadow('ws-019', 2, 'Kubernetes', `koo-ber-NET-eez. הדגש בהברה השלישית.`, `We run everything on Kubernetes.`, `שם כלי שנאמר המון.`),
  WS.shadow('ws-020', 1, 'Linux', `LIN-ux. i קצרה, לא לַיי.`, `The servers run Linux.`, `הגייה נפוצה לא נכונה.`),
  WS.shadow('ws-021', 1, 'cache', `קֶאש, כמו cash. לא קאצ'ה.`, `The cache is warm, and the hit rate is high.`, `מילה טכנית שנהגית לא נכון.`),
  WS.shadow('ws-022', 1, 'queue', `קְיוּ, כמו האות Q. כל שאר האותיות שקטות.`, `The queue is empty again.`, `מילה טכנית שנהגית לא נכון.`),
  WS.shadow('ws-023', 1, 'Is it ready?', `שאלת כן או לא: הקול עולה בסוף.`, `Is it ready? Did the tests pass?`, `אינטונציה של שאלה.`),
  WS.shadow('ws-024', 1, `It's ready.`, `משפט חיווי: הקול יורד בסוף. נשמע בטוח.`, `It's ready. The tests passed.`, `קול יורד = ביטחון.`),
  WS.shadow('ws-025', 2, 'When is the release?', `שאלת wh: הקול יורד בסוף, לא עולה.`, `When is the release? Who owns it?`, `אינטונציה של שאלות wh.`),
  WS.shadow('ws-026', 2, 'logs, metrics, and traces', `ברשימה: עולה, עולה, ויורד במילה האחרונה.`, `We collect logs, metrics, and traces.`, `אינטונציה של רשימה.`),
  WS.shadow('ws-027', 3, `isn't the API. It's the database.`, `מדגישים את המילים שמנוגדות: API, database.`, `The problem isn't the API. It's the database.`, `דגש של ניגוד.`),
  WS.shadow('ws-028', 3, 'We did test it.', `מדגישים את did כדי לענות לספק.`, `We did test it. We tested it twice.`, `דגש של הדגשה.`),
  WS.choice('ws-029', 1, `development`, [`de-vel-op-MENT`, `DE-vel-op-ment`, `de-VEL-op-ment`], 2, `הדגש בהברה השנייה, כמו ב-develop.`, `איפה הדגש.`),
  WS.choice('ws-030', 1, `record (the verb: "Let me record this")`, [`re-CORD`, `RE-cord`, `re-cor-DING`], 0, `פועל: הדגש בסוף.`, `שם עצם מול פועל.`),
  WS.choice('ws-031', 2, `analysis`, [`AN-a-ly-sis`, `a-NAL-y-sis`, `a-na-LY-sis`], 1, `הדגש בהברה השנייה.`, `איפה הדגש.`),
  WS.choice('ws-032', 1, `Is it ready.`, [`IS IT READY (every word loud)`, `Is it ready. (the voice goes down and flat)`, `Is it ready? (the voice goes up at the end)`], 2, `שאלת כן או לא: הקול עולה.`, `אינטונציה של שאלה.`),
  WS.speak('ws-033', 2, { title_he: `שלוש מילים, דגש נכון`, prompt_en: `Give a 20-second update. Use "progress" (noun), "increase" (verb) and "record" (verb), with the right stress.`, seconds: 20, must: ['progress', 'increase', 'record'], banned: NOFILL, model_en: `We made good progress this week. We want to increase the cache size, and I'll record a short demo for the team.`, bad: `we did a progress, we want to make increase`, why_he: `דגש נכון בתוך משפט אמיתי.` }),
  WS.recall('ws-034', 2, `משפטים עם דגש נכון`, `Here's a quick update. We made progress on the project. We saw an increase in traffic, and we need to increase the limit. I'll record the demo today.`, `שם עצם ופועל באותו משפט.`),
  WS.speak('ws-035', 1, { title_he: `שאלה עולה, תשובה יורדת`, prompt_en: `Ask two yes or no questions and answer them. Questions go up. Answers go down.`, seconds: 20, must: ['is it', 'yes'], banned: NOFILL, model_en: `Is it ready? Yes, it's ready. Did the tests pass? Yes, all of them passed.`, bad: `It's ready? It's ready.`, why_he: `אינטונציה של שאלה ותשובה.` }),
  WS.recall('ws-036', 2, `רשימה וניגוד`, `We collect three things: logs, metrics, and traces. The problem isn't the API. It's the database. And yes, we did test it.`, `רשימה, ניגוד והדגשה.`),
  WS.speak('ws-037', 3, { title_he: `לתקן הנחה שגויה`, prompt_en: `Someone thinks the network is the problem. Correct them. Stress the word that matters. 20 seconds.`, seconds: 20, must: ["isn't", 'it is'], banned: NOFILL, model_en: `The problem isn't the network. It's the database. And it isn't the whole database. It's one slow query.`, bad: `no, it's not network, it's database`, why_he: `דגש של ניגוד בתוך תשובה.` }),
  WS.recall('ws-038', 3, `מילים ארוכות`, `Our technology is reliable. Reliability and availability are our top goals. Configure it once, and check the configuration every quarter. Security comes first.`, `מילים ארוכות עם דגש שזז.`),
  WS.speak('ws-039', 2, { title_he: `הסטאק שלנו`, prompt_en: `Explain your stack in 20 seconds. Use Kubernetes, Linux, cache and queue.`, seconds: 20, must: ['Kubernetes', 'Linux', 'cache', 'queue'], banned: NOFILL, model_en: `We run Linux nodes on Kubernetes. Requests go through a cache first. Slow jobs go to a queue, and workers pick them up.`, bad: `we have kubernetis, lainux and a cachy`, why_he: `מילים טכניות בהגייה נכונה.` }),

  // =====================================================================
  // INTERVIEW - talking about your work and impact
  // =====================================================================
  IV.fix('iv-001', 1, `I am working in DevOps since five years.`, `I've been working in DevOps for five years.`, `have been + ing + for. לא since עם משך זמן.`, `משפט פתיחה בכל ראיון.`),
  IV.fix('iv-002', 1, `I was responsible on the CI.`, `I was responsible for the CI pipelines.`, `responsible for.`, `לתאר תפקיד.`),
  IV.fix('iv-003', 2, `We did a big improvement.`, `I cut build time by 40 percent.`, `I, פועל חזק, ומספר.`, `השפעה במספרים.`),
  IV.fix('iv-004', 2, `My role is to do everything.`, `I own the deployment platform and on-call for 30 services.`, `own = אחראי עד הסוף.`, `תפקיד ברור.`),
  IV.fix('iv-005', 2, `I know Kubernetes, Terraform, Helm, Jenkins, Ansible, everything.`, `I work mostly with Kubernetes and Terraform, every day.`, `שניים או שלושה כלים, עם עומק.`, `רשימה ארוכה נשמעת שטחית.`),
  IV.fix('iv-006', 1, `I learned from it a lot.`, `I learned a lot from it.`, `a lot לפני from it.`, `סדר מילים.`),
  IV.fix('iv-007', 1, `I am very good in automation.`, `I'm very good at automation.`, `good at.`, `מילת יחס.`),
  IV.fix('iv-008', 2, `The project succeeded thanks to me.`, `I led the project, and it shipped on time.`, `עובדות במקום שבח עצמי.`, `קרדיט בלי יהירות.`),
  IV.fix('iv-009', 3, `I don't have failures.`, `One failure I learned from was a migration I rushed.`, `כולם נכשלים. מראים מה למדת.`, `שאלת כישלון.`),
  IV.fix('iv-010', 1, `I'm looking for challenge.`, `I'm looking for a new challenge.`, `a new challenge.`, `סיבה לחפש עבודה.`),
  IV.choice('iv-011', 2, `We saved a lot of money.`, [`I cut our cloud bill by [X] percent in six months.`, `We saved very a lot of moneys.`, `Lot of money was saving by us.`], 0, `מספר, זמן, ו-I.`, `השפעה מדידה.`),
  IV.choice('iv-012', 2, `I was part of the team that did it.`, [`I was a part from the team doing it.`, `I led the design, and two engineers built it with me.`, `The team did, I was there inside.`], 1, `מה אתה עשית בדיוק.`, `תפקיד שלך בצוות.`),
  IV.choice('iv-013', 1, `In my last place of work...`, [`In my previous work place of job...`, `In my last working place...`, `In my last role...`], 2, `in my last role.`, `ביטוי קבוע בראיונות.`),
  IV.choice('iv-014', 1, `I'm doing DevOps.`, [`I'm a DevOps engineer. I focus on CI/CD and reliability.`, `I'm making DevOps.`, `I do the DevOps things.`], 0, `תפקיד ואז מיקוד.`, `להציג את עצמך.`),
  IV.choice('iv-015', 1, `I tell you story now, basically.`, [`I tell you story now basically.`, `Let me give you an example.`, `Story time, so, basically, okay.`], 1, `let me give you an example.`, `מעבר לסיפור.`),
  IV.choice('iv-016', 2, `The result was good.`, [`Result: good result.`, `The result was good, very good.`, `As a result, deploys went from weekly to daily.`], 2, `as a result + שינוי מדיד.`, `סוף של סיפור STAR.`),
  IV.choice('iv-017', 2, `Why I want this job? Because...`, [`I want this role because it's about reliability at scale.`, `Why I want? Because the job.`, `I am wanting this job for because...`], 0, `I want this role because.`, `מוטיבציה.`),
  IV.speak('iv-018', 1, { title_he: `התפקיד שלי`, prompt_en: `Describe your role in 45 seconds: team, what you own, what you're responsible for.`, seconds: 45, must: ['I own', 'responsible for', 'team'], banned: ['basically', 'so', 'um', 'like'], model_en: `I'm a DevOps engineer on a platform team of 6 people. I own the CI/CD pipelines and our Kubernetes clusters. I'm also responsible for on-call and incident reviews.`, bad: `basically I do a lot of things, like everything DevOps`, why_he: `תיאור תפקיד ממוקד.` }),
  IV.speak('iv-019', 2, { title_he: `השפעה במספרים`, prompt_en: `Describe one result you achieved, with numbers (example numbers are fine) and why it matters. 30 seconds.`, seconds: 30, must: ['by', 'percent', 'which means'], banned: NOFILL, model_en: `I cut our build time by 50 percent, from 20 minutes to 10 minutes, which means every engineer gets feedback faster, and we ship more often.`, bad: `we improved the builds a lot, it was very good`, why_he: `מספר ומשמעות.` }),
  IV.speak('iv-020', 3, { title_he: `תשובת STAR`, prompt_en: `Tell a STAR story: situation, task, action, result. 60 seconds.`, seconds: 60, must: ['the situation was', 'my task was', 'as a result'], banned: ['so', 'basically', 'um', 'uh', 'whatever'], model_en: `The situation was that our deploys failed about once a week. My task was to make them reliable. I added health checks and automatic rollback, and I wrote a runbook. As a result, failed deploys dropped by 80 percent in two months.`, bad: `so basically there was a problem and we fixed it`, why_he: `מבנה סיפור שמראיינים מחפשים.` }),
  IV.speak('iv-021', 3, { title_he: `ספר על כישלון`, prompt_en: `"Tell me about a failure." Answer in 45 seconds: the mistake, what you learned, what you do now.`, seconds: 45, must: ['I made a mistake', 'I learned', 'now I'], banned: NOFILL, model_en: `Early in my last role, I made a mistake. I rushed a database migration without a rollback plan, and we had 30 minutes of downtime. I learned to always test the rollback first. Now I don't start a migration without one.`, bad: `I don't really have failures`, why_he: `כנות ולמידה.` }),
  IV.speak('iv-022', 2, { title_he: `למה אותך`, prompt_en: `"Why should we hire you?" Answer in 30 seconds with one example.`, seconds: 30, must: ['I bring', 'for example'], banned: NOFILL, model_en: `I bring two things: deep experience with Kubernetes, and calm in incidents. For example, I led the response to our biggest outage last year, and I wrote the postmortem process we still use.`, bad: `because I'm very good and I know everything`, why_he: `טענה עם הוכחה.` }),
  IV.speak('iv-023', 3, { title_he: `קונפליקט`, prompt_en: `Tell about a disagreement with a colleague and how you solved it. 45 seconds.`, seconds: 45, must: ['we disagreed', 'I listened', 'we agreed'], banned: NOFILL, model_en: `A developer on my team saw it differently. We disagreed about release speed. He wanted daily releases, and I was worried about stability. I listened to his reasons, and we agreed on daily releases with a canary step. It worked well.`, bad: `he was wrong and in the end I was right`, why_he: `לספר על קונפליקט בבגרות.` }),
  IV.recall('iv-024', 1, `ספר על עצמך`, `I'm a DevOps engineer with 8 years of experience. Today I own the CI/CD platform and the Kubernetes clusters for my team. I like making systems boring and reliable. I'm looking for a role with more scale and more ownership.`, `תשובה מוכנה לשאלה הראשונה.`),
  IV.recall('iv-025', 2, `סיפור STAR קצר`, `Situation: deploys failed once a week. Task: make them reliable. Action: I added health checks, automatic rollback, and a runbook. Result: failed deploys dropped by 80 percent.`, `ארבעה חלקים, משפט לכל אחד.`),
  IV.recall('iv-026', 1, `סיום ראיון`, `Thank you for your time. I enjoyed the conversation, and I'm excited about the role. What are the next steps?`, `סיום חם עם שאלה.`),
  IV.qa('iv-027', 2, `What's your biggest weakness?`, `I sometimes take on too much myself. I've learned to delegate earlier, and I now ask for help on the first day of a problem, not the third.`, `חולשה אמיתית ומה אתה עושה איתה.`, `שאלה קלאסית.`),
  IV.qa('iv-028', 2, `Why are you leaving your current job?`, `I've learned a lot there, and I'm proud of what we built. I'm looking for bigger scale and a new challenge, and this role offers both.`, `חיובי על העבר, ממוקד בעתיד.`, `שאלה רגישה.`),
  IV.qa('iv-029', 3, `What would you do in your first 90 days?`, `First, listen and learn the systems. Then, fix one painful thing, to build trust. By day 90, I'd like to own one area end to end.`, `שלבים ברורים לפי זמן.`, `תוכנית התחלה.`),
  IV.qa('iv-030', 1, `Do you have any questions for us?`, `Yes, two. What does success look like in this role after six months? And what's the biggest reliability challenge the team has today?`, `תמיד שאלה אחת או שתיים.`, `סוף ראיון.`),

  // =====================================================================
  // SMALLTALK - small talk with international colleagues
  // =====================================================================
  SM.fix('sm-001', 1, `Fine, and what with you?`, `I'm good, thanks. How about you?`, `how about you.`, `פתיחה של כל שיחה.`),
  SM.fix('sm-002', 1, `It was nice, we were at the sea.`, `It was great. We went to the beach.`, `went to the beach. sea זה הים עצמו.`, `לספר על סוף שבוע.`),
  SM.fix('sm-003', 1, `It's very hot today, no?`, `It's really hot today, isn't it?`, `isn't it בסוף, לא no.`, `שאלת אישור טבעית.`),
  SM.fix('sm-004', 1, `I'm sorry on the delay.`, `Sorry I'm late.`, `sorry I'm late. קצר.`, `כניסה מאוחרת לשיחה.`),
  SM.fix('sm-005', 1, `Where are you sitting?`, `Where are you based?`, `based = איפה אתה גר או עובד.`, `תרגום ישיר של "איפה אתה יושב".`),
  SM.fix('sm-006', 1, `What's the weather by you?`, `What's the weather like where you are?`, `like where you are.`, `"אצלך" בתרגום ישיר.`),
  SM.fix('sm-007', 1, `Bye bye, see you, bye.`, `Great talking to you. Have a good weekend.`, `סיום אחד, חם וקצר.`, `סיום שיחה.`),
  SM.fix('sm-008', 1, `I was in a vacation.`, `I was on vacation.`, `on vacation.`, `מילת יחס.`),
  SM.fix('sm-009', 2, `How much time you are in the company?`, `How long have you been with the team?`, `how long have you been.`, `שאלה על ותק.`),
  SM.fix('sm-010', 1, `I'm happy to know you.`, `Nice to meet you.`, `nice to meet you.`, `היכרות ראשונה.`),
  SM.choice('sm-011', 1, `Did you eat?`, [`Did you eat already today the lunch?`, `How's your day going so far?`, `What did you eat, tell me?`], 1, `פתיחה בטוחה: איך היום שלך.`, `פתיחה לפני פגישה.`),
  SM.choice('sm-012', 2, `How old are you?`, [`What is your age please?`, `How much years you have?`, `How long have you been in this role?`], 2, `לא שואלים גיל, משכורת או פוליטיקה.`, `נושאים בטוחים.`),
  SM.choice('sm-013', 2, `How much do you earn?`, [`What are you working on these days?`, `How much money you are making?`, `Tell me your salary.`], 0, `שואלים על העבודה, לא על הכסף.`, `נושאים בטוחים.`),
  SM.choice('sm-014', 1, `Okay, bye.`, [`Okay bye bye bye.`, `Thanks, everyone. Talk soon.`, `Finish, bye.`], 1, `talk soon.`, `סיום שיחה בקבוצה.`),
  SM.choice('sm-015', 1, `You hear me?`, [`Hear me you can?`, `You hearing me?`, `Can you hear me okay?`], 2, `can you hear me okay.`, `בדיקת סאונד.`),
  SM.choice('sm-016', 1, `I'm waiting few more minutes for the others.`, [`Let's give it a couple of minutes for others to join.`, `We wait some minutes more for the others.`, `I am waiting to others few minutes.`], 0, `give it a couple of minutes.`, `מחכים שכולם יצטרפו.`),
  SM.choice('sm-017', 1, `What you did in the weekend?`, [`What you did on weekend?`, `Did you do anything fun this weekend?`, `What was doing your weekend?`], 1, `anything fun this weekend.`, `שאלה על סוף שבוע.`),
  SM.choice('sm-018', 1, `It's raining at us all week.`, [`By us is rain all week.`, `It's raining at us all the week.`, `It's been raining all week here.`], 2, `here במקום "אצלנו".`, `מזג אוויר.`),
  SM.speak('sm-019', 1, { title_he: `פתיחה לפני פגישה`, prompt_en: `Alex just joined the call. Open with small talk. 20 seconds.`, seconds: 20, must: ['how', 'weekend'], banned: NOFILL, model_en: `Hi Alex, good to see you. How was your weekend? Did you do anything fun, or was it a quiet one?`, bad: `hi, okay, so, let's start`, why_he: `חום לפני עבודה.` }),
  SM.speak('sm-020', 1, { title_he: `לספר על סוף השבוע`, prompt_en: `Someone asks: "How was your weekend?" Answer in 30 seconds and ask back.`, seconds: 30, must: ['it was', 'we went', 'how about you'], banned: NOFILL, model_en: `It was really nice, thanks. We went hiking in the north with the kids. It was a bit too hot, but the views were great. How about you?`, bad: `fine. nothing special.`, why_he: `תשובה עם פרט אחד ושאלה חזרה.` }),
  SM.speak('sm-021', 2, { title_he: `נסיעת עבודה`, prompt_en: `Tell a colleague about a recent work trip. 30 seconds.`, seconds: 30, must: ['trip', 'flight', 'in person'], banned: NOFILL, model_en: `I just got back from a work trip to Berlin. The flight was long, but the team was great, and it was nice to meet people in person.`, bad: `I was in a trip, it was okay`, why_he: `סיפור קצר ונעים.` }),
  SM.speak('sm-022', 1, { title_he: `מחכים לשאר`, prompt_en: `You host a call and people are still joining. Fill 20 seconds politely.`, seconds: 20, must: ['a couple of minutes', 'join'], banned: NOFILL, model_en: `Let's give it a couple of minutes for others to join. In the meantime, how's everyone doing? Busy week?`, bad: `um we wait, um`, why_he: `לא שתיקה מביכה.` }),
  SM.speak('sm-023', 1, { title_he: `סיום מנומס`, prompt_en: `Close a call warmly in 20 seconds.`, seconds: 20, must: ['thanks', 'talk soon'], banned: NOFILL, model_en: `I think we're done. Thanks, everyone, this was really useful. Have a great weekend, and talk soon.`, bad: `okay bye bye`, why_he: `סיום שמשאיר טעם טוב.` }),
  SM.speak('sm-024', 2, { title_he: `איפה אני ומזג האוויר`, prompt_en: `Say where you're based and what the weather is like, then ask back. 30 seconds.`, seconds: 30, must: ['based in', 'the weather'], banned: NOFILL, model_en: `I'm based in Israel. The weather here is great most of the year, but summer is very hot and humid. What's the weather like where you are?`, bad: `I'm sitting in Israel, it's hot by us`, why_he: `נושא בטוח עם כל אחד.` }),
  SM.recall('sm-025', 1, `פתיחה לפני פגישה`, `Hi everyone, good morning. How's everyone doing? Let's give it a minute for others to join.`, `פתיחה קבועה לכל שיחה.`),
  SM.recall('sm-026', 1, `סיום שיחה נעים`, `Great talking to you. Thanks for your time today. Have a good weekend, and talk soon.`, `סיום קבוע לכל שיחה.`),
  SM.recall('sm-027', 1, `להציג את עצמך`, `Hi, I'm [your name]. I'm on the platform team, and I work mostly on CI/CD and Kubernetes. Nice to meet you.`, `היכרות בשלושה משפטים.`),
  SM.qa('sm-028', 1, `So, where are you from?`, `I'm from Israel, from a small town near the sea. Have you ever been there?`, `תשובה קצרה ושאלה חזרה.`, `שאלה נפוצה בשיחות בינלאומיות.`),
  SM.qa('sm-029', 1, `How's the weather over there?`, `Hot, as usual. It's still summer here in October. How about you?`, `פרט אחד ושאלה חזרה.`, `שיחת חולין קלאסית.`),
  SM.qa('sm-030', 1, `Any plans for the weekend?`, `Nothing big. A family lunch on Saturday and some rest. How about you, any plans?`, `קצר, ושאלה חזרה.`, `סוף שבוע.`),
  SM.shadow('sm-031', 1, 'How are you doing?', `מחברים: how-are-ya-DO-ing. קליל.`, `Hey, how are you doing?`, `נשמע טבעי ולא רשמי.`),
  SM.shadow('sm-032', 1, 'Have a good one', `HAVE a GOOD one. סיום קליל.`, `Thanks, have a good one.`, `סיום טבעי של דוברי אנגלית.`)
];

export const ITEMS = [
  // =====================================================================
  // GRAMMAR - type 'fix'
  // =====================================================================
  // be-drop: common patterns
  G('g-001', 1, null, `Well, when we gonna add some users,`, `When we add more users,`, `אין "we gonna". או "we're going to", או פשוט הווה.`, BE),
  G('g-002', 1, null, `so he gonna fully use the quota as per his requests.`, `They're going to use the full quota.`, `חסר is/are לפני gonna. ובמקום he: they.`, BE),
  G('g-003', 1, null, `we can see that both of them sharing the same database,`, `You can see that they are both sharing the same database.`, `ing צריך is/are לפניו.`, BE),
  G('g-004', 1, null, `if he is the only user that using the test server,`, `If they're the only user who is using the test server,`, `that/who + ing = that is / who is.`, BE),
  G('g-005', 1, null, `fixing stuff that not working so well`, `fixing things that are not working well`, `that + not + ing = that are not.`, BE),
  G('g-006', 1, null, `the names of the engineers that working on`, `the names of the engineers who are working on it`, `אנשים: who are.`, BE),
  G('g-007', 1, null, `the services that using the cache`, `the services that are using the cache`, `that + ing = that are.`, BE),
  G('g-008', 2, null, `some gonna use uh 40 gigabytes`, `and some will use 40 gigabytes.`, `"will" קצר וברור.`, BE),
  G('g-009', 1, null, `how we gonna perform actual actions`, `how we are going to take real actions`, `we + are + going to.`, BE),
  G('g-010', 1, null, `here we have a service that connected`, `Here we have a service that is connected.`, `that + is.`, BE),
  G('g-011', 1, null, `here we also managing user`, `Here we also manage users.`, `הווה פשוט: we manage.`, BE),
  G('g-012', 1, null, `that currently consuming the old API`, `that is currently using the old API`, `that + is + ing.`, BE),
  G('g-013', 2, null, `the user that not used to work with`, `users who are not used to working with`, `who are, ו-used to + ing.`, BE),
  G('g-014', 1, null, `the events that happening here out there`, `the events that are happening out there`, `that + are + ing.`, BE),
  G('g-015', 1, null, `While we gonna add some more users,`, `When we add more users,`, `when + הווה פשוט. בלי gonna.`, BE),
  G('g-016', 2, null, `each and every user that we can see here uh that allowed to access`, `every user who is allowed to access the system`, `who + is + allowed.`, BE),
  G('g-017', 2, null, `there be users that using 2 million`, `Some users will use 2 million requests.`, `"there be" לא קיים. some users will use.`, BE),
  // be-drop: everyday tech talk
  G('g-018', 1, null, `The pipeline that failing every night is the deploy job.`, `The pipeline that is failing every night is the deploy job.`, `that + is + ing.`, BE),
  G('g-019', 1, null, `We still waiting for approval.`, `We're still waiting for approval.`, `we + are + ing.`, BE),
  G('g-020', 1, null, `The service that running on this port is nginx.`, `The service that's running on this port is nginx.`, `that's = that is.`, BE),
  G('g-021', 1, null, `They not using the new key yet.`, `They're not using the new key yet.`, `they + are + not.`, BE),
  G('g-022', 1, null, `I working on it right now.`, `I'm working on it right now.`, `I + am + ing.`, BE),
  G('g-023', 2, null, `The pods that crashing are all on the same node.`, `The pods that are crashing are all on the same node.`, `that + are + ing, גם כשיש עוד are אחר כך.`, BE),
  G('g-024', 1, null, `This dashboard very useful for on-call.`, `This dashboard is very useful for on-call.`, `חסר is לפני תואר.`, BE),
  G('g-025', 1, null, `The model not good for big features.`, `The model isn't good for big features.`, `isn't = is not.`, BE),
  G('g-026', 1, null, `Who responsible for this service?`, `Who is responsible for this service?`, `who + is + תואר.`, BE),
  G('g-027', 1, null, `The logs already in Grafana.`, `The logs are already in Grafana.`, `logs = רבים: are.`, BE),
  G('g-028', 2, null, `Everyone who joining today will get a key.`, `Everyone who is joining today will get a key.`, `everyone = יחיד: who is.`, BE),
  G('g-029', 2, null, `It's the script that we running every hour.`, `It's the script that we're running every hour.`, `we + are + ing.`, BE),
  // agreement
  G('g-030', 1, null, `it's make all the connections`, `It makes all the connections.`, `it + פועל + s. בלי "it's".`, AGR),
  G('g-031', 2, null, `an actual script that i built that are calling the new API`, `a script I built that calls the new API`, `script = יחיד: calls.`, AGR),
  G('g-032', 2, null, `the pros of this solution is that is in-house`, `The main advantage is that it's in-house.`, `pros = רבים. ו-"that it's", לא "that is".`, AGR),
  G('g-033', 1, null, `urgent bugs that needs to be taken care of`, `urgent bugs that need to be fixed now`, `bugs = רבים: need.`, AGR),
  G('g-034', 2, null, `why there is facts that are going through verification`, `That's why there are facts that go through verification.`, `facts = רבים: there are.`, AGR),
  G('g-035', 2, null, `this pr is already has been merged`, `This PR has already been merged.`, `רק has, בלי is.`, AGR),
  G('g-036', 2, null, `for example she send this it's refused`, `She sent this, and it was refused.`, `עבר: sent, was.`, AGR),
  G('g-037', 1, null, `Each user getting is their own limitations,`, `Each user gets their own limits.`, `each user = יחיד: gets.`, AGR),
  G('g-038', 1, null, `the cache server that are working through this flow`, `the cache server that is part of this flow`, `server = יחיד: that is.`, AGR),
  G('g-039', 1, null, `Each team have its own key.`, `Each team has its own key.`, `each = יחיד: has.`, AGR),
  G('g-040', 1, null, `The agent check Git first.`, `The agent checks Git first.`, `he/she/it + s.`, AGR),
  G('g-041', 1, null, `There is three steps.`, `There are three steps.`, `רבים: there are.`, AGR),
  G('g-042', 1, null, `Every request are logged.`, `Every request is logged.`, `every = יחיד: is.`, AGR),
  G('g-043', 2, null, `The number of errors are growing.`, `The number of errors is growing.`, `הנושא הוא number, יחיד: is.`, AGR),
  // articles
  G('g-044', 1, null, `so today the pain is the your organization is the um`, `Here's the pain in our organization today.`, `בלי "the" לפני your.`, ART),
  G('g-045', 1, null, `we want the people to enjoy the work`, `We want people to enjoy their work.`, `אנשים באופן כללי: בלי the.`, ART),
  G('g-046', 1, null, `shown eventually in the Grafana.`, `shown in Grafana.`, `שם של מוצר: בלי the.`, ART),
  G('g-047', 1, null, `it's a employee called Alex`, `an employee called Alex`, `לפני תנועה: an.`, ART),
  G('g-048', 1, null, `all we need is bigger server or whatever`, `All we need is a bigger server.`, `חסר a. ובלי whatever.`, ART),
  G('g-049', 2, null, `it's a separate from the main system`, `It's separate from the main system.`, `separate הוא תואר: בלי a.`, ART),
  G('g-050', 2, null, `it's not a human readable so much`, `It's not very human-readable.`, `תואר בלי a. ו-very במקום so much.`, ART),
  G('g-051', 1, null, `I sent you a email.`, `I sent you an email.`, `לפני תנועה: an.`, ART),
  G('g-052', 1, null, `It runs on the Kubernetes.`, `It runs on Kubernetes.`, `שם של מוצר: בלי the.`, ART),
  G('g-053', 1, null, `We have meeting tomorrow.`, `We have a meeting tomorrow.`, `שם עצם יחיד צריך a.`, ART),
  // question word order
  G('g-054', 1, null, `how much it's going to cost us`, `How much is it going to cost us?`, `בשאלה: is לפני it.`, QWO),
  G('g-055', 1, null, `What it does exactly?`, `What does it do exactly?`, `does + it + do.`, QWO),
  G('g-056', 1, null, `Why this is slow?`, `Why is this slow?`, `is לפני this.`, QWO),
  G('g-057', 1, null, `Where we store the logs?`, `Where do we store the logs?`, `do + we.`, QWO),
  G('g-058', 2, null, `Can you tell me what is the problem?`, `Can you tell me what the problem is?`, `שאלה בתוך משפט: סדר רגיל, is בסוף.`, QWO),
  // one-offs
  G('g-059', 2, null, `the UI itself is a lack of like feature and stuff to do`, `The UI is still basic.`, `משפט קצר במקום משפט שהולך לאיבוד.`, ONE),
  G('g-060', 1, null, `it's a pre-playground`, `It's a playground.`, `מילה שלא קיימת. פשוט playground.`, ONE),
  G('g-061', 2, null, `We don't own it to anyone`, `We don't depend on any vendor.`, `לא ביטוי באנגלית. depend on any vendor.`, ONE),
  G('g-062', 2, null, `this is a bit slower than we used to with the old version`, `It's a bit slower than what we're used to with the old version.`, `what we're used to: חסר are.`, ONE),

  // =====================================================================
  // PRONOUN - type 'fix'
  // =====================================================================
  P('p-001', 1, null, `so here i ask him what does the project contain`, `Here I ask it what the project contains.`, `מודל = it. ובשאלה עקיפה: what the project contains.`, PRO),
  P('p-002', 1, null, `fix apply he fixed something`, `Fix applied. It fixed the bug.`, `it, ולהגיד מה בדיוק תוקן.`, PRO),
  P('p-003', 1, null, `you can see that he changed line six whatever`, `You can see it remembers: it changed line six.`, `it, ובלי whatever.`, PRO),
  P('p-004', 1, null, `let's give him another ticket`, `Let's give it another ticket.`, `agent = it.`, PRO),
  P('p-005', 2, null, `because again he's connecting to git he's doing his investigation`, `It's connecting to Git and doing its investigation.`, `its, לא his.`, PRO),
  P('p-006', 2, null, `we need to approve uh whatever he's doing`, `We need to approve everything it does.`, `it, ו-everything במקום whatever.`, PRO),
  P('p-007', 2, null, `whatever you configure this agent to do he will do`, `The agent does what you configure it to do.`, `agent = it.`, PRO),
  P('p-008', 2, null, `so he needs to ask a special approval to increase this.`, `They need to ask for approval to increase it.`, `משתמש כללי = they. ו-ask for.`, PRO),
  P('p-009', 2, null, `can generate his own key then use it paired the ide that he's using`, `can generate their own key and use it in their IDE.`, `their, ו-in their IDE.`, PRO),
  P('p-010', 1, null, `The model is fast, but he makes mistakes on long files.`, `The model is fast, but it makes mistakes on long files.`, `מודל = it.`, PRO),
  P('p-011', 1, null, `I asked the agent and she answered in two seconds.`, `I asked the agent and it answered in two seconds.`, `agent = it. לא she ולא he.`, PRO),
  P('p-012', 1, null, `Each engineer gets his own key.`, `Each engineer gets their own key.`, `אדם כללי = their.`, PRO),
  P('p-013', 1, null, `When a user hits the limit, he waits.`, `When users hit the limit, they wait.`, `ברבים זה הכי פשוט: they.`, PRO),
  P('p-014', 1, null, `The pipeline failed because he couldn't find the file.`, `The pipeline failed because it couldn't find the file.`, `pipeline = it.`, PRO),
  P('p-015', 2, null, `The agent posts his answer in Teams.`, `The agent posts its answer in Teams.`, `its, בלי גרש. it's = it is.`, PRO),
  P('p-016', 2, null, `If someone needs access, he should open a request.`, `If someone needs access, they should open a request.`, `someone = they.`, PRO),
  P('p-017', 1, null, `Let him run, he needs a minute.`, `Let it run. It needs a minute.`, `מודל שרץ = it. ושני משפטים קצרים.`, PRO),

  // =====================================================================
  // PHRASING - type 'choice'
  // =====================================================================
  C('ph-001', 1, null, `ask a special approval`, [`ask for special approval`, `ask special approval`, `request for a special approval`], 0, `ask for = לבקש.`, CAL),
  C('ph-002', 1, null, `we can call it in this way`, [`we can call it that way`, `let's call it alert fatigue`, `we call it like that way`], 1, `"that way" לא טבעי כאן.`, CAL),
  C('ph-003', 1, null, `we're asking for increments every while in there`, [`every while in there`, `each while`, `every now and then`], 2, `כל כמה זמן = every now and then.`, CAL),
  C('ph-004', 2, null, `we're not expecting of it to be like very aggressive`, [`we don't expect it to be`, `we're not expecting of it to be`, `we don't expect from it to be`], 0, `expect + it + to. בלי of / from.`, CAL),
  C('ph-005', 1, null, `very good user experience from our opinion`, [`from our opinion`, `in our opinion`, `by our opinion`], 1, `in my opinion, in our opinion.`, CAL),
  C('ph-006', 2, null, `if tomorrow um different new need is born`, [`a new need is born`, `a new need is opening`, `a new need comes up`], 2, `נולד צורך = a need comes up.`, CAL),
  C('ph-007', 2, null, `another ticket that already have been chewed`, [`that was already handled`, `already been chewed`, `that already was eaten`], 0, `"לעוס" לא עובר לאנגלית.`, CAL),
  C('ph-008', 1, null, `it's uh worth to maintain this kind of uh machine`, [`worth to maintain`, `worth maintaining`, `worth for maintaining`], 1, `worth + ing.`, CAL),
  C('ph-009', 1, null, `from security matter`, [`in matter of security`, `in security matter`, `in terms of security`], 2, `in terms of = בהקשר של.`, CAL),
  C('ph-010', 1, null, `you can use it whatever you want`, [`use it however you want`, `use it whatever you want`, `use it what you want`], 0, `however = בכל דרך.`, CAL),
  C('ph-011', 2, null, `he will get the most effect of the machine`, [`the most effect of the machine`, `the most out of the machine`, `the most from the machine effect`], 1, `ביטוי קבוע: get the most out of.`, CAL),
  C('ph-012', 1, null, `it can be more smarter`, [`more smarter`, `more smart`, `smarter`], 2, `smart הוא קצר: smarter, בלי more.`, CAL),
  C('ph-013', 1, null, `now we're gonna show how this is working off`, [`how this works`, `how this is working off`, `how this is working out of`], 0, `פשוט: how this works.`, CAL),
  C('ph-014', 1, null, `it's taking a lot of a bit time`, [`a lot of a bit time`, `a bit of time`, `a bit lot of time`], 1, `a bit of time.`, CAL),
  C('ph-015', 2, null, `it's not the best practice working as an SRE or DevOps engineer in this method.`, [`in this method`, `by this method way`, `this way`], 2, `בשיטה הזו = this way.`, CAL),
  C('ph-016', 2, null, `to make more efficiency and and to more productivity`, [`to make us more efficient and productive`, `to make more efficiency`, `to do more efficiency`], 0, `make + us + תואר.`, CAL),
  C('ph-017', 2, null, `according our needs`, [`pair our needs`, `based on our needs`, `by our needs`], 1, `לפי = based on, או per.`, CAL),
  C('ph-018', 2, null, `the cloud budget limit is [X] for month`, [`a [X] limit budget for the cloud`, `a [X] budget limit of month`, `a budget of [X] dollars a month for the cloud`], 2, `מספר עם יחידה וזמן: dollars a month.`, CAL),
  C('ph-019', 2, null, `probably we said it already before`, [`As I said earlier,`, `probably we already said that`, `Like we said before probably,`], 0, `As I said earlier: בלי probably.`, WEAK),
  C('ph-020', 2, null, `it's not so impressive`, [`It's not so impressive.`, `The page is simple on purpose.`, `It's nothing special, whatever.`], 1, `אל תקטין את העבודה שלך.`, WEAK),
  C('ph-021', 2, null, `i hope less no it's gonna take less`, [`I hope less, no, it takes less.`, `It will take, I hope, less.`, `This takes about a minute.`], 2, `משפט אחד בטוח במקום לחשוב בקול.`, WEAK),
  C('ph-022', 3, null, `this person is not effective or anything else`, [`The on-call engineer can't do anything else that day.`, `This person is not effective.`, `This person does nothing else.`], 0, `מדברים על המצב, לא על האדם.`, WEAK),
  C('ph-023', 1, null, `I have one question to you.`, [`I have a question to you.`, `I have a question for you.`, `I have to you a question.`], 1, `question for you.`, CAL),
  C('ph-024', 1, null, `Explain me please how it works.`, [`Can you explain me how it works?`, `Can you explain me how does it work?`, `Can you explain to me how it works?`], 2, `explain to me, או explain how it works.`, CAL),
  C('ph-025', 1, null, `We did a big mistake in the config.`, [`We made a mistake in the config.`, `We did a mistake in the config.`, `We did mistake in the config.`], 0, `make a mistake, לא do.`, CAL),
  C('ph-026', 1, null, `I'm agree with what you said.`, [`I'm agree with you.`, `I agree with you.`, `I am agreeing with you.`], 1, `agree הוא פועל: I agree.`, CAL),
  C('ph-027', 1, null, `We need to discuss about the cost.`, [`Let's discuss about the cost.`, `Let's discuss on the cost.`, `Let's discuss the cost.`], 2, `discuss בלי about.`, CAL),
  C('ph-028', 1, null, `It's depending in the load.`, [`It depends on the load.`, `It depends in the load.`, `It's depend of the load.`], 0, `depends on.`, CAL),
  C('ph-029', 2, null, `I work here since three years.`, [`I work here three years.`, `I've been working here for three years.`, `I'm working here since three years.`], 1, `עד עכשיו: have been + ing + for.`, CAL),
  C('ph-030', 1, null, `How it's called in English?`, [`How is it call in English?`, `How it called in English?`, `What's it called in English?`], 2, `What's it called? לא how.`, CAL),
  C('ph-031', 1, null, `In the end of the day, this is cheaper.`, [`At the end of the day, it's cheaper.`, `In the end of the day, it's cheaper.`, `On the end of the day, it's cheaper.`], 0, `ביטוי קבוע: at the end of the day.`, CAL),
  C('ph-032', 1, null, `Until now, we are with two regions.`, [`Until now we have two regions.`, `So far, we have two regions.`, `Till now we are having two regions.`], 1, `עד עכשיו = so far.`, CAL),
  C('ph-033', 1, null, `Please close the server when you leave.`, [`Turn the server closed before you leave.`, `Close the server before you leave.`, `Shut down the server before you leave.`], 2, `שרת ומחשב: shut down, turn off.`, CAL),
  C('ph-034', 1, null, `Let me return back to this slide.`, [`I'll come back to this slide.`, `I will return back to this slide.`, `I'll return back again to this slide.`], 0, `return כבר אומר back.`, CAL),
  C('ph-035', 2, null, `We arrived to a decision yesterday.`, [`We arrived to a decision.`, `We reached a decision.`, `We came to decision.`], 1, `reach a decision.`, CAL),
  C('ph-036', 1, null, `This one is more cheap.`, [`This solution is more cheaper.`, `This solution is more cheap.`, `This solution is cheaper.`], 2, `מילה קצרה: cheaper.`, CAL),

  // =====================================================================
  // FILLERS - type 'speak' (train silence instead of fillers)
  // =====================================================================
  F('f-001', 1, null, { title_he: `שתיקה במקום so`, prompt_en: `Tell me what you did at work yesterday. 30 seconds. Every time you want to say "so", stop for half a second instead.`, seconds: 30, must: [], banned: ['so', 'um', 'uh'], model_en: `Yesterday I worked on the deploy pipeline. A test was failing every night. I found the cause. It was an old config file. I fixed it and wrote a short note for the team.`, why_he: `הרגל נפוץ: so כמעט בכל מעבר בין משפטים.` }),
  F('f-002', 1, null, { title_he: `בלי basically`, prompt_en: `Explain what a load balancer does. 30 seconds. No "basically". Start with the answer.`, seconds: 30, must: ['traffic', 'servers'], banned: ['basically', 'actually', 'like'], model_en: `A load balancer spreads traffic across servers. Users talk to one address. Behind it, many servers share the work. If one server fails, the others keep going.`, why_he: `basically לא מוסיף משמעות. כמו "בעצם".` }),
  F('f-003', 1, null, { title_he: `לסיים רשימה בלי whatever`, prompt_en: `Name three tools you use every day, and say why in one sentence each. End the list with a full stop.`, seconds: 30, must: [], banned: ['whatever', 'or something', 'stuff'], model_en: `I use three tools every day. Git, to track every change. Grafana, to see what's happening. And an AI assistant, to move faster on small tasks. That's my day.`, bad: `we need better monitoring, more tests, or whatever`, why_he: `whatever בסוף רשימה נשמע כמו "לא אכפת לי".` }),
  F('f-004', 2, null, { title_he: `בלי like`, prompt_en: `Describe a typical on-call week. 45 seconds. No "like", no "you know".`, seconds: 45, must: ['alerts'], banned: ['like', 'you know', 'um', 'uh'], model_en: `On-call week starts on Monday. I watch the alerts and the support queue. Most alerts are small. Once or twice a week, something real breaks. Then I fix it, and I write a short summary for the team.`, why_he: `like כמו "כאילו". מוריד ביטחון.` }),
  F('f-005', 2, null, { title_he: `מספר בלי let's say`, prompt_en: `Give a short cost example with example numbers, like "500 dollars a month" or "40 users". No "let's say" before a number.`, seconds: 30, must: ['a month'], banned: ['let\'s say', 'probably', 'I think', 'basically'], model_en: `The new plan costs 500 dollars a month. Fixed. With 40 users, the old plan would cost about 900 dollars a month. That difference is what we save.`, bad: `but basically this is the break even okay this is the most logical i think average`, why_he: `let's say ו-I think לפני מספר נשמעים כמו ניחוש.` }),
  F('f-006', 2, null, { title_he: `בלי again`, prompt_en: `Explain why monitoring matters. 30 seconds. Say "again" only if you really said it before.`, seconds: 30, must: ['before users'], banned: ['again', 'so', 'basically'], model_en: `Monitoring tells you about a problem before users do. Without it, you learn from a complaint. With it, you see the problem first. And you fix it faster.`, why_he: `הרגל נפוץ: again בלי לחזור על שום דבר. זה נשמע כמו מילת מילוי.` }),
  F('f-007', 2, null, { title_he: `טענה חזקה, בלי מחלישים`, prompt_en: `Make one strong claim about a project you built. Three short sentences. No "probably", no "I think".`, seconds: 20, must: [], banned: ['probably', 'I think', 'basically', 'kind of', 'maybe'], model_en: `It works. It runs every hour, on real tickets. And it saves the on-call engineer real time.`, why_he: `probably ו-I think מחלישים כל טענה.` }),
  F('f-008', 2, null, { title_he: `הדגמה רצה, ואתה מדבר`, prompt_en: `A command is running on screen. Talk for 20 seconds about what it does. No "um", no "okay so".`, seconds: 20, must: ['while it runs'], banned: ['um', 'uh', 'so', 'okay'], model_en: `While it runs, here's what's happening. It reads the project. It finds the failing test. Then it suggests a fix. Watch the bottom line.`, bad: `so this is probably gonna take maybe a minute or two i hope less no it's gonna take less`, why_he: `טעות נפוצה: חושבים בקול בזמן ההמתנה.` }),
  F('f-009', 1, null, { title_he: `לענות בלי well ו-so`, prompt_en: `Answer: "Is it ready?" Start with yes or no. 15 seconds.`, seconds: 15, must: [], banned: ['so', 'well', 'um', 'basically'], model_en: `Not yet. The backend is live. The mobile app is planned for next month.`, why_he: `so ו-well בתחילת תשובה דוחים את התשובה.` }),
  F('f-010', 3, null, { title_he: `דקה שלמה, אפס מילוי`, prompt_en: `Explain alert fatigue in 60 seconds. Zero fillers. Pause instead.`, seconds: 60, must: ['alert fatigue', 'on-call'], banned: ALL, model_en: `Let me describe a common problem. Let's call it alert fatigue. Our on-call engineers get hundreds of alerts every week. Most of them are noise. After a while, people stop reading them. Then a real alert comes, and nobody reacts in time. That's what we want to fix.`, bad: `so the pain is the um, there is like a lot of alerts and basically nobody reads them`, why_he: `הבעיה היא צפיפות של מילים ריקות, לא מהירות.` }),
  F('f-011', 2, null, { title_he: `עצור, נשום, משפט חדש`, prompt_en: `Explain your team's main job in 45 seconds. After every sentence, pause for one second. Count it in your head.`, seconds: 45, must: [], banned: ['so', 'and then', 'um', 'uh', 'basically'], model_en: `My team keeps our systems running. We build the pipelines. We watch the alerts. When something breaks, we fix it. And we try to make sure it doesn't break the same way twice.`, why_he: `טעות נפוצה: משפטים שנמשכים בלי נקודה.` }),

  // =====================================================================
  // SPEAKING - type 'speak'
  // =====================================================================
  S('s-001', 1, null, { title_he: `הבעיה, עם שם`, prompt_en: `Explain a problem your team has. Give it a short name. 45 seconds.`, seconds: 45, must: ['let\'s call it', 'manual testing', 'want to fix'], banned: ['so', 'basically', 'whatever', 'um'], model_en: `Today we have a problem. Let's call it the slow release. Every release needs two full days of manual testing. When one test fails, we start again. Engineers wait instead of building. That's what we want to fix.`, bad: `so today the pain is the um, the releases are like very slow and basically everybody waits`, why_he: `טעות נפוצה: מתחילים בלי שם ברור לבעיה.` }),
  S('s-002', 2, null, { title_he: `ארכיטקטורה: בקשה אחת`, prompt_en: `Walk through one request in a system you know, end to end. 60 seconds.`, seconds: 60, must: ['load balancer', 'API', 'cache', 'database'], banned: ['so', 'basically', 'like', 'whatever'], model_en: `Here's one request, end to end. A user opens the app. The request goes to the load balancer, over TLS. Then to the API service. It checks the token and the rate limit. Then it looks in the cache. If the data isn't there, it reads from the database. The answer goes back to the user. And every request is logged.`, bad: `So the user goes through the load balancer to the API, to the database, getting the data.`, why_he: `טעות נפוצה: רשימה של רכיבים במקום מסלול של בקשה.` }),
  S('s-003', 1, null, { title_he: `פתרון פשוט, ועדיין שימושי`, prompt_en: `Explain why a simple solution is still useful, even with limits. 45 seconds.`, seconds: 45, must: ['to be clear', 'won\'t', 'good enough'], banned: ['so', 'basically', 'whatever', 'like'], model_en: `To be clear, this is a simple tool. It won't replace our main platform. But for daily reports and small checks, it's good enough. And it costs almost nothing to run.`, bad: `again this is very uh small and weak tool, we're not expecting of it to be like very aggressive`, why_he: `טעות נפוצה: מגבלה נכונה, אבל מנוסחת חלש.` }),
  S('s-004', 2, null, { title_he: `עלות ונקודת איזון`, prompt_en: `Explain the cost of a new tool and the break-even. Use example numbers. 60 seconds.`, seconds: 60, must: ['fixed', 'a month', 'old plan', 'break-even'], banned: ['basically', 'I think', 'let\'s say', 'probably'], model_en: `The new tool costs 2,000 dollars a month. Fixed, used or not. Our base case: 40 users, every working day. With the old plan, that's about 3,500 dollars a month. That means we save about 1,500 dollars a month. And break-even is only 23 users.`, bad: `but basically this is the break even okay this is the most logical i think average something that i can see happening`, why_he: `טעות נפוצה: נשמעים הססנים בדיוק ברגע של המספרים.` }),
  S('s-005', 2, null, { title_he: `ה-pipeline מקבל PR חדש`, prompt_en: `Explain what your CI pipeline does with a new pull request. 60 seconds.`, seconds: 60, must: ['picks it up', 'runs the tests', 'a summary', 'a human decides'], banned: ['so', 'again', 'whatever', 'he'], model_en: `A developer opens a pull request. The pipeline picks it up. It builds the code and runs the tests. Then it scans the dependencies for known issues. It posts a summary on the pull request: what passed, what failed, and why. It can't merge anything. A human decides.`, bad: `again this is only um checking the tests and he posts some i don't know response`, why_he: `טעות נפוצה: he על מערכת, וחיפוש מילים בקול.` }),
  S('s-006', 2, null, { title_he: `אבטחה בארבע נקודות`, prompt_en: `Explain the security of a system in four points. 45 seconds.`, seconds: 45, must: ['no VPN, no access', 'own account', 'logged', 'approval'], banned: ['so', 'again', 'probably', 'basically'], model_en: `Security, in four points. One: no VPN, no access. Two: every user has their own account, with limits. Three: every action is logged. Four: every change in production needs an admin's approval.`, bad: `uh so in matter of security so again anything that is not in the vpn cannot access probably we already said that`, why_he: `טעות נפוצה: אבטחה מקבלת משפט אחד במקום הסבר מסודר.` }),
  S('s-007', 1, null, { title_he: `אימוץ`, prompt_en: `Explain why people will actually use a new internal tool. 45 seconds.`, seconds: 45, must: ['same', 'nothing new to learn'], banned: ['so', 'like', 'let\'s say', 'gonna'], model_en: `Nobody wants a new tool. But this works inside the tools people use today: the same editor, the same chat. Same commands, same screen. Just one new button. There's nothing new to learn.`, bad: `how the the user that not used to work with let's say this kind of tool gonna like adopt the the solution`, why_he: `טעות נפוצה: הטיעון הכי חזק נאמר בסוף, ובצורה מבולגנת.` }),
  S('s-008', 2, null, { title_he: `מה חי, מה מתוכנן, מה רעיון`, prompt_en: `Say clearly what is live, what is planned, and what is only an idea. 45 seconds.`, seconds: 45, must: ['live', 'planned', 'an idea', 'haven\'t tested it yet'], banned: ['basically', 'probably', 'whatever'], model_en: `Let me be clear about status. The new search page is live. The mobile version is live for ten percent of users. The export feature is tested and ready. The admin dashboard is planned. Offline mode is an idea. We haven't tested it yet.`, bad: `so here we have an actual feature that i built that are working for all the users`, why_he: `טעות נפוצה: אומרים "עובד" על משהו שעדיין מתוכנן.` }),
  S('s-009', 2, null, { title_he: `קריינות להדגמה`, prompt_en: `Narrate a live demo: before, while it runs, and after. 60 seconds.`, seconds: 60, must: ['watch', 'while it runs', 'what did we just see'], banned: ['um', 'uh', 'probably', 'he'], model_en: `Let me show you. I'll upload a large file and run the import. Watch the progress bar at the bottom. While it runs: the file is split into small parts, and each part is checked. Now, what did we just see? It read ten thousand rows, found two bad ones, and imported the rest.`, bad: `so this is probably gonna take maybe a minute or two i hope less no it's gonna take less`, why_he: `טעות נפוצה: הדגמה בלי "לאן להסתכל" ובלי סיכום.` }),
  S('s-010', 2, null, { title_he: `גרסת מעלית, 30 שניות`, prompt_en: `Elevator pitch for a manager. Problem, solution, one number, one ask. 30 seconds.`, seconds: 30, must: ['fixed price', 'my ask'], banned: ALL, model_en: `Today every release needs two days of manual testing, and engineers wait. We can automate most of it, with a test service at a fixed price. That saves about 6 engineer days every month. My ask: approve a pilot for one quarter.`, why_he: `מצב נפוץ: מנהל אומר "יש לי 5 דקות", ואין גרסה קצרה מוכנה.` }),
  S('s-011', 3, null, { title_he: `הנהלה, שתי דקות`, prompt_en: `Two-minute update for executives. Bottom line first, then risk, then the ask.`, seconds: 120, must: ['bottom line', 'risk', 'my ask'], banned: ['basically', 'whatever', 'I think', 'probably'], model_en: `Bottom line first. We can cut our database cost by about 30 percent, and stop most night pages, by moving to a managed database. Here's the situation. Today we run the database ourselves. Every upgrade takes a weekend, and on-call gets paged almost every week. The managed service costs 4,000 dollars a month. At our size, we save about 2,500 dollars a month, including engineer time. Now, the main risk. The migration needs a short read-only window. We tested it twice in staging, and we have a rollback plan. My ask: approve the migration for next quarter. I'll report cost and incidents every month.`, why_he: `טעות נפוצה מול הנהלה: המספר והבקשה מגיעים רק בסוף.` }),
  S('s-012', 3, null, { title_he: `תשובה לספקן`, prompt_en: `A colleague says: "This new tool will never be as good as the one we use today." Answer for 45 seconds. Agree with the concern, not the conclusion.`, seconds: 45, must: ['fair', 'complex cases', 'good enough'], banned: ['basically', 'whatever', 'actually', 'you know'], model_en: `That's fair. It's not as powerful as the tool we use today. For complex cases, keep using it. But most of our daily work is not complex. It's small reports and routine checks. For that, it's good enough, and it's much cheaper.`, why_he: `טעות נפוצה: מתווכחים עם הספקן במקום להסכים עם הדאגה.` }),
  S('s-013', 2, null, { title_he: `"אני לא יודע", יפה`, prompt_en: `Someone asks a question you can't answer. Say "I don't know" well, and promise a follow-up. 20 seconds.`, seconds: 20, must: ['I don\'t know', 'I\'ll check'], banned: ['um', 'uh', 'whatever', 'probably'], model_en: `Good question. I don't know yet. I'll check with the team and send you the answer today.`, why_he: `טעות נפוצה: מחפשים מילים בקול במקום "לא יודע" ברור.` }),
  S('s-014', 2, null, { title_he: `העברת רשות הדיבור`, prompt_en: `Hand over to a colleague who will run the next part. Give credit by name. 20 seconds.`, seconds: 20, must: ['Alex', 'over to'], banned: ['so', 'basically', 'okay'], model_en: `That's the architecture. Alex built the data pipeline behind it, and Alex will show you how it works. Alex, over to you.`, why_he: `טעות נפוצה: קרדיט טוב, אבל מעבר לא ברור.` }),
  S('s-015', 2, null, { title_he: `סיום`, prompt_en: `Close your talk. Three points, one line to remember, one ask. 45 seconds.`, seconds: 45, must: ['three things', 'my ask', 'questions'], banned: ['that\'s it', 'whatever', 'basically'], model_en: `Three things to remember. One: deploys now take minutes, not hours. Two: you keep the same workflow, with one new command. Three: every new service already uses it. Shipping should be boring, in a good way. My ask: move one service this week. Thank you. Questions?`, bad: `We don't own it to anyone, so we can do whatever we want, basically. That's it. If anyone has any questions`, why_he: `טעות נפוצה: סיום ב-"That's it" נשמע כמו "נגמר הזמן".` }),
  S('s-016', 1, null, { title_he: `הפתרון במשפט אחד`, prompt_en: `Say the solution in three short sentences. 20 seconds.`, seconds: 20, must: ['our own', 'fixed price'], banned: ['okay', 'so', 'basically', 'which is'], model_en: `We built our own. A small internal service that creates the nightly reports. One server, for a fixed price.`, bad: `Okay, so the solution is we built a custom solution, which is a local, in our cloud, we're hosting a internal service machine.`, why_he: `טעות נפוצה: משפט ארוך אחד שהולך לאיבוד.` }),
  S('s-017', 1, null, { title_he: `כלי פשוט ב-30 שניות`, prompt_en: `Show a simple internal tool in 30 seconds. Don't apologize for it.`, seconds: 30, must: ['simple', 'the value'], banned: ['not so impressive', 'whatever', 'basically'], model_en: `This is the self-service page. You log in, and you get a test environment. That's the whole job. The page is simple on purpose. The value is the environment.`, bad: `So this is the, it's not so impressive, but the value of this system is the, this environment that can be used.`, why_he: `טעות נפוצה: מקטינים את העבודה שלך מול הקהל.` }),
  S('s-018', 2, null, { title_he: `למה בצ'אט של הצוות`, prompt_en: `Explain why alerts go to the team chat, and how it stays safe. 45 seconds.`, seconds: 45, must: ['where we already work', 'webhook', 'signed'], banned: ['like', 'whatever', 'he', 'basically'], model_en: `Why the team chat? Because that's where we already work. Every alert goes to one channel, with a clear owner. The chat tool is outside our network, on purpose. The only connection is a webhook, signed with a secret.`, bad: `why chat is very um nice to have alerts because security wise it's not connected to any like private vpn`, why_he: `טעות נפוצה: תכנון מכוון נשמע כמו חור אבטחה.` }),

  // =====================================================================
  // SCRIPTS - type 'recall'
  // =====================================================================
  R('r-001', 1, null, `פתיחה (60 שניות)`, `Quick question. Who here waited more than an hour for a build this week? Put a hand up in the chat. That's what we call build fatigue. When the build is slow, you stop. Or you switch tasks and lose focus. So we built a faster pipeline. It runs on shared runners in our cloud, for a fixed price. In the next 20 minutes I'll show you three things: how it works, two live demos, and what it costs. Let's start with the problem.`, `טעות נפוצה: פתיחה ב-"so we're here to present", בלי שאלה ובלי מפה.`),
  R('r-002', 1, null, `סיום (45 שניות)`, `So, three things to remember. One: builds now take minutes, not an hour. Two: you keep the same workflow, with one new config line. Three: every new service already uses it. Fast feedback should be normal, not a rare treat. My ask: move one service this week, and tell me what still slows you down. Thank you. Questions?`, `טעות נפוצה: סיום ב-"That's it", בלי מסר ובלי בקשה.`),
  R('r-003', 2, null, `הדגמה: לפני, בזמן, אחרי`, `Let me show you. I'll push a small change and watch the pipeline. Watch the top line: it says CACHED, not FULL BUILD. While it runs: the build reuses everything that didn't change. So what did we just see? It built one service, ran the tests, and the change is in staging. In under two minutes.`, `טעות נפוצה: לא אומרים לקהל לאן להסתכל.`),
  R('r-004', 1, null, `משפטי מעבר`, `I'll cover three things: the problem, the solution, and what it costs. That's the problem. Now, the solution. This is the important part. To be clear, this is not live yet. It's planned. Remember the slow build? This is where it matters. So, to sum up. One last thing.`, `הרגל נפוץ: כמעט כל מעבר הוא "So" או "Okay, so".`),
  R('r-005', 2, null, `כשההדגמה איטית`, `It takes a minute, because it's reading Git. Let's not wait. Here's one it already finished. Look at the structure: facts, a guess, and a fix. And it shows its own confidence. Here it's Medium.`, `שקט ארוך בזמן הדגמה נשמע כמו תקלה, במיוחד בשיחת וידאו.`),
  R('r-006', 2, null, `גרסת מעלית, 30 שניות (להנהלה)`, `Today every release needs two days of manual testing, and engineers wait. We can automate most of it, for a fixed price. That saves time every month, and nobody waits for a test slot. It already runs in two teams. My ask: approve a pilot for all teams for one quarter.`, `מצב נפוץ: אין גרסה קצרה עם מספר ובקשה.`),
  R('r-007', 1, null, `שובר קרח לפתיחה`, `Before we start, a small confession. I promised myself not to say "basically" today. If you hear it, write it in the chat. Whoever counts the most gets a coffee. On me.`, `הדקה הראשונה היא הכי לחוצה. משפט מוכן עוזר.`),
  R('r-008', 1, null, `מענה לשאלה מהקהל`, `Good question. A colleague asked if this works with our old services. The short answer is yes. Let me show you how.`, `טעות נפוצה: עונים בלי לחזור על השאלה, ולא כולם שמעו אותה.`),
  R('r-009', 2, null, `"אני לא יודע" בלי לאבד ביטחון`, `That's a good question, and I don't want to guess. I don't know yet. I'll check it today and send the answer to everyone in the chat.`, `טעות נפוצה: מחפשים מילים בקול במקום תשובה כנה.`),
  R('r-010', 2, null, `הדגמה נכשלה`, `Live demos. My favorite kind of incident. It's fine, I recorded this one this morning. Let me show you the recording. Same steps, same result.`, `אין תוכנית ב' מוכנה בשפה.`),
  R('r-011', 2, null, `העברה לעמית`, `That's the problem and the solution. The next part is Alex's work, and Alex knows it better than anyone. Alex, over to you.`, `טעות נפוצה: מעבר לא ברור בין דוברים.`),
  R('r-012', 3, null, `גרסת 5 דקות: המבנה`, `I'll give you the bottom line first. We can cut our release time in half, for a fixed price. Here's the problem in one minute. Here's the solution in one minute. One short demo. The cost, with one number. The risks, and what we did about them. And my ask. Let's go.`, `מצב נפוץ: הזמן נחתך, ואין מבנה קצר מוכן.`),

  // =====================================================================
  // QA - type 'qa'
  // =====================================================================
  Q('q-001', 2, null, `What do you need from us?`, `A decision. Approve the pilot for two teams for one quarter, at a fixed monthly price. I'll report usage and results every month.`, `הנהלה. התאם את הבקשה למה שאתה באמת רוצה.`, `טעות נפוצה: אין בקשה ברורה בסוף.`),
  Q('q-002', 2, null, `Is our data safe? You said you log everything.`, `Fair concern. The data never leaves our cloud. Access is VPN only, every user has their own account, and the logs are there for audits, not for reading people's messages. That's also why the tool tells users: don't send personal data.`, `אבטחה. קודם הסכם עם הדאגה, אחר כך עובדות. בדוק מי באמת רואה את הלוגים.`, `טעות נפוצה: מסר כפול על לוגים ופרטיות.`),
  Q('q-003', 2, null, `Is the new tool actually good enough?`, `For complex cases, no. Keep using the current tool. For reports, triage and simple fixes, yes. It passed all of our tests.`, `מהנדסים. כנות היא הנשק שלך כאן. ודא את תוצאות הבדיקות שלך.`, `טעות נפוצה: לא אומרים מתי להשתמש בכלי ומתי לא.`),
  Q('q-004', 2, null, `What happens if the server goes down?`, `Then people use the old flow, like they do today. Nothing that works today breaks. For production, we'd add a second server.`, `בדוק שזה נכון למערכת שלך לפני שאתה אומר את זה.`, `מצב נפוץ: אין תשובה מוכנה על כשל.`),
  Q('q-005', 3, null, `Who maintains this when you're on vacation?`, `Good question. Today it's mostly me. That's a risk, and it's why everything is in Git, with a runbook. Part of the ask is a second owner.`, `בדוק את המצב האמיתי. תשובה כנה על סיכון בונה אמון.`, `טעות נפוצה: לא מזכירים סיכון לפני שמישהו שואל.`),
  Q('q-006', 3, null, `Why not just buy a SaaS product for this?`, `Those charge per user. They solve the setup, not the cost. Ours is a fixed price, and the more people use it, the cheaper it gets per user.`, `השוואה למתחרים. תשובה במספרים, בלי לזלזל באף אחד.`, `טעות נפוצה: השוואה בלי טיעון עלות ברור.`),
  Q('q-007', 2, null, `How much of your time did this take?`, `Most of it was built over a few weeks, alongside my regular work. The point is: it's already built. Running it is cheap.`, `התאם למציאות. אל תקטין ואל תגדיל.`, `טעות נפוצה: מקטינים את העבודה שלך.`),
  Q('q-008', 1, null, `Can the automation change things in production?`, `No. Today it's read-only. The next step is limited write access, and every change needs an admin's approval. Human in the loop, always.`, `Security ו-SRE. "No" בהתחלה. ודא שזה המצב אצלך.`, `טעות נפוצה: תשובה ארוכה לשאלה של כן או לא.`),
  Q('q-009', 2, null, `Is it slow?`, `Slower than the old system, yes. The first response typically comes in 3 seconds, and 95 out of 100 requests finish in under 8 seconds. For batch work, that's fine.`, `צריך את המספרים האמיתיים שלך מהמדידה.`, `טעות נפוצה: המספרים על השקף, אבל לא נאמרים בקול.`),
  Q('q-010', 3, null, `So are we really saving money?`, `At our usage, yes: about 1,500 dollars a month. Break-even is 25 users. Below that, we pay for the option, not the savings.`, `צריך את המספרים האמיתיים שלך. תן מספר ותנאי, לא "it's not actually true".`, `טעות נפוצה: תשובה הססנית על כסף.`),
  Q('q-011', 2, null, `Why not just buy more licenses?`, `We could. But that cost grows with every new user. Our solution is a fixed price. The more we use it, the cheaper it gets per user. And nobody has to ask for approval.`, `תשובה קודם: "We could." ואז למה לא.`, `טעות נפוצה: ויכוח במקום תשובה קצרה.`),
  Q('q-012', 2, null, `What if many people use it at once?`, `Requests go to a queue, and 8 workers handle them in parallel. Each user gets three parallel requests. If you send more, you get HTTP 429, and you retry after a few seconds.`, `בדוק את המגבלות האמיתיות אצלך.`, `טעות נפוצה: תיאור לא מדויק של איך המערכת מחלקת עומס.`),
  Q('q-013', 1, null, `Can I use it from my own scripts, not only the web page?`, `Yes. The API works with any tool that can send an HTTP request: your editor, a script, or a pipeline. Every request is logged, so don't send personal data.`, `ודא אילו כלים באמת נבדקו.`, `טעות נפוצה: "use it whatever you want", בלי גבולות.`),
  Q('q-014', 2, null, `What if the model gives a wrong answer?`, `It will, sometimes. That's why it shows its confidence, and splits facts from guesses. And a human always decides. It suggests. It doesn't act.`, `כנות על טעויות בונה אמון.`, `טעות נפוצה: "it's pretty reliable" בלי הוכחה.`),
  Q('q-015', 2, null, `When will offline mode be ready?`, `It's an idea. We haven't tested it yet. If the pilot is approved, I'll test it next quarter and share the results.`, `תווית אמת: idea. אל תבטיח תאריך שאין לך.`, `טעות נפוצה: מציגים רעיון כאילו הוא כבר עובד.`),
  Q('q-016', 3, null, `Isn't this just reinventing what the vendor already sells?`, `In part, yes. The difference is the price model. They charge per user. We pay a fixed price, and we control where the data goes.`, `מתחיל בהסכמה חלקית. לא מתגונן.`, `טעות נפוצה: מתגוננים מול ספקן.`),
  Q('q-017', 1, null, `What's the next step?`, `Three things. A second owner. The monitoring dashboard, which is planned. And moving two more teams to the new platform. All in the next quarter.`, `התאם לתוכנית האמיתית שלך.`, `מצב נפוץ: אין "מה הלאה" ברור.`),
  Q('q-018', 2, null, `Do people actually use it?`, `About 60 engineers use it today, and usage grows every week. The best proof is that nobody asks for the old process anymore.`, `צריך את המספרים האמיתיים שלך. אל תמציא.`, `מצב נפוץ: אין נתון אימוץ מוכן.`),

  // =====================================================================
  // PRONUNCIATION - type 'shadow'
  // =====================================================================
  H('sh-001', 1, null, 'Claude', `קְלוֹד, כמו clawed. לא קְלָאוּד (cloud).`, `Claude Code runs in our cloud. Claude, not cloud.`, `טעות נפוצה: Claude נשמע כמו cloud, ותמלול אוטומטי שומע מילה אחרת.`),
  H('sh-002', 1, null, 'Anthropic', `הדגש על THROP: an-THROP-ic. בלי s בסוף.`, `Anthropic's model is smarter. Our model is cheaper.`, `טעות נפוצה: דגש במקום הלא נכון, ו-s מיותרת בסוף.`),
  H('sh-003', 1, null, 'Teams', `טִימְז. t רגילה, לא th.`, `Microsoft Teams. Every team uses Teams.`, `טעות נפוצה: th במקום t, ואז זה נשמע כמו "themes".`),
  H('sh-004', 1, null, 'cost', `o פתוחה וקצרה, כמו קָאסְט. לא coast.`, `The cost is fixed. The cost per user goes down.`, `טעות נפוצה: o ארוכה, ואז זה נשמע כמו "coast".`),
  H('sh-005', 1, null, 'tokens', `TOH-kens. הדגש בהתחלה.`, `How many tokens per user per day?`, `טעות נפוצה: דגש לא ברור, ותמלול אוטומטי שומע מילה אחרת.`),
  H('sh-006', 2, null, 'PostgreSQL', `פּוֹסְט, גְרֶס, קְיוּ, אֶל. הדגש על POST.`, `PostgreSQL stores every order.`, `שם מוצר ארוך שקל לבלוע.`),
  H('sh-007', 2, null, 'virtual', `VER-chu-al. v עם שיניים על השפה התחתונה.`, `Every team gets a virtual machine.`, `טעות נפוצה: v ו-w מתחלפות במבטא עברי.`),
  H('sh-008', 2, null, 'VPN', `וִי, פִּי, אֶן. ה-N ברורה בסוף.`, `Everything is behind the VPN.`, `טעות נפוצה: האות האחרונה בראשי תיבות נבלעת.`),
  H('sh-009', 2, null, 'the / three / think', `לשון בין השיניים. לא ד, לא ס, לא ט.`, `I think there are three things on the third slide.`, `th נשמע כמו d או s במבטא עברי.`),
  H('sh-010', 2, null, 'we / very / version', `w: שפתיים עגולות, בלי שיניים. v: שיניים על השפה התחתונה.`, `We have a very stable version of the server.`, `w ו-v מתחלפים במבטא עברי.`),
  H('sh-011', 2, null, 'logs / tests / tasks', `העיצורים בסוף ברורים: gz, sts, sks. לא לבלוע.`, `The tests passed, the tasks are done, and the logs are clean.`, `בליעת עיצורים בסוף מילה.`),
  H('sh-012', 2, null, 'develop / development', `di-VEL-op. di-VEL-op-ment. הדגש לא זז.`, `We develop it every day. Development never stops.`, `דגש במקום הלא נכון.`),
  H('sh-013', 2, null, 'architecture', `AR-ki-tek-cher. ה-ch נשמע כמו k.`, `Here's the architecture, in one picture.`, `דגש והגייה של ch.`),
  H('sh-014', 2, null, 'infrastructure', `IN-fra-struk-cher. הדגש בהתחלה.`, `Our infrastructure runs in one private network.`, `מילה ארוכה שנבלעת.`),
  H('sh-015', 1, null, 'pipeline', `PIPE-line. ai ארוכה, כמו פַּייפּ.`, `The pipeline runs every night.`, `תנועה קצרה מדי.`),
  H('sh-016', 1, null, 'deploy', `di-PLOY. הדגש בסוף.`, `We deploy every Tuesday.`, `דגש בהתחלה במקום בסוף.`),
  H('sh-017', 2, null, 'data', `DAY-ta. הדגש בהתחלה.`, `The data never leaves our cloud.`, `מילה שחוזרת בכל הרצאה טכנית.`),
  H('sh-018', 3, null, 'parameters', `pa-RAM-e-ters. הדגש בהברה השנייה.`, `The function takes three parameters.`, `דגש במקום הלא נכון.`),

  // Phase 3 professional items (defined above ITEMS)
  ...PRO_ITEMS
];

// =====================================================================
// PRESENTING - coach sections
// =====================================================================
export const COACH = [
  { id: 'c-open', title_he: `איך פותחים: 30 השניות הראשונות`, body_he: `כולם כבר יודעים למה הם פה. הם רוצים לדעת למה להקשיב. אל תתחיל ב-"So, we're here to present".`,
    bullets_he: [`שאלה, מספר או סיפור קצר. אחד מהם.`, `מפה: "Three things". הקהל נרגע כשהוא יודע כמה זמן נשאר.`, `משפט אחד אמיתי: למה אכפת לך.`, `בשיחת וידאו: מצלמה פתוחה בדקה הראשונה.`],
    examples_en: [`Quick question. Who waited for a slow build this week?`, `I'll cover three things: the problem, the demo, and the cost.`] },
  { id: 'c-close', title_he: `איך מסיימים: הדקה האחרונה`, body_he: `אף פעם לא "That's it". זה נשמע כמו "נגמר לי הזמן", לא כמו סיום.`,
    bullets_he: [`שלוש נקודות: One, Two, Three.`, `משפט אחד שזוכרים.`, `בקשה: מה הם עושים מחר בבוקר.`, `"Questions?" ואז שתוק 5 שניות.`],
    examples_en: [`So, three things to remember.`, `Fast feedback should be normal, not a rare treat.`, `My ask: try it this week. Questions?`] },
  { id: 'c-qa', title_he: `שאלות מהקהל: 6 טכניקות`, body_he: `שאלות הן החלק שאנשים זוכרים. תתכונן אליהן כמו לשקף.`,
    bullets_he: [`חזור על השאלה. זה נותן לך 3 שניות, וההקלטה שומעת.`, `תשובה קודם, הסבר אחר כך.`, `ספקן: הסכם עם הדאגה, לא עם המסקנה.`, `לא יודע? תגיד יפה, ושלח תשובה באמת.`, `מחוץ לנושא: "Let's take it offline."`, `אף אחד לא שואל? שאלה שתולה משלך.`],
    examples_en: [`Alex asked if it works with our old services. Yes. Here's how.`, `That's a fair concern. Here's what we did about it.`, `A question I usually get is: what if the server dies?`] },
  { id: 'c-exec', title_he: `שכבת ההנהלה`, body_he: `מנהלים קונים החלטה, לא טכנולוגיה. שורה תחתונה קודם.`,
    bullets_he: [`כסף, זמן, סיכון. בסדר הזה.`, `מספר אחד לכל שקף.`, `סיכונים לפני שהם שואלים.`, `בקשה ברורה: מה להחליט היום.`, `גרסה של 5 דקות מוכנה תמיד.`],
    examples_en: [`I'll give you the bottom line first.`, `The decision I need today is simple.`] },
  { id: 'c-eng', title_he: `מהנדסים`, body_he: `מהנדסים לא סומכים על מי שמוכר קסם. הם סומכים על פרטים וכנות.`,
    bullets_he: [`מסלול של בקשה אחת, מקצה לקצה.`, `מגבלות ו-failure modes.`, `הדגמה חיה עם הוכחה.`, `מה זה לא יודע לעשות.`],
    examples_en: [`Here's one request, end to end.`, `Limitation: it's read-only today.`] },
  { id: 'c-sec', title_he: `קהל אבטחה`, body_he: `הם שואלים: איפה הדאטה, מי ניגש, מה נרשם. ענה לפני שהם שואלים.`,
    bullets_he: [`איפה הדאטה נמצא, ואיפה הוא לא יוצא.`, `זהות וגישה: מפתח לכל משתמש, ביטול מפתח.`, `לוגים ו-audit: מי רואה אותם.`, `אישור אדם לכל פעולה מסוכנת.`],
    examples_en: [`Short answer: the data stays in our cloud.`, `Human in the loop, always.`] },
  { id: 'c-mix', title_he: `קהל מעורב`, body_he: `סיפור לפני טכנולוגיה. כל אחד צריך להבין מה זה נותן לו.`,
    bullets_he: [`מילים פשוטות. מונח? חצי משפט הסבר.`, `הדגמה אחת, הכי ויזואלית.`, `בקשה קלה: "try it this week".`],
    examples_en: [`Imagine you need a test environment, and the answer is: wait three days.`] },
  { id: 'c-care', title_he: `איך להראות שאכפת לך (בלי למכור)`, body_he: `אנשים מאמצים כלים של אנשים, לא של שקפים.`,
    bullets_he: [`רגע אישי אחד, אמיתי. רק אם הוא נכון.`, `"I built" כשזה שלך, "we" כשזה של הצוות.`, `אל תקטין את העבודה שלך.`, `אנרגיה רק על 3 רגעים: הבעיה, ההדגמה, הבקשה.`, `תן קרדיט בשם, והצע עזרה.`],
    examples_en: [`The page is simple on purpose.`, `Ping me on Teams. I'll help you set it up in five minutes.`] },
  { id: 'c-demo', title_he: `הדגמות: איך לא להיתקע`, body_he: `2 דקות של הכנה בשקט הן נצח בשיחת וידאו. הכול פתוח מראש.`,
    bullets_he: [`לפני: מה יקרה ולאן להסתכל.`, `בזמן: משפט מוכן.`, `אחרי: "So what did we just see?"`, `תוכנית ב': הקלטה מוכנה.`],
    examples_en: [`Watch the bottom line.`, `While it runs, let me explain what's happening.`, `Let's not wait. Here's one it already finished.`] },
  { id: 'c-fail', title_he: `כשההדגמה נכשלת`, body_he: `הקהל לא זוכר שההדגמה נפלה. הוא זוכר איך הגבת.`,
    bullets_he: [`צחק, הסבר במשפט, המשך.`, `עבור להקלטה בלי להתנצל שלוש פעמים.`, `אל תנסה לתקן בשידור חי יותר מ-30 שניות.`],
    examples_en: [`Live demos. My favorite kind of incident.`, `Let me show you the recording.`] },
  { id: 'c-remote', title_he: `הרצאה מרחוק בשיחת וידאו`, body_he: `בשיחת וידאו אין שפת גוף ואין תגובה מהקהל. צריך לפצות בקול ובמבנה.`,
    bullets_he: [`מצלמה פתוחה בפתיחה ובסיום.`, `בקש תגובה בצ'אט: יד, אימוג'י, מילה.`, `שקט של דקה נשמע כמו תקלה. דבר בזמן המתנה.`, `ודא שההקלטה תופסת גם את הקהל.`],
    examples_en: [`Put a hand up in the chat.`, `Can everyone see my terminal?`] },
  { id: 'c-silence', title_he: `שתיקה היא כלי`, body_he: `שתיקה של חצי שנייה נשמעת בטוחה. "so... basically... um" נשמע לא מוכן.`,
    bullets_he: [`מרגיש so עולה? עצור.`, `אחרי משפט חשוב: שנייה שקט.`, `משפט הלך לאיבוד? "Let me say that again."`],
    examples_en: [`This is the important part. (pause)`, `Let me say that again.`] },
  { id: 'c-numbers', title_he: `מספרים`, body_he: `מספר שנאמר פעמיים נזכר. מספר בלי יחידה הוא רעש.`,
    bullets_he: [`תמיד יחידה וזמן: "[X] dollars a month".`, `לאט, ופעם שנייה.`, `הסתכל במצלמה כשאתה אומר את המספר.`, `כרטיס מספרים ליד המסך.`],
    examples_en: [`[X] dollars a month. [X].`, `Break-even is [N] users.`] },
  { id: 'c-humor', title_he: `חוקי הומור`, body_he: `צוחקים על עצמך, על המצב או על הטכנולוגיה. אף פעם לא על עמית, על הקהל או על ההנהלה.`,
    bullets_he: [`בדיחה אחת בפתיחה, אחת בהדגמה. זהו.`, `אם הבדיחה לא עבדה, המשך. אל תסביר אותה.`, `אתה מהנדס, לא סטנדאפיסט. (עדיין.)`],
    examples_en: [`No servers were harmed in the making of this demo.`] },
  { id: 'c-truth', title_he: `תווית אמת: live, planned, idea`, body_he: `מהנדסים סולחים על "planned". הם לא סולחים על "live" שהוא בעצם planned.`,
    bullets_he: [`לכל פיצ'ר מילה אחת: live, planned או idea.`, `קרא את השורה מהשקף.`, `מגבלה: משפט נפרד וברור.`],
    examples_en: [`To be clear, this is not live yet. It's planned.`, `This is an idea. We haven't tested it yet.`] },
  { id: 'c-rules', title_he: `6 כללים קצרים`, body_he: `הרבה פעמים השקפים כתובים טוב יותר מהדיבור. תן להם לעבוד.`,
    bullets_he: [`רעיון אחד לשקף. קרא את הכותרת בקול.`, `כלל השלוש.`, `בלי probably, I think, basically במשפטים חשובים.`, `סיים בזמן, עדיף דקה לפני.`, `שתי גרסאות מוכנות: 30 שניות ו-5 דקות.`, `חזרה מול אדם שישאל שאלות קשות.`],
    examples_en: [`I'll cover three things.`, `One last thing.`] }
];

export const AUDIENCES = [
  { id: 'exec', name_he: `הנהלה`, focus_he: [`שורה תחתונה קודם: כסף, זמן, סיכון.`, `מספר אחד לכל שקף: עלות קבועה, חיסכון, נקודת איזון.`, `הסיכונים לפני שהם שואלים.`, `בקשה ברורה בסוף.`, `גרסה של 5 דקות.`], skip_he: `ארכיטקטורה מפורטת, שמות של ספריות, גלילה בתפריטים.`, open_en: `I'll give you the bottom line first, in case someone pulls you into another meeting. We can cut our cloud cost by [X] percent, with no change for our users.`, joke_en: `The good news: this costs less than the coffee machine. The bad news: I haven't checked how much the coffee machine costs.` },
  { id: 'eng', name_he: `מהנדסים / DevOps`, focus_he: [`מסלול של בקשה אחת, מקצה לקצה.`, `מגבלות ו-failure modes: עומס, בקשות במקביל, HTTP 429.`, `הדגמה חיה עם הוכחה שזה באמת עובד.`, `כנות: מה המערכת לא יודעת לעשות.`, `איך מתחילים מחר, בלי כלי חדש.`], skip_he: `מצגת עסקית ארוכה, "very good user experience".`, open_en: `Quick question. Who here waited for a slow build this week? Okay. Today I'll show you how to cut that time in half, with the same tools you already use.`, joke_en: `Yes, it's a live demo. If it fails, we'll call it an incident and do a postmortem together. We're DevOps. We're good at those.` },
  { id: 'sec', name_he: `אבטחה / IT`, focus_he: [`איפה הדאטה, ואיפה הוא לא יוצא: VPN בלבד.`, `זהות וגישה: מפתח לכל משתמש, ביטול מפתח.`, `לוגים ו-audit: מי רואה אותם.`, `חיבורים לכלים חיצוניים: מה מגן עליהם.`, `אוטומציה: read-only, ואישור אדם לכל שינוי.`], skip_he: `הדגמת קוד, מחשבון עלות.`, open_en: `Let me start with what you care about: where the data goes. Short answer: nowhere. It stays in our cloud, behind the VPN.`, joke_en: `I know, a talk about AI and security. I promise, no slide says "trust me".` },
  { id: 'mix', name_he: `קהל מעורב / כל החברה`, focus_he: [`סיפור לפני טכנולוגיה.`, `מה זה נותן לכל אחד, במשפט אחד.`, `הדגמה אחת, הכי ויזואלית.`, `מילים פשוטות.`, `בקשה קלה: "try it this week".`], skip_he: `ראשי תיבות, מפרט טכני, קודי שגיאה.`, open_en: `Imagine you need a test environment, and the answer is: wait three days. That happens to us every week. Today I'll show you how we fixed it.`, joke_en: `Don't worry, there's no exam at the end. Only a small demo that may or may not work. Like all good demos.` },
  { id: 'new', name_he: `מצטרפים חדשים / קהל לא טכני`, focus_he: [`למה זה קיים, במשפט אחד.`, `איך מתחילים: שלושה צעדים.`, `למי פונים כשנתקעים.`], skip_he: `עלויות, ארכיטקטורה, מונחים בלי הסבר.`, open_en: `By the end of these ten minutes, you'll have access and your first result from the new tool.`, joke_en: `If you get lost, that's on me, not on you. I wrote the slides at night.` }
];

export const ICEBREAKERS = [
  { line_en: `Before we start, a small confession. I promised myself not to say "basically" today. If you hear it, write it in the chat.`, when_he: `פתיחה. הופך את מה שאתה מתאמן עליו לבדיחה, והקהל בצד שלך.` },
  { line_en: `Today I'll show you how to get your weekends back. Legally.`, when_he: `פתיחה, לקהל מהנדסים.` },
  { line_en: `Yes, it's a live demo. If it fails, we'll call it an incident and write a postmortem together.`, when_he: `לפני הדגמה חיה.` },
  { line_en: `It's thinking. Like me before my first coffee.`, when_he: `כשהמערכת איטית.` },
  { line_en: `This service is small, but it's ours. Like my first apartment.`, when_he: `כשמסבירים למה פתרון קטן מספיק.` },
  { line_en: `My English has an accent. My code doesn't. That's why I brought a demo.`, when_he: `פתיחה, אם זה מרגיש טבעי. הומור עצמי מוריד לחץ.` },
  { line_en: `I'll give you the bottom line first, in case someone pulls you into another meeting.`, when_he: `פתיחה מול הנהלה. מצחיק ומכבד את הזמן שלהם.` },
  { line_en: `No servers were harmed in the making of this demo.`, when_he: `אחרי שההדגמה עבדה.` },
  { line_en: `Questions? Easy ones first, please. Hard ones I'll answer by email. Next year.`, when_he: `מעבר לשאלות. אמור עם חיוך, ואז באמת ענה.` },
  { line_en: `Fun fact: the hardest part of this project wasn't the code. It was the name.`, when_he: `כשמציגים את שם הפרויקט.` },
  { line_en: `I tested this demo ten times this morning. So statistically, this is the one that fails.`, when_he: `רגע לפני הדגמה חיה.` },
  { line_en: `If you see me looking at my notes, that's not stress. That's documentation.`, when_he: `כשאתה מציץ בכרטיס המספרים.` },
  { line_en: `I'm an engineer, so I'll keep the jokes short and the logs long.`, when_he: `פתיחה, לקהל טכני.` },
  { line_en: `Live demos. My favorite kind of incident.`, when_he: `כשההדגמה נכשלת. אחר כך עוברים להקלטה.` },
  { line_en: `I promised a short talk. But I'm an engineer, and you know how good we are at time estimates.`, when_he: `פתיחה, או כשמתקרבים לסוף הזמן.` },
  { line_en: `If my video freezes, don't worry. I'm not thinking that hard. It's the network.`, when_he: `פתיחה בשיחת וידאו.` },
  { line_en: `I'll try to finish one minute early. If I don't, blame the AI. It writes my estimates now.`, when_he: `פתיחה, אחרי שהצגת את המפה.` }
];

export const BADGES = [
  { id: 'b-first-mic', title_he: `מיקרופון ראשון`, desc_he: `סיימת משימת דיבור ראשונה.`, icon: 'mic', rule: 'first_mic' },
  { id: 'b-streak-3', title_he: `שלושה ברצף`, desc_he: `3 ימי אימון ברצף.`, icon: 'flame', rule: 'streak:3' },
  { id: 'b-streak-7', title_he: `שבוע שלם`, desc_he: `7 ימי אימון ברצף.`, icon: 'flame', rule: 'streak:7' },
  { id: 'b-streak-14', title_he: `שבועיים בלי הפסקה`, desc_he: `14 ימי אימון ברצף.`, icon: 'flame', rule: 'streak:14' },
  { id: 'b-streak-30', title_he: `חודש של דיבור`, desc_he: `30 ימי אימון ברצף.`, icon: 'crown', rule: 'streak:30' },
  { id: 'b-xp-500', title_he: `500 XP`, desc_he: `צברת 500 נקודות.`, icon: 'star', rule: 'xp:500' },
  { id: 'b-xp-2000', title_he: `2,000 XP`, desc_he: `צברת 2,000 נקודות.`, icon: 'star', rule: 'xp:2000' },
  { id: 'b-xp-5000', title_he: `5,000 XP`, desc_he: `צברת 5,000 נקודות.`, icon: 'trophy', rule: 'xp:5000' },
  { id: 'b-level-5', title_he: `שלב 5`, desc_he: `הגעת לשלב 5.`, icon: 'medal', rule: 'level:5' },
  { id: 'b-level-10', title_he: `שלב 10`, desc_he: `הגעת לשלב 10.`, icon: 'medal', rule: 'level:10' },
  { id: 'b-fillerfree-1', title_he: `שתיקה של זהב`, desc_he: `משימת דיבור בלי אף מילת מילוי.`, icon: 'mute', rule: 'fillerfree:1' },
  { id: 'b-fillerfree-10', title_he: `אפס so`, desc_he: `10 משימות דיבור בלי מילות מילוי.`, icon: 'mute', rule: 'fillerfree:10' },
  { id: 'b-perfect-5', title_he: `חמש בול`, desc_he: `5 תרגילים עם ציון 100.`, icon: 'target', rule: 'perfect:5' },
  { id: 'b-grammar-20', title_he: `צייד ה-is`, desc_he: `20 תרגילי דקדוק.`, icon: 'spell-check', rule: 'cat:grammar:20' },
  { id: 'b-pronoun-15', title_he: `it, לא he`, desc_he: `15 תרגילי it ו-they.`, icon: 'user', rule: 'cat:pronoun:15' },
  { id: 'b-phrasing-20', title_he: `נשמע מקומי`, desc_he: `20 תרגילי ניסוח טבעי.`, icon: 'swap', rule: 'cat:phrasing:20' },
  { id: 'b-pron-20', title_he: `מבטא ברור`, desc_he: `20 תרגילי הגייה.`, icon: 'volume', rule: 'cat:pronunciation:20' },
  { id: 'b-boss-5', title_he: `מנצח בוסים`, desc_he: `5 משימות בוס הושלמו.`, icon: 'shield', rule: 'boss:5' },
  { id: 'b-night-owl', title_he: `ינשוף לילה`, desc_he: `אימון אחרי 22:00.`, icon: 'moon', rule: 'night_owl' },
  { id: 'b-early-bird', title_he: `ציפור מוקדמת`, desc_he: `אימון לפני 08:00.`, icon: 'sun', rule: 'early_bird' },
  { id: 'b-daily-1', title_he: `יום מלא`, desc_he: `סיימת את כל המשימות של היום.`, icon: 'check', rule: 'daily:1' },
  { id: 'b-daily-10', title_he: `עשרה ימים מלאים`, desc_he: `10 ימים עם כל המשימות.`, icon: 'calendar', rule: 'daily:10' },
  { id: 'b-calm-5', title_he: `קצב רגוע`, desc_he: `5 משימות דיבור בקצב של 110 עד 150 מילים בדקה.`, icon: 'gauge', rule: 'wpm_band:5' },
  { id: 'b-mastered-25', title_he: `25 בכיס`, desc_he: `25 תרגילים שנשלטו לגמרי.`, icon: 'brain', rule: 'mastered:25' }
];

export const LEVEL_TITLES_HE = [
  `מחמם מנועים`,
  `מחפש מילים`,
  `צייד ה-is`,
  `מאלף מילות מילוי`,
  `מדבר בלי so`,
  `מסביר כמו README טוב`,
  `מדגים בלי להתפלל`,
  `לא נבהל משאלות`,
  `אלוף המעברים`,
  `הקול של הצוות`,
  `מרצה עם uptime מלא`,
  `כוכב ה-keynote`
];

// =====================================================================
// TRACKS - skill paths (Duolingo-style). Units go from easy to hard.
// bossId is always a speak, qa or recall item. Every id exists in ITEMS.
// =====================================================================
const unit = (id, title_he, goal_he, itemIds, bossId) => ({ id, title_he, goal_he, itemIds, bossId });

export const TRACKS = [
  { id: 't-status', title_he: `סטטוס כמו מקצוען`, title_en: 'Status like a pro', desc_he: `סטנדאפ, עדכון שבועי וסטטוס להנהלה. קצר, ברור, עם בקשה.`, icon: 'clock', color: '#6C3BF5', units: [
    unit('status-1', `המילים של הסטטוס`, `in progress, on track, by Thursday.`, ['st-002', 'st-007', 'st-004', 'st-008', 'st-013', 'st-016'], 'st-028'),
    unit('status-2', `סטנדאפ ב-30 שניות`, `אתמול, היום, חסימות. בלי מילוי.`, ['st-001', 'st-005', 'st-006', 'st-012', 'st-019'], 'st-022'),
    unit('status-3', `חסום, מאחר, מחליק`, `לדווח על בעיה עם סיבה וצעד הבא.`, ['st-003', 'st-011', 'st-014', 'st-021', 'st-026'], 'st-027'),
    unit('status-4', `עדכון שבועי`, `מצב, מה נעשה, מה הלאה, סיכון.`, ['st-009', 'st-015', 'st-018', 'st-020', 'st-023', 'st-029'], 'st-033'),
    unit('status-5', `סטטוס להנהלה`, `צבע, סיכון ובקשה. גם "לא יודע עדיין".`, ['st-010', 'st-017', 'st-024', 'st-025', 'st-030', 'st-032'], 'st-031')
  ] },
  { id: 't-incident', title_he: `הקול בזמן תקלה`, title_en: 'Incident voice', desc_he: `גשר תקלה, הודעות ללקוחות ופוסטמורטם בלי אשמה.`, icon: 'bolt', color: '#F04438', units: [
    unit('incident-1', `down, rollback, investigating`, `המילים הבסיסיות של תקלה.`, ['in-001', 'in-002', 'in-003', 'in-004', 'in-010', 'in-018'], 'in-027'),
    unit('incident-2', `עדכון בגשר`, `השפעה, פעולה, עדכון הבא.`, ['in-008', 'in-009', 'in-014', 'in-017', 'in-019'], 'in-021'),
    unit('incident-3', `לנהל את הגשר`, `לפתוח, לחלק תפקידים, לסגור.`, ['in-005', 'in-011', 'in-012', 'in-021', 'in-026'], 'in-022'),
    unit('incident-4', `מול לקוחות`, `טון רגוע, בלי פרטים פנימיים.`, ['in-012', 'in-015', 'in-019', 'in-028', 'in-011'], 'in-023'),
    unit('incident-5', `פוסטמורטם בלי אשמה`, `טריגר, סיבת שורש, משימות.`, ['in-006', 'in-007', 'in-013', 'in-016', 'in-020', 'in-029'], 'in-024'),
    unit('incident-6', `שאלות קשות אחרי תקלה`, `לענות בלי להתגונן ובלי להאשים.`, ['in-025', 'in-030', 'in-031', 'in-013', 'in-016'], 'in-032')
  ] },
  { id: 't-systems', title_he: `להציג מערכת`, title_en: 'Present a system', desc_he: `ארכיטקטורה, מסלול של בקשה, פשרות, סקייל וכשלים.`, icon: 'wrench', color: '#0EA5E9', units: [
    unit('systems-1', `מילים של ארכיטקטורה`, `responsible for, single point of failure.`, ['sy-001', 'sy-004', 'sy-007', 'sy-008', 'sy-011', 'sy-014'], 'sy-026'),
    unit('systems-2', `מסלול של בקשה`, `first, then, finally.`, ['sy-003', 'sy-010', 'sy-012', 'sy-018', 'sy-019'], 'sy-020'),
    unit('systems-3', `שקף עם דיאגרמה`, `להוביל את העין של הקהל.`, ['sy-016', 'sy-019', 'sy-026', 'sy-003', 'sy-015'], 'sy-024'),
    unit('systems-4', `למה X ולא Y`, `בחירה, סיבה ופשרה.`, ['sy-002', 'sy-006', 'sy-009', 'sy-013', 'sy-017', 'sy-027'], 'sy-021'),
    unit('systems-5', `סקייל וכשלים`, `מה קורה כשמשהו נופל.`, ['sy-005', 'sy-014', 'sy-015', 'sy-023', 'sy-030'], 'sy-022'),
    unit('systems-6', `מערכת שלמה, ושאלות`, `תמונה גדולה בדקה, ואז שאלות קשות.`, ['sy-025', 'sy-028', 'sy-029', 'sy-031', 'sy-017'], 'sy-032')
  ] },
  { id: 't-meetings', title_he: `פגישות שעובדות`, title_en: 'Meetings that work', desc_he: `להסכים, לא להסכים, להתפרץ, להבהיר ולסגור עם החלטה.`, icon: 'users', color: '#22C55E', units: [
    unit('meetings-1', `הבסיס`, `I agree, sorry to interrupt, what do you think.`, ['mt-001', 'mt-002', 'mt-003', 'mt-007', 'mt-010', 'mt-016'], 'mt-027'),
    unit('meetings-2', `להתפרץ ולהבהיר`, `להיכנס לשיחה ולשאול בדיוק מה לא ברור.`, ['mt-006', 'mt-013', 'mt-015', 'mt-020', 'mt-003'], 'mt-026'),
    unit('meetings-3', `לא להסכים בנימוס`, `הכרה, דאגה, הצעה.`, ['mt-005', 'mt-017', 'mt-029', 'mt-010', 'mt-019'], 'mt-021'),
    unit('meetings-4', `דחיפה חזרה`, `לא בלי חלופה.`, ['mt-012', 'mt-018', 'mt-019', 'mt-030', 'mt-032'], 'mt-022'),
    unit('meetings-5', `לנהל פגישה`, `זמן, מטרה, אג'נדה, החלטה.`, ['mt-004', 'mt-008', 'mt-011', 'mt-014', 'mt-025', 'mt-031'], 'mt-023'),
    unit('meetings-6', `לסכם ולסגור`, `החלטה, משימות, בעלים.`, ['mt-008', 'mt-009', 'mt-028', 'mt-023', 'mt-011'], 'mt-024')
  ] },
  { id: 't-numbers', title_he: `מספרים בקול`, title_en: 'Numbers out loud', desc_he: `מספרים גדולים, אחוזים, תאריכים, מגמות ו-p95.`, icon: 'chart', color: '#FFB020', units: [
    unit('numbers-1', `לקרוא מספרים`, `thousand, million, point, fifteen מול fifty.`, ['nu-003', 'nu-006', 'nu-008', 'nu-020', 'nu-021', 'nu-024'], 'nu-030'),
    unit('numbers-2', `אחוזים והשוואות`, `up by, lower than, twice as.`, ['nu-002', 'nu-007', 'nu-009', 'nu-016', 'nu-019'], 'nu-028'),
    unit('numbers-3', `תאריכים וטווחים`, `on March 5th, between X and Y.`, ['nu-004', 'nu-005', 'nu-011', 'nu-014', 'nu-017'], 'nu-029'),
    unit('numbers-4', `מגמות בגרף`, `spiked, dropped, plateaued.`, ['nu-012', 'nu-013', 'nu-031', 'nu-007', 'nu-016'], 'nu-025'),
    unit('numbers-5', `זמני תגובה`, `p95, p99, milliseconds.`, ['nu-001', 'nu-015', 'nu-018', 'nu-022', 'nu-023'], 'nu-026'),
    unit('numbers-6', `כסף ומשמעות`, `סכום, ליחידה, והשוואה.`, ['nu-010', 'nu-019', 'nu-014', 'nu-009', 'nu-032'], 'nu-027')
  ] },
  { id: 't-vocab', title_he: `אוצר מילים טכני`, title_en: 'Tech vocabulary', desc_he: `roll out, spin up, phase out, throttle. בלי "do a deploy".`, icon: 'book', color: '#5A2BE0', units: [
    unit('vocab-1', `בלי do a`, `פועל אחד במקום do + שם עצם.`, ['vo-001', 'vo-002', 'vo-010', 'vo-015', 'vo-018', 'vo-023'], 'vo-024'),
    unit('vocab-2', `להרים ולפרק`, `spin up, tear down.`, ['vo-004', 'vo-005', 'vo-020', 'vo-021', 'vo-029'], 'vo-025'),
    unit('vocab-3', `להוציא משימוש`, `deprecate, phase out, mitigate.`, ['vo-006', 'vo-009', 'vo-017', 'vo-030', 'vo-031'], 'vo-026'),
    unit('vocab-4', `עומס ועמידות`, `throttle, back off, fail over.`, ['vo-007', 'vo-012', 'vo-014', 'vo-016', 'vo-031'], 'vo-027'),
    unit('vocab-5', `צוות ותהליכים`, `onboard, raise a ticket, run a postmortem.`, ['vo-003', 'vo-008', 'vo-011', 'vo-013', 'vo-019', 'vo-022'], 'vo-028'),
    unit('vocab-6', `הכל ביחד`, `להסביר מונחים בבהירות.`, ['vo-002', 'vo-012', 'vo-020', 'vo-021', 'vo-024'], 'vo-032')
  ] },
  { id: 't-stress', title_he: `להישמע טבעי: דגש`, title_en: 'Sound native: stress', desc_he: `דגש במילה ואינטונציה במשפט. RE-cord מול re-CORD.`, icon: 'wave', color: '#FF7A1A', units: [
    unit('stress-1', `שם עצם מול פועל`, `record, increase, progress, update.`, ['ws-001', 'ws-003', 'ws-008', 'ws-009', 'ws-030'], 'ws-033'),
    unit('stress-2', `עוד זוגות`, `present, decrease, content, object.`, ['ws-002', 'ws-004', 'ws-005', 'ws-006', 'ws-007', 'ws-010'], 'ws-034'),
    unit('stress-3', `דגש שזז`, `analysis, technology, availability.`, ['ws-012', 'ws-013', 'ws-014', 'ws-015', 'ws-016', 'ws-029', 'ws-031'], 'ws-038'),
    unit('stress-4', `מילים טכניות`, `Kubernetes, Linux, cache, queue.`, ['ws-011', 'ws-017', 'ws-018', 'ws-019', 'ws-020', 'ws-021', 'ws-022'], 'ws-039'),
    unit('stress-5', `אינטונציה`, `שאלה עולה, תשובה יורדת.`, ['ws-023', 'ws-024', 'ws-025', 'ws-026', 'ws-032'], 'ws-035'),
    unit('stress-6', `דגש של משמעות`, `ניגוד והדגשה.`, ['ws-024', 'ws-026', 'ws-027', 'ws-028', 'ws-036'], 'ws-037')
  ] },
  { id: 't-interview', title_he: `לדבר על ההשפעה שלך`, title_en: 'Talk about your impact', desc_he: `תפקיד, השפעה במספרים, סיפורי STAR וכישלון שלמדת ממנו.`, icon: 'star', color: '#1B1530', units: [
    unit('interview-1', `לדבר על התפקיד`, `for five years, responsible for, in my last role.`, ['iv-001', 'iv-002', 'iv-010', 'iv-013', 'iv-014'], 'iv-024'),
    unit('interview-2', `השפעה במספרים`, `I cut, by [X] percent, which means.`, ['iv-003', 'iv-005', 'iv-007', 'iv-011', 'iv-016'], 'iv-019'),
    unit('interview-3', `לקחת קרדיט`, `מה אתה עשית, בלי יהירות.`, ['iv-004', 'iv-006', 'iv-008', 'iv-012', 'iv-018'], 'iv-022'),
    unit('interview-4', `סיפור STAR`, `מצב, משימה, פעולה, תוצאה.`, ['iv-003', 'iv-006', 'iv-015', 'iv-016', 'iv-025'], 'iv-020'),
    unit('interview-5', `כישלון וקונפליקט`, `כנות ולמידה.`, ['iv-006', 'iv-009', 'iv-017', 'iv-023', 'iv-027'], 'iv-021'),
    unit('interview-6', `סוף הראיון`, `למה עוזבים, 90 יום, שאלות למראיין.`, ['iv-010', 'iv-017', 'iv-026', 'iv-028', 'iv-029'], 'iv-030')
  ] },
  { id: 't-smalltalk', title_he: `שיחת חולין`, title_en: 'Small talk', desc_he: `פתיחה לפני פגישה, סוף שבוע, מזג אוויר וסיום נעים.`, icon: 'smile', color: '#F5A524', units: [
    unit('smalltalk-1', `פתיחה קלילה`, `how are you doing, can you hear me.`, ['sm-001', 'sm-010', 'sm-011', 'sm-015', 'sm-031'], 'sm-025'),
    unit('smalltalk-2', `סוף שבוע`, `לענות עם פרט אחד ולשאול חזרה.`, ['sm-002', 'sm-008', 'sm-017', 'sm-027', 'sm-030', 'sm-019'], 'sm-020'),
    unit('smalltalk-3', `מקום ומזג אוויר`, `based in, isn't it, where you are.`, ['sm-003', 'sm-005', 'sm-006', 'sm-018', 'sm-021'], 'sm-024'),
    unit('smalltalk-4', `מה לא שואלים`, `נושאים בטוחים עם כל אחד.`, ['sm-009', 'sm-012', 'sm-013', 'sm-016', 'sm-022', 'sm-029'], 'sm-028'),
    unit('smalltalk-5', `סיום מנומס`, `talk soon, have a good one.`, ['sm-004', 'sm-007', 'sm-014', 'sm-026', 'sm-032'], 'sm-023')
  ] },
  { id: 't-stage', title_he: `נוכחות על הבמה`, title_en: 'Stage presence', desc_he: `בלי מילות מילוי, פתיחה וסיום חזקים, הדגמות ושאלות מהקהל.`, icon: 'mic', color: '#8A84A3', units: [
    unit('stage-1', `שתיקה במקום so`, `לעצור במקום למלא.`, ['f-001', 'f-002', 'f-003', 'f-006', 'f-009'], 'f-004'),
    unit('stage-2', `פתיחה וסיום`, `שאלה, מפה, ומשפט סיום.`, ['r-001', 'r-002', 'r-004', 'r-007', 's-016'], 's-001'),
    unit('stage-3', `הדגמה בלי להיבהל`, `לדבר בזמן שהמסך רץ, גם כשמשהו נכשל.`, ['r-003', 'r-005', 'r-010', 'f-008', 'r-004'], 's-009'),
    unit('stage-4', `שאלות מהקהל`, `תשובה קודם, הסבר אחר כך.`, ['r-008', 'r-009', 's-013', 'q-008', 'q-013', 'q-017'], 'q-014'),
    unit('stage-5', `מול הנהלה`, `קצר, מספרים, בקשה.`, ['r-006', 's-010', 'f-007', 'q-001', 'q-010'], 's-011'),
    unit('stage-6', `דקה שלמה בלי מילוי`, `שליטה מלאה בקצב ובשקט.`, ['f-011', 's-012', 's-014', 'q-016', 'r-012'], 'f-010')
  ] }
];
