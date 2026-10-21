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
  { id: 'pronunciation', label_he: `הגייה`, label_en: 'Pronunciation', icon: 'volume', color: '#FFB020', desc_he: `מילים שהתמלול שמע לא נכון. חזור אחרי.` },
  { id: 'presenting', label_he: `איך להציג`, label_en: 'Presenting', icon: 'presentation', color: '#8A84A3', desc_he: `טכניקה: פתיחה, סיום, שאלות, קהל והדגמות.` }
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

const BE = `שמטת is/are. בעברית אין "להיות" בהווה.`;
const AGR = `התאמה בין נושא לפועל: יחיד או רבים.`;
const ART = `a/the: ה' הידיעה העברית לא עוברת לאנגלית.`;
const QWO = `סדר מילים בשאלה: הפועל לפני הנושא.`;
const ONE = `טעות חד-פעמית שנשמעת לא מקצועית.`;
const PRO = `he על מודל או משתמש. בעברית לכל דבר יש מין.`;
const CAL = `תרגום ישיר מעברית שנשמע זר.`;
const WEAK = `ניסוח שמחליש אותך ואת העבודה שלך.`;
const ALL = FILLERS;

export const ITEMS = [
  // =====================================================================
  // GRAMMAR - type 'fix'
  // =====================================================================
  // be-drop: from the talk
  G('g-001', 1, '04:49', `Well, when we gonna add some users,`, `When we add more users,`, `אין "we gonna". או "we're going to", או פשוט הווה.`, BE),
  G('g-002', 1, '04:56', `so he gonna fully consume the GPU as per his requests.`, `They're going to use the full GPU.`, `חסר is/are לפני gonna. ובמקום he: they.`, BE),
  G('g-003', 1, '05:03', `we can see that both of them sharing the same GPU,`, `You can see that they are both sharing the same GPU.`, `ing צריך is/are לפניו.`, BE),
  G('g-004', 1, '04:41', `if he is the only user that using the GPU machine,`, `If they're the only user who is using the GPU,`, `that/who + ing = that is / who is.`, BE),
  G('g-005', 1, '02:39', `fixing stuff that not working so well`, `fixing things that are not working well`, `that + not + ing = that are not.`, BE),
  G('g-006', 1, '14:43', `the names of the engineers that working on`, `the names of the engineers who are working on it`, `אנשים: who are.`, BE),
  G('g-007', 1, '16:02', `the automation that using the gpu`, `the automations that are using the GPU`, `that + ing = that are.`, BE),
  G('g-008', 2, '16:24', `some gonna use uh two 200k`, `and some will use 200K tokens.`, `"will" קצר וברור.`, BE),
  G('g-009', 1, '20:26', `how we gonna perform actual actions`, `how we are going to take real actions`, `we + are + going to.`, BE),
  G('g-010', 1, '06:28', `here we have a brain that connected`, `Here we have a brain that is connected.`, `that + is.`, BE),
  G('g-011', 1, '24:56', `here we also managing user`, `Here we also manage users.`, `הווה פשוט: we manage.`, BE),
  G('g-012', 1, '25:27', `that currently consuming the local llm`, `that is currently using the local LLM`, `that + is + ing.`, BE),
  G('g-013', 2, '27:05', `the user that not used to work with`, `users who are not used to working with`, `who are, ו-used to + ing.`, BE),
  G('g-014', 1, '19:09', `the events that happening here out there`, `the events that are happening out there`, `that + are + ing.`, BE),
  G('g-015', 1, '05:02', `While we gonna add some more users,`, `When we add more users,`, `when + הווה פשוט. בלי gonna.`, BE),
  G('g-016', 2, '05:53', `each and every user that we can see here uh that allowed to access`, `every user who is allowed to access the system`, `who + is + allowed.`, BE),
  G('g-017', 2, '16:17', `there be users that using [N] million`, `Some users will use [N] million tokens.`, `"there be" לא קיים. some users will use.`, BE),
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
  G('g-030', 1, '06:42', `it's make all the connections`, `It makes all the connections.`, `it + פועל + s. בלי "it's".`, AGR),
  G('g-031', 2, '17:55', `an actual automation that i built that are consuming our local model`, `an automation I built that uses our local model`, `automation = יחיד: uses.`, AGR),
  G('g-032', 2, '03:24', `the pros of this solution is that is in-house`, `The main advantage is that it's in-house.`, `pros = רבים. ו-"that it's", לא "that is".`, AGR),
  G('g-033', 1, '20:42', `urgent bugs that needs to be taken care of`, `urgent bugs that need to be fixed now`, `bugs = רבים: need.`, AGR),
  G('g-034', 2, '23:27', `why there is facts that are going through verification`, `That's why there are facts that go through verification.`, `facts = רבים: there are.`, AGR),
  G('g-035', 2, '24:05', `this pr is already has been merged`, `This PR has already been merged.`, `רק has, בלי is.`, AGR),
  G('g-036', 2, '25:11', `for example she send this it's refused`, `She sent this, and it was refused.`, `עבר: sent, was.`, AGR),
  G('g-037', 1, '04:37', `Each user getting is their own limitations,`, `Each user gets their own limits.`, `each user = יחיד: gets.`, AGR),
  G('g-038', 1, '04:26', `the GPU host that are working through this chain`, `the GPU host that is part of this chain`, `host = יחיד: that is.`, AGR),
  G('g-039', 1, null, `Each team have its own key.`, `Each team has its own key.`, `each = יחיד: has.`, AGR),
  G('g-040', 1, null, `The agent check Git first.`, `The agent checks Git first.`, `he/she/it + s.`, AGR),
  G('g-041', 1, null, `There is three steps.`, `There are three steps.`, `רבים: there are.`, AGR),
  G('g-042', 1, null, `Every request are logged.`, `Every request is logged.`, `every = יחיד: is.`, AGR),
  G('g-043', 2, null, `The number of errors are growing.`, `The number of errors is growing.`, `הנושא הוא number, יחיד: is.`, AGR),
  // articles
  G('g-044', 1, '01:41', `so today the pain is the your organization is the um`, `Here's the pain in our organization today.`, `בלי "the" לפני your.`, ART),
  G('g-045', 1, '02:52', `we want the people to enjoy the work`, `We want people to enjoy their work.`, `אנשים באופן כללי: בלי the.`, ART),
  G('g-046', 1, '04:14', `shown eventually in the Grafana.`, `shown in Grafana.`, `שם של מוצר: בלי the.`, ART),
  G('g-047', 1, '06:28', `it's a employee called Alex`, `an employee called Alex`, `לפני תנועה: an.`, ART),
  G('g-048', 1, '13:06', `all we need is bigger gpu machine or whatever`, `All we need is a bigger GPU machine.`, `חסר a. ובלי whatever.`, ART),
  G('g-049', 2, '13:29', `it's a separate from my own cloud`, `It's separate from my own Claude Code.`, `separate הוא תואר: בלי a.`, ART),
  G('g-050', 2, '06:42', `it's not a human readable so much`, `It's not very human-readable.`, `תואר בלי a. ו-very במקום so much.`, ART),
  G('g-051', 1, null, `I sent you a email.`, `I sent you an email.`, `לפני תנועה: an.`, ART),
  G('g-052', 1, null, `It runs on the Kubernetes.`, `It runs on Kubernetes.`, `שם של מוצר: בלי the.`, ART),
  G('g-053', 1, null, `We have meeting tomorrow.`, `We have a meeting tomorrow.`, `שם עצם יחיד צריך a.`, ART),
  // question word order
  G('g-054', 1, '15:29', `how much it's going to cost us`, `How much is it going to cost us?`, `בשאלה: is לפני it.`, QWO),
  G('g-055', 1, null, `What it does exactly?`, `What does it do exactly?`, `does + it + do.`, QWO),
  G('g-056', 1, null, `Why this is slow?`, `Why is this slow?`, `is לפני this.`, QWO),
  G('g-057', 1, null, `Where we store the logs?`, `Where do we store the logs?`, `do + we.`, QWO),
  G('g-058', 2, null, `Can you tell me what is the problem?`, `Can you tell me what the problem is?`, `שאלה בתוך משפט: סדר רגיל, is בסוף.`, QWO),
  // one-offs
  G('g-059', 2, '07:50', `the UI itself is a lack of like feature and stuff to do`, `The UI is still basic.`, `משפט קצר במקום משפט שהולך לאיבוד.`, ONE),
  G('g-060', 1, '26:37', `it's a pre-playground`, `It's a playground.`, `מילה שלא קיימת. פשוט playground.`, ONE),
  G('g-061', 2, '27:52', `We don't own it to anyone`, `We don't depend on any vendor.`, `לא ביטוי באנגלית. depend on any vendor.`, ONE),
  G('g-062', 2, '11:39', `this is a bit slower than we used to with the antropics`, `It's a bit slower than what we're used to with Anthropic.`, `we're used to, ו-Anthropic בלי s.`, ONE),

  // =====================================================================
  // PRONOUN - type 'fix'
  // =====================================================================
  P('p-001', 1, '12:01', `so here i ask him what does the project contain`, `So here I ask it what the project contains.`, `מודל = it. ובשאלה עקיפה: what the project contains.`, PRO),
  P('p-002', 1, '12:20', `fix apply he fixed something`, `Fix applied. It fixed the bug.`, `it, ולהגיד מה בדיוק תוקן.`, PRO),
  P('p-003', 1, '12:45', `you can see that he changed line six whatever`, `You can see it remembers: it changed line six.`, `it, ובלי whatever.`, PRO),
  P('p-004', 1, '23:01', `let's give him another ticket`, `Let's give it another ticket.`, `agent = it.`, PRO),
  P('p-005', 2, '23:08', `because again he's connecting to git he's doing his investigation`, `It's connecting to Git and doing its investigation.`, `its, לא his.`, PRO),
  P('p-006', 2, '24:50', `we need to approve uh whatever he's doing`, `We need to approve everything it does.`, `it, ו-everything במקום whatever.`, PRO),
  P('p-007', 2, '18:31', `whatever you configure this agent to do he will do`, `The agent does what you configure it to do.`, `agent = it.`, PRO),
  P('p-008', 2, '02:03', `so he needs to ask a special approval to increase this.`, `They need to ask for approval to increase it.`, `משתמש כללי = they. ו-ask for.`, PRO),
  P('p-009', 2, '06:01', `can generate his own key then use it paired the ide that he's using`, `can generate their own key and use it in their IDE.`, `their, ו-in their IDE.`, PRO),
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
  C('ph-001', 1, '02:03', `ask a special approval`, [`ask for special approval`, `ask special approval`, `request for a special approval`], 0, `ask for = לבקש.`, CAL),
  C('ph-002', 1, '01:49', `we can call it that way`, [`we can call it that way`, `let's call it token starvation`, `we call it like that way`], 1, `"that way" לא טבעי כאן.`, CAL),
  C('ph-003', 1, '02:35', `we're asking for increments every while in there`, [`every while in there`, `each while`, `every now and then`], 2, `כל כמה זמן = every now and then.`, CAL),
  C('ph-004', 2, '12:52', `we're not expecting of it to be like very aggressive`, [`we don't expect it to be`, `we're not expecting of it to be`, `we don't expect from it to be`], 0, `expect + it + to. בלי of / from.`, CAL),
  C('ph-005', 1, '19:37', `very good user experience from our opinion`, [`from our opinion`, `in our opinion`, `by our opinion`], 1, `in my opinion, in our opinion.`, CAL),
  C('ph-006', 2, '20:17', `if tomorrow um different new need is born`, [`a new need is born`, `a new need is opening`, `a new need comes up`], 2, `נולד צורך = a need comes up.`, CAL),
  C('ph-007', 2, '23:01', `another ticket that already have been chewed`, [`that was already handled`, `already been chewed`, `that already was eaten`], 0, `"לעוס" לא עובר לאנגלית.`, CAL),
  C('ph-008', 1, '15:54', `it's uh worth to maintain this kind of uh machine`, [`worth to maintain`, `worth maintaining`, `worth for maintaining`], 1, `worth + ing.`, CAL),
  C('ph-009', 1, '26:48', `in matter of security`, [`in matter of security`, `in security matter`, `in terms of security`], 2, `in terms of = בהקשר של.`, CAL),
  C('ph-010', 1, '07:35', `you can use it whatever you want`, [`use it however you want`, `use it whatever you want`, `use it what you want`], 0, `however = בכל דרך.`, CAL),
  C('ph-011', 2, '04:45', `he will get the most effect of the machine`, [`the most effect of the machine`, `the most out of the machine`, `the most from the machine effect`], 1, `ביטוי קבוע: get the most out of.`, CAL),
  C('ph-012', 1, '19:15', `it can be more smarter`, [`more smarter`, `more smart`, `smarter`], 2, `smart הוא קצר: smarter, בלי more.`, CAL),
  C('ph-013', 1, '03:21', `now we're gonna show how this is working off`, [`how this works`, `how this is working off`, `how this is working out of`], 0, `פשוט: how this works.`, CAL),
  C('ph-014', 1, '23:08', `it's taking a lot of a bit time`, [`a lot of a bit time`, `a bit of time`, `a bit lot of time`], 1, `a bit of time.`, CAL),
  C('ph-015', 2, '02:18', `it's not the best practice working as an SRE or DevOps engineer in this method.`, [`in this method`, `by this method way`, `this way`], 2, `בשיטה הזו = this way.`, CAL),
  C('ph-016', 2, '15:07', `to make more efficiency and and to more productivity`, [`to make us more efficient and productive`, `to make more efficiency`, `to do more efficiency`], 0, `make + us + תואר.`, CAL),
  C('ph-017', 2, '20:10', `pair our needs`, [`pair our needs`, `based on our needs`, `by our needs`], 1, `לפי = based on, או per.`, CAL),
  C('ph-018', 2, '01:51', `a [X] limit budget for the cloud`, [`a [X] limit budget for the cloud`, `a [X] budget limit of month`, `a budget of [X] dollars a month for Claude`], 2, `מספר עם יחידה וזמן: dollars a month.`, CAL),
  C('ph-019', 2, '26:57', `probably we already said that`, [`As I said earlier,`, `probably we already said that`, `Like we said before probably,`], 0, `As I said earlier: בלי probably.`, WEAK),
  C('ph-020', 2, '07:41', `it's not so impressive`, [`It's not so impressive.`, `The page is simple on purpose.`, `It's nothing special, whatever.`], 1, `אל תקטין את העבודה שלך.`, WEAK),
  C('ph-021', 2, '12:13', `i hope less no it's gonna take less`, [`I hope less, no, it takes less.`, `It will take, I hope, less.`, `This takes about a minute.`], 2, `משפט אחד בטוח במקום לחשוב בקול.`, WEAK),
  C('ph-022', 3, '22:29', `this person is not effective or anything else`, [`The on-call engineer can't do anything else that day.`, `This person is not effective.`, `This person does nothing else.`], 0, `מדברים על המצב, לא על האדם.`, WEAK),
  C('ph-023', 1, null, `I have a question to you.`, [`I have a question to you.`, `I have a question for you.`, `I have to you a question.`], 1, `question for you.`, CAL),
  C('ph-024', 1, null, `Can you explain me how it works?`, [`Can you explain me how it works?`, `Can you explain to me how it works?`, `Can you explain me how does it work?`], 1, `explain to me, או explain how it works.`, CAL),
  C('ph-025', 1, null, `We did a mistake in the config.`, [`We made a mistake in the config.`, `We did a mistake in the config.`, `We did mistake in the config.`], 0, `make a mistake, לא do.`, CAL),
  C('ph-026', 1, null, `I'm agree with you.`, [`I'm agree with you.`, `I am agreeing with you.`, `I agree with you.`], 2, `agree הוא פועל: I agree.`, CAL),
  C('ph-027', 1, null, `Let's discuss about the cost.`, [`Let's discuss about the cost.`, `Let's discuss the cost.`, `Let's discuss on the cost.`], 1, `discuss בלי about.`, CAL),
  C('ph-028', 1, null, `It depends in the load.`, [`It depends on the load.`, `It depends in the load.`, `It's depend of the load.`], 0, `depends on.`, CAL),
  C('ph-029', 2, null, `I work here three years.`, [`I work here three years.`, `I'm working here since three years.`, `I've been working here for three years.`], 2, `עד עכשיו: have been + ing + for.`, CAL),
  C('ph-030', 1, null, `How it called in English?`, [`What's it called in English?`, `How it called in English?`, `How is it call in English?`], 0, `What's it called? לא how.`, CAL),
  C('ph-031', 1, null, `In the end of the day, it's cheaper.`, [`In the end of the day, it's cheaper.`, `At the end of the day, it's cheaper.`, `On the end of the day, it's cheaper.`], 1, `ביטוי קבוע: at the end of the day.`, CAL),
  C('ph-032', 1, null, `Until now we have two GPUs.`, [`Until now we have two GPUs.`, `Till now we are having two GPUs.`, `So far, we have two GPUs.`], 2, `עד עכשיו = so far.`, CAL),
  C('ph-033', 1, null, `Close the server before you leave.`, [`Shut down the server before you leave.`, `Close the server before you leave.`, `Turn the server closed before you leave.`], 0, `שרת ומחשב: shut down, turn off.`, CAL),
  C('ph-034', 1, null, `I will return back to this slide.`, [`I will return back to this slide.`, `I'll come back to this slide.`, `I'll return back again to this slide.`], 1, `return כבר אומר back.`, CAL),
  C('ph-035', 2, null, `We arrived to a decision.`, [`We arrived to a decision.`, `We came to decision.`, `We reached a decision.`], 2, `reach a decision.`, CAL),
  C('ph-036', 1, null, `This solution is more cheap.`, [`This solution is cheaper.`, `This solution is more cheap.`, `This solution is more cheaper.`], 0, `מילה קצרה: cheaper.`, CAL),

  // =====================================================================
  // FILLERS - type 'speak' (train silence instead of fillers)
  // =====================================================================
  F('f-001', 1, null, { title_he: `שתיקה במקום so`, prompt_en: `Tell me what you did at work yesterday. 30 seconds. Every time you want to say "so", stop for half a second instead.`, seconds: 30, must: [], banned: ['so', 'um', 'uh'], model_en: `Yesterday I worked on the deploy pipeline. A test was failing every night. I found the cause. It was an old config file. I fixed it and wrote a short note for the team.`, why_he: `so כמעט בכל מעבר. כ-4 פעמים בדקה.` }),
  F('f-002', 1, null, { title_he: `בלי basically`, prompt_en: `Explain what a load balancer does. 30 seconds. No "basically". Start with the answer.`, seconds: 30, must: ['traffic', 'servers'], banned: ['basically', 'actually', 'like'], model_en: `A load balancer spreads traffic across servers. Users talk to one address. Behind it, many servers share the work. If one server fails, the others keep going.`, why_he: `basically לא מוסיף משמעות. כמו "בעצם".` }),
  F('f-003', 1, '13:06', { title_he: `לסיים רשימה בלי whatever`, prompt_en: `Name three tools you use every day, and say why in one sentence each. End the list with a full stop.`, seconds: 30, must: [], banned: ['whatever', 'or something', 'stuff'], model_en: `I use three tools every day. Git, to track every change. Grafana, to see what's happening. And Claude Code, to move faster on small tasks. That's my day.`, bad: `all we need is bigger gpu machine or whatever`, why_he: `whatever נשמע כמו "לא אכפת לי".` }),
  F('f-004', 2, null, { title_he: `בלי like`, prompt_en: `Describe a typical on-call week. 45 seconds. No "like", no "you know".`, seconds: 45, must: ['alerts'], banned: ['like', 'you know', 'um', 'uh'], model_en: `On-call week starts on Monday. I watch the alerts and the support queue. Most alerts are small. Once or twice a week, something real breaks. Then I fix it, and I write a short summary for the team.`, why_he: `like כמו "כאילו". מוריד ביטחון.` }),
  F('f-005', 2, '16:09', { title_he: `מספר בלי let's say`, prompt_en: `Give a short cost example with placeholders: "[X] dollars a month", "[N] users". No "let's say" before a number.`, seconds: 30, must: ['a month'], banned: ['let\'s say', 'probably', 'I think', 'basically'], model_en: `The host costs [X] dollars a month. Fixed. With [N] users, a paid API would cost about [Y] dollars a month. So we save the difference.`, bad: `but basically this is the break even okay this is the most logical i think average`, why_he: `let's say ו-I think לפני מספר נשמעים כמו ניחוש.` }),
  F('f-006', 2, null, { title_he: `בלי again`, prompt_en: `Explain why monitoring matters. 30 seconds. Say "again" only if you really said it before.`, seconds: 30, must: ['before users'], banned: ['again', 'so', 'basically'], model_en: `Monitoring tells you about a problem before users do. Without it, you learn from a complaint. With it, you see the problem first. And you fix it faster.`, why_he: `again כשלא אמרת את זה קודם. 14 פעמים בהרצאה.` }),
  F('f-007', 2, null, { title_he: `טענה חזקה, בלי מחלישים`, prompt_en: `Make one strong claim about a project you built. Three short sentences. No "probably", no "I think".`, seconds: 20, must: [], banned: ['probably', 'I think', 'basically', 'kind of', 'maybe'], model_en: `It works. It runs every hour, on real tickets. And it saves the on-call engineer real time.`, why_he: `probably ו-I think מחלישים את הטענות שלך.` }),
  F('f-008', 2, '12:07', { title_he: `הדגמה רצה, ואתה מדבר`, prompt_en: `A command is running on screen. Talk for 20 seconds about what it does. No "um", no "okay so".`, seconds: 20, must: ['while it runs'], banned: ['um', 'uh', 'so', 'okay'], model_en: `While it runs, here's what's happening. It reads the project. It finds the failing test. Then it suggests a fix. Watch the bottom line.`, bad: `so this is probably gonna take maybe a minute or two i hope less no it's gonna take less`, why_he: `חשיבה בקול בזמן ההמתנה.` }),
  F('f-009', 1, null, { title_he: `לענות בלי well ו-so`, prompt_en: `Answer: "Is it ready?" Start with yes or no. 15 seconds.`, seconds: 15, must: [], banned: ['so', 'well', 'um', 'basically'], model_en: `Not yet. The gateway is live. The dashboard is planned for next month.`, why_he: `so ו-well בתחילת תשובה דוחים את התשובה.` }),
  F('f-010', 3, '01:41', { title_he: `דקה שלמה, אפס מילוי`, prompt_en: `Explain token starvation in 60 seconds. Zero fillers. Pause instead.`, seconds: 60, must: ['token starvation', 'approval'], banned: ALL, model_en: `Today we have a problem. Let's call it token starvation. Each of us gets a fixed monthly budget of tokens. When it runs out, you stop. Or you ask for approval, and you wait. Then people start to save tokens instead of solving problems well. That's what we want to fix.`, bad: `so today the pain is the your organization is the um currently we have a token starvation`, why_he: `צפיפות של מילים ריקות, לא מהירות.` }),
  F('f-011', 2, null, { title_he: `עצור, נשום, משפט חדש`, prompt_en: `Explain your team's main job in 45 seconds. After every sentence, pause for one second. Count it in your head.`, seconds: 45, must: [], banned: ['so', 'and then', 'um', 'uh', 'basically'], model_en: `My team keeps our systems running. We build the pipelines. We watch the alerts. When something breaks, we fix it. And we try to make sure it doesn't break the same way twice.`, why_he: `משפטים שנמשכים בלי נקודה.` }),

  // =====================================================================
  // SPEAKING - type 'speak'
  // =====================================================================
  S('s-001', 1, '01:41', { title_he: `הבעיה`, prompt_en: `Explain the problem. 45 seconds.`, seconds: 45, must: ['token starvation', 'monthly budget', 'approval'], banned: ['so', 'basically', 'whatever', 'um'], model_en: `Today we have a problem. Let's call it token starvation. Each of us gets a fixed monthly budget of Claude tokens. When it runs out, you ask for approval, and you wait. The first question becomes "how do I save tokens?", not "how do I solve this well?". That's not how SRE and DevOps work should look.`, bad: `so today the pain is the your organization is the um currently we have a token starvation`, why_he: `פתיחה בלי שם ברור לבעיה.` }),
  S('s-002', 2, '03:48', { title_he: `ארכיטקטורה: בקשה אחת`, prompt_en: `Walk through one request, end to end. 60 seconds.`, seconds: 60, must: ['VPN', 'nginx', 'LiteLLM', 'vLLM', 'GPU'], banned: ['so', 'basically', 'like', 'whatever'], model_en: `Here's one request, end to end. You're on the VPN. The request goes to nginx, over TLS. Then to LiteLLM, our gateway. It checks your key and your limit: three requests at a time. Then vLLM runs the model, gpt-oss-20b, on our GPU host: two A10 cards. The answer streams back to you. And every request is saved in PostgreSQL.`, bad: `So only users that are connected to the VPN through the reverse proxy to the LytleLM, to the GPU consuming the tokens.`, why_he: `ארכיטקטורה שטחית, בלי מסלול של בקשה.` }),
  S('s-003', 1, '12:52', { title_he: `מודל קטן, ועדיין שימושי`, prompt_en: `Explain why a small model is still useful. 45 seconds.`, seconds: 45, must: ['twenty billion parameters', 'simple bugs', 'per token'], banned: ['so', 'basically', 'whatever', 'like'], model_en: `To be clear, this is a small model. Twenty billion parameters. It won't write big features. But for summaries, logs and simple bugs, it works. And it costs us nothing per token.`, bad: `again this is very uh small and weak we call it a model so we're not expecting of it to be like very aggressive`, why_he: `מגבלה נכונה, אבל מנוסחת חלש.` }),
  S('s-004', 2, '16:09', { title_he: `עלות ונקודת איזון`, prompt_en: `Explain the cost and the break-even. Use placeholders. 60 seconds.`, seconds: 60, must: ['fixed', 'a month', 'paid API', 'break-even'], banned: ['basically', 'I think', 'let\'s say', 'probably'], model_en: `The host costs [X] dollars a month. Fixed, used or not. Our base case: [N] users, [N] million tokens each per day, plus [N] automations. On a paid API, that's about [Y] dollars a month. So we save about [Z] dollars a month. And break-even is only [N] users.`, bad: `but basically this is the break even okay this is the most logical i think average something that i can see happening`, why_he: `הססני בדיוק ברגע של המספרים.` }),
  S('s-005', 2, '22:05', { title_he: `ה-agent מקבל טיקט חדש`, prompt_en: `Explain what the automation agent does with a new support ticket. 60 seconds.`, seconds: 60, must: ['picks it up', 'facts', 'a guess', 'read-only', 'a human decides'], banned: ['so', 'again', 'whatever', 'he'], model_en: `A new support ticket lands in Teams. The agent picks it up. It reads the ticket, checks Git, and finds similar tickets. Then it posts a first triage: facts, a guess, and a suggested fix. It also shows its own confidence. It's read-only. A human decides.`, bad: `again this is only read only um first triage i don't know response`, why_he: `חיפוש מילה בקול, ו-he על ה-agent.` }),
  S('s-006', 2, '26:48', { title_he: `אבטחה בארבע נקודות`, prompt_en: `Explain security in four points. 45 seconds.`, seconds: 45, must: ['no VPN, no access', 'own key', 'logged', 'read-only', 'approval'], banned: ['so', 'again', 'probably', 'basically'], model_en: `Security, in four points. One: no VPN, no access. Two: every user has their own key, with limits. Three: every request is logged. Four: agents are read-only, and every SSH command needs an admin's approval.`, bad: `uh so in matter of security so again anything that is not in the vpn cannot access probably we already said that`, why_he: `אבטחה קיבלה משפט אחד במקום דקה.` }),
  S('s-007', 1, '27:05', { title_he: `אימוץ`, prompt_en: `Explain why people will actually use it. 45 seconds.`, seconds: 45, must: ['same tool', 'Claude Code', 'different key', 'nothing new to learn'], banned: ['so', 'like', 'let\'s say', 'gonna'], model_en: `Nobody wants a new tool. But this is the same tool they use today: Claude Code. Same commands, same screen. Just a different key. There's nothing new to learn.`, bad: `how the the user that not used to work with let's say cursor or something else gonna implement uh gonna like adopt the the solution`, why_he: `הטיעון הכי חכם, נאמר בסוף ומבולגן.` }),
  S('s-008', 2, '17:55', { title_he: `מה חי, מה מתוכנן, מה רעיון`, prompt_en: `Say clearly what is live, what is planned, and what is only an idea. 45 seconds.`, seconds: 45, must: ['live', 'planned', 'an idea', 'haven\'t tested it yet'], banned: ['basically', 'probably', 'whatever'], model_en: `Let me be clear about status. The gateway and the portal are live. The automation agent is live, on a cloud API today. The local model profile is tested and ready. The Grafana monitoring is planned. Hybrid mode is an idea. We haven't tested it yet.`, bad: `so here we have an actual automation that i built that are consuming our local model`, why_he: `נאמר "פועל" כשהשקף אמר planned או idea.` }),
  S('s-009', 2, '12:07', { title_he: `קריינות להדגמה`, prompt_en: `Narrate a live demo: before, while it runs, and after. 60 seconds.`, seconds: 60, must: ['watch', 'while it runs', 'what did we just see'], banned: ['um', 'uh', 'probably', 'he'], model_en: `Let me show you. I'll ask it to find the failing test and fix it. Watch the bottom line: it says LOCAL. While it runs: this is a small open model, on our own GPUs. So what did we just see? It read two files, found the bug, fixed one line, and the tests pass.`, bad: `so this is probably gonna take maybe a minute or two i hope less no it's gonna take less`, why_he: `הדגמה בלי "לאן להסתכל" ובלי סיכום.` }),
  S('s-010', 2, null, { title_he: `גרסת מעלית, 30 שניות`, prompt_en: `Elevator pitch for a manager. Problem, solution, one number, one ask. 30 seconds.`, seconds: 30, must: ['fixed price', 'my ask'], banned: ALL, model_en: `Today every engineer gets a fixed monthly token budget, and then they stop. We built our own model, in our cloud, for a fixed price. At our usage, that saves [X] dollars every month, and nobody waits for approval. My ask: approve a pilot for one quarter.`, why_he: `אין גרסה קצרה מוכנה כשמנהל אומר "יש לי 5 דקות".` }),
  S('s-011', 3, null, { title_he: `הנהלה, שתי דקות`, prompt_en: `Two-minute update for executives. Bottom line first, then risk, then the ask.`, seconds: 120, must: ['bottom line', 'risk', 'my ask'], banned: ['basically', 'whatever', 'I think', 'probably'], model_en: `Bottom line first. We can cut our AI cost per token and stop the approval queue, for a fixed monthly price. Here's the situation. Every engineer has a monthly budget. When it ends, work slows down. We built our own model host. It costs [X] dollars a month, used or not. At our usage, we save about [Y] dollars a month. Break-even is [N] users. Now, the main risk. Today one person maintains it. Everything is in Git, with a runbook, and I want a second owner. If the host goes down, people go back to the paid API, like today. Nothing breaks. My ask: approve a pilot for one quarter. I'll report usage and savings every month.`, why_he: `מבנה חסר מול הנהלה: מספר ובקשה בסוף.` }),
  S('s-012', 3, '17:24', { title_he: `תשובה לספקן`, prompt_en: `A colleague says: "This will never be as good as the paid model." Answer for 45 seconds. Agree with the concern, not the conclusion.`, seconds: 45, must: ['fair', 'hard design work', 'good enough'], banned: ['basically', 'whatever', 'actually', 'you know'], model_en: `That's fair. It's not as smart as the big models. For hard design work, keep using them. But most of our daily work is not hard design. It's logs, summaries and small fixes. For that, it's good enough, and it costs nothing per token.`, why_he: `ויכוח במקום הסכמה עם הדאגה.` }),
  S('s-013', 2, '22:05', { title_he: `"אני לא יודע", יפה`, prompt_en: `Someone asks a question you can't answer. Say "I don't know" well, and promise a follow-up. 20 seconds.`, seconds: 20, must: ['I don\'t know', 'I\'ll check'], banned: ['um', 'uh', 'whatever', 'probably'], model_en: `Good question. I don't know yet. I'll check with the team and send you the answer today.`, why_he: `חיפוש מילה בקול במקום "לא יודע" ברור.` }),
  S('s-014', 2, null, { title_he: `העברת רשות הדיבור`, prompt_en: `Hand over to a colleague who will run the next part. Give credit by name. 20 seconds.`, seconds: 20, must: ['Alex', 'over to'], banned: ['so', 'basically', 'okay'], model_en: `That's the architecture. Alex built the brain behind it, and Alex will show you how it works. Alex, over to you.`, why_he: `קרדיט טוב, אבל מעבר לא ברור.` }),
  S('s-015', 2, '27:52', { title_he: `סיום`, prompt_en: `Close the talk. Three points, one line to remember, one ask. 45 seconds.`, seconds: 45, must: ['three things', 'my ask', 'questions'], banned: ['that\'s it', 'whatever', 'basically'], model_en: `So, three things to remember. One: we run our own model, in our cloud, for a fixed price. Two: you keep the same tool, just with a different key. Three: it already reviews new support tickets every hour. AI should be a daily tool for everyone, not a rare treat. My ask: get your key this week. Thank you. Questions?`, bad: `We don't own it to anyone, so we can do whatever we want, basically. That's it. If anyone has any questions`, why_he: `סיום ב-"That's it" נשמע כמו "נגמר הזמן".` }),
  S('s-016', 1, '02:58', { title_he: `הפתרון במשפט אחד`, prompt_en: `Say the solution in three short sentences. 20 seconds.`, seconds: 20, must: ['our own', 'GPU'], banned: ['okay', 'so', 'basically', 'which is'], model_en: `We built our own. An open model, running on our own GPU host in OCI. Two A10 GPUs, for a fixed price.`, bad: `Okay, so the solution is we built a custom AI solution, which is a local, in our cloud, we're hosting a local LLM machine.`, why_he: `משפט ארוך שהולך לאיבוד.` }),
  S('s-017', 1, '07:41', { title_he: `הפורטל ב-30 שניות`, prompt_en: `Show a simple web portal in 30 seconds. Don't apologize for it.`, seconds: 30, must: ['key', 'simple'], banned: ['not so impressive', 'whatever', 'basically'], model_en: `This is the portal. You log in, and you get a key. That's the whole job. The page is simple on purpose. The value is the key.`, bad: `So this is the, it's not so impressive, but the value of this system is the, this key secret that can be used.`, why_he: `הקטנת העבודה שלך מול הקהל.` }),
  S('s-018', 2, '18:31', { title_he: `למה Teams`, prompt_en: `Explain why the agent works inside Teams, and how it stays safe. 45 seconds.`, seconds: 45, must: ['where we already work', 'webhook', 'HMAC'], banned: ['like', 'whatever', 'he', 'basically'], model_en: `Why Teams? Because that's where we already work. Every channel becomes one data stream for the AI. Teams is outside our VPN, on purpose. The only connection is a webhook, signed with HMAC.`, bad: `why teams is very um nice to have data stream because security wise teams it's not connected to any like private vpn`, why_he: `נשמע כמו חור אבטחה כשזה בעצם תכנון.` }),

  // =====================================================================
  // SCRIPTS - type 'recall'
  // =====================================================================
  R('r-001', 1, '01:25', `פתיחה (60 שניות)`, `Quick question. Who here hit the monthly Claude limit this month? Put a hand up in the chat. That's what we call token starvation. When you run out, you stop. Or you ask for approval and wait. So we built our own model. It runs in our OCI cloud, on two GPUs, for a fixed price. In the next 20 minutes I'll show you three things: how it works, two live demos, and what it costs. Let's start with the problem.`, `פתיחה ב-"so we're here to present". בלי שאלה ובלי מפה.`),
  R('r-002', 1, '27:52', `סיום (45 שניות)`, `So, three things to remember. One: we run our own model, in our cloud, for a fixed price. Two: you keep the same tool, Claude Code, just with a different key. Three: the automation agent already reviews new support tickets every hour. AI should be a daily tool for everyone, not a rare treat. My ask: get your key in the portal this week, and tell me one task you would automate. Thank you. Questions?`, `סיום ב-"That's it". בלי מסר ובלי בקשה.`),
  R('r-003', 2, '12:07', `הדגמה: לפני, בזמן, אחרי`, `Let me show you. I'll ask it to find the failing test and fix it. Watch the bottom line: it says LOCAL, not Anthropic. While it runs: this is gpt-oss, twenty billion parameters, on our two A10 GPUs. So what did we just see? It read two files, found the bug, fixed one line, and the tests pass. On our GPU.`, `לא אמרת לקהל לאן להסתכל.`),
  R('r-004', 1, null, `משפטי מעבר`, `I'll cover three things: the problem, the solution, and what it costs. That's the problem. Now, the solution. This is the important part. To be clear, this is not live yet. It's planned. Remember the monthly limit? This is where it matters. So, to sum up. One last thing.`, `כמעט כל מעבר הוא "So" או "Okay, so".`),
  R('r-005', 2, '23:14', `כשההדגמה איטית`, `It takes a minute, because it's reading Git. Let's not wait. Here's one it already finished. Look at the structure: facts, a guess, and a fix. And it shows its own confidence. Here it's Medium.`, `המתנה שקטה נשמעת כמו תקלה ב-Teams.`),
  R('r-006', 2, null, `גרסת מעלית, 30 שניות (להנהלה)`, `Today every engineer gets a fixed monthly budget of Claude tokens, and then they stop. We built our own model, in our cloud, for a fixed price. At our usage, that saves money every month, and nobody waits for approval. It already triages support tickets every hour. My ask: approve a pilot for all DevOps for one quarter.`, `אין גרסה קצרה עם מספר ובקשה.`),
  R('r-007', 1, null, `שובר קרח לפתיחה`, `Before we start, a small confession. I promised myself not to say "basically" today. If you hear it, write it in the chat. Whoever counts the most gets free tokens. Unlimited. Because that's the whole point of this talk.`, `לחץ בדקה הראשונה.`),
  R('r-008', 1, '13:42', `מענה לשאלה מהקהל`, `Good question. A colleague asked if this works with Claude Code. The short answer is yes. Let me show you how.`, `ענית בלי לחזור על השאלה, וההקלטה לא שמעה אותה.`),
  R('r-009', 2, '22:05', `"אני לא יודע" בלי לאבד ביטחון`, `That's a good question, and I don't want to guess. I don't know yet. I'll check it today and send the answer to everyone in the chat.`, `חיפוש מילה בקול במקום תשובה כנה.`),
  R('r-010', 2, null, `הדגמה נכשלה`, `Live demos. My favorite kind of incident. It's fine, I recorded this one this morning. Let me show you the recording. Same steps, same result.`, `אין תוכנית ב' מוכנה בשפה.`),
  R('r-011', 2, null, `העברה לעמית`, `That's the problem and the solution. The next part is Alex's work, and Alex knows it better than anyone. Alex, over to you.`, `מעבר לא ברור בין דוברים.`),
  R('r-012', 3, null, `גרסת 5 דקות: המבנה`, `I'll give you the bottom line first. We can stop the token approval queue, for a fixed price. Here's the problem in one minute. Here's the solution in one minute. One short demo. The cost, with one number. The risks, and what we did about them. And my ask. Let's go.`, `אין מבנה קצר כשהזמן נחתך.`),

  // =====================================================================
  // QA - type 'qa'
  // =====================================================================
  Q('q-001', 2, null, `What do you need from us?`, `A decision. Approve the pilot for all DevOps for one quarter, at a fixed monthly price. I'll report usage and savings every month.`, `הנהלה. התאם את הבקשה למה שאתה באמת רוצה.`, `אין בקשה ברורה בסוף.`),
  Q('q-002', 2, '15:01', `Is our data safe? You said you log everything.`, `Fair concern. The data never leaves our cloud. Access is VPN only, every user has their own key, and the logs are there for audits, not for reading people's prompts. That's also why the portal tells users: don't send personal data.`, `אבטחה. קודם הסכם עם הדאגה, אחר כך עובדות. בדוק מי באמת רואה את הלוגים.`, `מסר כפול על לוגים ופרטיות.`),
  Q('q-003', 2, '12:52', `Is the model actually good enough?`, `For hard design work, no. Keep using the big paid models. For summaries, logs, triage and simple fixes, yes. It passed all of our coding tests.`, `מהנדסים. כנות היא הנשק שלך כאן. ודא את תוצאות הבדיקות שלך.`, `לא אמרת מתי להשתמש במודל ומתי לא.`),
  Q('q-004', 2, null, `What happens if the GPU host goes down?`, `Then people use the paid API, like they do today. Nothing that works today breaks. For production, we'd add a second host.`, `בדוק שזה נכון למערכת שלך לפני שאתה אומר את זה.`, `אין תשובה מוכנה על כשל.`),
  Q('q-005', 3, null, `Who maintains this when you're on vacation?`, `Good question. Today it's mostly me. That's a risk, and it's why everything is in Git, with a runbook. Part of the ask is a second owner.`, `בדוק את המצב האמיתי. תשובה כנה על סיכון בונה אמון.`, `סיכון שלא נאמר לפני שנשאל.`),
  Q('q-006', 3, null, `Why not just use a managed cloud AI service?`, `Those still charge per token. They solve where the model runs, not the cost. Our host is a fixed price, and the more we use it, the cheaper each token gets.`, `השוואה למתחרים. תשובה במספרים, בלי לזלזל באף אחד.`, `השוואה בלי טיעון עלות ברור.`),
  Q('q-007', 2, null, `How much of your time did this take?`, `Most of it was built over a few weeks, alongside my regular work. The point is: it's already built. Running it is cheap.`, `התאם למציאות. אל תקטין ואל תגדיל.`, `הקטנת העבודה שלך.`),
  Q('q-008', 1, '24:50', `Can the agents change things in production?`, `No. Today they're read-only. The next step is SSH, still read-only, and every command needs an admin's approval. Human in the loop, always.`, `Security ו-SRE. "No" בהתחלה. ודא שזה המצב אצלך.`, `תשובה ארוכה לשאלה של כן או לא.`),
  Q('q-009', 2, '11:39', `Is it slow?`, `Slower than the paid models, yes. The first response typically comes in [X] seconds, and 95 out of 100 answers start in under [Y] seconds. For bulk work, that's fine.`, `צריך את המספרים האמיתיים שלך מהמדידה.`, `מספרים היו על השקף ולא נאמרו.`),
  Q('q-010', 3, '17:24', `So are we really saving money?`, `At our usage, yes: about [X] dollars a month. Break-even is [N] users. Below that, we pay for the option, not the savings.`, `צריך את המספרים האמיתיים שלך. תן מספר ותנאי, לא "it's not actually true".`, `תשובה הססנית על כסף.`),
  Q('q-011', 2, null, `Why not just buy more tokens?`, `We could. But that cost grows with every token. Our host is a fixed price. The more we use it, the cheaper each token gets. And nobody has to ask for approval.`, `תשובה קודם: "We could." ואז למה לא.`, `ויכוח במקום תשובה קצרה.`),
  Q('q-012', 2, '04:34', `What if many people use it at once?`, `vLLM batches requests from all users on both GPUs. Each key gets three parallel requests. If you send more, you get HTTP 429, and you retry after a few seconds.`, `בדוק את המגבלות האמיתיות אצלך.`, `תיאור שגוי: "GPU לכל משתמש".`),
  Q('q-013', 1, null, `Can I use it with my own editor, not only Claude Code?`, `Yes. The key works in any tool that talks to an OpenAI-style API: your editor, a script, or a pipeline. Every request is logged, so don't send personal data.`, `ודא אילו כלים באמת נבדקו.`, `"use it whatever you want" בלי גבולות.`),
  Q('q-014', 2, null, `What if the model gives a wrong answer?`, `It will, sometimes. That's why it shows its confidence, and splits facts from guesses. And a human always decides. It suggests. It doesn't act.`, `כנות על טעויות בונה אמון.`, `"it's pretty reliable" בלי הוכחה.`),
  Q('q-015', 2, '13:29', `When will the hybrid mode be ready?`, `It's an idea. We haven't tested it yet. If the pilot is approved, I'll test it next quarter and share the results.`, `תווית אמת: idea. אל תבטיח תאריך שאין לך.`, `רעיון הוצג כאילו הוא עובד.`),
  Q('q-016', 3, null, `Isn't this just reinventing what the vendor already sells?`, `In part, yes. The difference is the price model. They charge per token. We pay a fixed price, and we control where the data goes.`, `מתחיל בהסכמה חלקית. לא מתגונן.`, `התגוננות מול ספקן.`),
  Q('q-017', 1, null, `What's the next step?`, `Three things. A second owner. The monitoring dashboard, which is planned. And moving the automation agent to our own model. All in the next quarter.`, `התאם לתוכנית האמיתית שלך.`, `אין "מה הלאה" ברור.`),
  Q('q-018', 2, null, `Do people actually use it?`, `[N] engineers have a key today, and usage grows every week. The best proof is that nobody asks for budget approval anymore.`, `צריך את המספרים האמיתיים שלך. אל תמציא.`, `אין נתון אימוץ מוכן.`),

  // =====================================================================
  // PRONUNCIATION - type 'shadow'
  // =====================================================================
  H('sh-001', 1, null, 'Claude', `קְלוֹד, כמו clawed. לא קְלָאוּד (cloud).`, `Claude Code runs in our cloud. Claude, not cloud.`, `התמלול כתב "cloud" בערך 12 פעמים.`),
  H('sh-002', 1, null, 'Anthropic', `הדגש על THROP: an-THROP-ic. בלי s בסוף.`, `Anthropic's model is smarter. Our model is cheaper.`, `התמלול שמע "Anthropix" ו-"antropics".`),
  H('sh-003', 1, '18:46', 'Teams', `טִימְז. t רגילה, לא th.`, `Microsoft Teams. Every team uses Teams.`, `התמלול כתב "themes".`),
  H('sh-004', 1, '16:53', 'cost', `o פתוחה וקצרה, כמו קָאסְט. לא coast.`, `The cost is fixed. The cost per token goes down.`, `התמלול כתב "coast".`),
  H('sh-005', 1, '14:35', 'tokens', `TOH-kens. הדגש בהתחלה.`, `How many tokens per user per day?`, `התמלול כתב "talking per day".`),
  H('sh-006', 2, '03:56', 'LiteLLM', `לַייט, אֶל, אֶל, אֶם.`, `LiteLLM checks your key and your limit.`, `התמלול כתב "LytleLM".`),
  H('sh-007', 2, null, 'vLLM', `וִי, אֶל, אֶל, אֶם. v עם שיניים על השפה.`, `vLLM runs the model on the GPU.`, `לא נאמר בכלל בהרצאה.`),
  H('sh-008', 2, '05:15', 'VCN', `וִי, סִי, אֶן. ה-N ברורה בסוף.`, `Everything is in a private VCN.`, `התמלול שמע "VCA".`),
  H('sh-009', 2, null, 'the / three / think', `לשון בין השיניים. לא ד, לא ס, לא ט.`, `I think there are three things on the third slide.`, `th נשמע כמו d או s במבטא עברי.`),
  H('sh-010', 2, null, 'we / very / version', `w: שפתיים עגולות, בלי שיניים. v: שיניים על השפה התחתונה.`, `We have a very stable version of the server.`, `w ו-v מתחלפים במבטא עברי.`),
  H('sh-011', 2, null, 'logs / tests / tasks', `העיצורים בסוף ברורים: gz, sts, sks. לא לבלוע.`, `The tests passed, the tasks are done, and the logs are clean.`, `בליעת עיצורים בסוף מילה.`),
  H('sh-012', 2, null, 'develop / development', `di-VEL-op. di-VEL-op-ment. הדגש לא זז.`, `We develop it every day. Development never stops.`, `דגש במקום הלא נכון.`),
  H('sh-013', 2, null, 'architecture', `AR-ki-tek-cher. ה-ch נשמע כמו k.`, `Here's the architecture, in one picture.`, `דגש והגייה של ch.`),
  H('sh-014', 2, null, 'infrastructure', `IN-fra-struk-cher. הדגש בהתחלה.`, `Our infrastructure runs in one private network.`, `מילה ארוכה שנבלעת.`),
  H('sh-015', 1, null, 'pipeline', `PIPE-line. ai ארוכה, כמו פַּייפּ.`, `The pipeline runs every night.`, `תנועה קצרה מדי.`),
  H('sh-016', 1, null, 'deploy', `di-PLOY. הדגש בסוף.`, `We deploy every Tuesday.`, `דגש בהתחלה במקום בסוף.`),
  H('sh-017', 2, null, 'data', `DAY-ta. הדגש בהתחלה.`, `The data never leaves our cloud.`, `מילה שחוזרת בכל הרצאה טכנית.`),
  H('sh-018', 3, null, 'parameters', `pa-RAM-e-ters. הדגש בהברה השנייה.`, `Twenty billion parameters, on two GPUs.`, `דגש במקום הלא נכון.`)
];

// =====================================================================
// PRESENTING - coach sections
// =====================================================================
export const COACH = [
  { id: 'c-open', title_he: `איך פותחים: 30 השניות הראשונות`, body_he: `כולם כבר יודעים למה הם פה. הם רוצים לדעת למה להקשיב. אל תתחיל ב-"So, we're here to present".`,
    bullets_he: [`שאלה, מספר או סיפור קצר. אחד מהם.`, `מפה: "Three things". הקהל נרגע כשהוא יודע כמה זמן נשאר.`, `משפט אחד אמיתי: למה אכפת לך.`, `ב-Teams: מצלמה פתוחה בדקה הראשונה.`],
    examples_en: [`Quick question. Who hit the monthly limit this month?`, `I'll cover three things: the problem, the demo, and the cost.`] },
  { id: 'c-close', title_he: `איך מסיימים: הדקה האחרונה`, body_he: `אף פעם לא "That's it". זה נשמע כמו "נגמר לי הזמן", לא כמו סיום.`,
    bullets_he: [`שלוש נקודות: One, Two, Three.`, `משפט אחד שזוכרים.`, `בקשה: מה הם עושים מחר בבוקר.`, `"Questions?" ואז שתוק 5 שניות.`],
    examples_en: [`So, three things to remember.`, `AI should be a daily tool for everyone, not a rare treat.`, `My ask: get your key this week. Questions?`] },
  { id: 'c-qa', title_he: `שאלות מהקהל: 6 טכניקות`, body_he: `שאלות הן החלק שאנשים זוכרים. תתכונן אליהן כמו לשקף.`,
    bullets_he: [`חזור על השאלה. זה נותן לך 3 שניות, וההקלטה שומעת.`, `תשובה קודם, הסבר אחר כך.`, `ספקן: הסכם עם הדאגה, לא עם המסקנה.`, `לא יודע? תגיד יפה, ושלח תשובה באמת.`, `מחוץ לנושא: "Let's take it offline."`, `אף אחד לא שואל? שאלה שתולה משלך.`],
    examples_en: [`Alex asked if it works with Claude Code. Yes. Here's how.`, `That's a fair concern. Here's what we did about it.`, `A question I usually get is: what if the GPU dies?`] },
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
    examples_en: [`Imagine you're in the middle of a problem, and you get a message: budget exceeded.`] },
  { id: 'c-care', title_he: `איך להראות שאכפת לך (בלי למכור)`, body_he: `אנשים מאמצים כלים של אנשים, לא של שקפים.`,
    bullets_he: [`רגע אישי אחד, אמיתי. רק אם הוא נכון.`, `"I built" כשזה שלך, "we" כשזה של הצוות.`, `אל תקטין את העבודה שלך.`, `אנרגיה רק על 3 רגעים: הבעיה, ההדגמה, הבקשה.`, `תן קרדיט בשם, והצע עזרה.`],
    examples_en: [`The page is simple on purpose.`, `Ping me on Teams. I'll help you set it up in five minutes.`] },
  { id: 'c-demo', title_he: `הדגמות: איך לא להיתקע`, body_he: `2 דקות של הכנה בשקט הן נצח ב-Teams. הכול פתוח מראש.`,
    bullets_he: [`לפני: מה יקרה ולאן להסתכל.`, `בזמן: משפט מוכן.`, `אחרי: "So what did we just see?"`, `תוכנית ב': הקלטה מוכנה.`],
    examples_en: [`Watch the bottom line.`, `While it runs, let me explain what's happening.`, `Let's not wait. Here's one it already finished.`] },
  { id: 'c-fail', title_he: `כשההדגמה נכשלת`, body_he: `הקהל לא זוכר שההדגמה נפלה. הוא זוכר איך הגבת.`,
    bullets_he: [`צחק, הסבר במשפט, המשך.`, `עבור להקלטה בלי להתנצל שלוש פעמים.`, `אל תנסה לתקן בשידור חי יותר מ-30 שניות.`],
    examples_en: [`Live demos. My favorite kind of incident.`, `Let me show you the recording.`] },
  { id: 'c-remote', title_he: `הרצאה מרחוק ב-Teams`, body_he: `ב-Teams אין שפת גוף ואין תגובה מהקהל. צריך לפצות בקול ובמבנה.`,
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
    examples_en: [`No tokens were harmed in the making of this demo.`] },
  { id: 'c-truth', title_he: `תווית אמת: live, planned, idea`, body_he: `מהנדסים סולחים על "planned". הם לא סולחים על "live" שהוא בעצם planned.`,
    bullets_he: [`לכל פיצ'ר מילה אחת: live, planned או idea.`, `קרא את השורה מהשקף.`, `מגבלה: משפט נפרד וברור.`],
    examples_en: [`To be clear, this is not live yet. It's planned.`, `This is an idea. We haven't tested it yet.`] },
  { id: 'c-rules', title_he: `6 כללים קצרים`, body_he: `השקפים שלך כתובים טוב יותר מהדיבור. תן להם לעבוד.`,
    bullets_he: [`רעיון אחד לשקף. קרא את הכותרת בקול.`, `כלל השלוש.`, `בלי probably, I think, basically במשפטים חשובים.`, `סיים בזמן, עדיף דקה לפני.`, `שתי גרסאות מוכנות: 30 שניות ו-5 דקות.`, `חזרה מול אדם שישאל שאלות קשות.`],
    examples_en: [`I'll cover three things.`, `One last thing.`] }
];

export const AUDIENCES = [
  { id: 'exec', name_he: `הנהלה`, focus_he: [`שורה תחתונה קודם: כסף, זמן, סיכון.`, `מספר אחד לכל שקף: עלות קבועה, חיסכון, נקודת איזון.`, `הסיכונים לפני שהם שואלים.`, `בקשה ברורה בסוף.`, `גרסה של 5 דקות.`], skip_he: `ארכיטקטורה מפורטת, vLLM, HMAC, גלילה בתפריטים.`, open_en: `I'll give you the bottom line first, in case someone pulls you into another meeting. We can cut our AI cost per token, and stop the approval queue, for a fixed price.`, joke_en: `The good news: this costs less than the coffee machine. The bad news: I haven't checked how much the coffee machine costs.` },
  { id: 'eng', name_he: `מהנדסים / DevOps`, focus_he: [`מסלול של בקשה אחת: VPN, nginx, LiteLLM, vLLM, GPU.`, `מגבלות ו-failure modes: בקשות במקביל, HTTP 429.`, `הדגמה חיה עם הוכחה שזה המודל שלנו.`, `כנות: מה המודל לא יודע לעשות.`, `איך מתחילים מחר, בלי כלי חדש.`], skip_he: `מצגת עסקית ארוכה, "very good user experience".`, open_en: `Quick question. Who here hit the monthly Claude limit this month? Okay. Today I'll show you how to stop counting tokens, with the same tool you already use.`, joke_en: `Yes, it's a live demo. If it fails, we'll call it an incident and do a postmortem together. We're DevOps. We're good at those.` },
  { id: 'sec', name_he: `אבטחה / IT`, focus_he: [`איפה הדאטה, ואיפה הוא לא יוצא: VPN בלבד.`, `זהות וגישה: מפתח לכל משתמש, ביטול מפתח.`, `לוגים ו-audit: מי רואה אותם.`, `Teams: מה מגן על החיבור (webhook עם HMAC).`, `agents: read-only, ואישור אדם לכל SSH.`], skip_he: `הדגמת קוד, מחשבון עלות.`, open_en: `Let me start with what you care about: where the data goes. Short answer: nowhere. It stays in our cloud, behind the VPN.`, joke_en: `I know, a talk about AI and security. I promise, no slide says "trust me".` },
  { id: 'mix', name_he: `קהל מעורב / כל החברה`, focus_he: [`סיפור לפני טכנולוגיה.`, `מה זה נותן לכל אחד, במשפט אחד.`, `הדגמה אחת, הכי ויזואלית.`, `מילים פשוטות.`, `בקשה קלה: "try it this week".`], skip_he: `ראשי תיבות, מספרי GPU, HTTP 429.`, open_en: `Imagine you're in the middle of solving a problem, and a message pops up: budget exceeded. That happens to us every month. Today I'll show you how we fixed it.`, joke_en: `Don't worry, there's no exam at the end. Only a small demo that may or may not work. Like all good demos.` },
  { id: 'new', name_he: `מצטרפים חדשים / קהל לא טכני`, focus_he: [`למה זה קיים, במשפט אחד.`, `איך מתחילים: שלושה צעדים.`, `למי פונים כשנתקעים.`], skip_he: `עלויות, ארכיטקטורה, מונחים בלי הסבר.`, open_en: `By the end of these ten minutes, you'll have a key and your first answer from our own model.`, joke_en: `If you get lost, that's on me, not on you. I wrote the slides at night.` }
];

export const ICEBREAKERS = [
  { line_en: `Before we start, a small confession. I promised myself not to say "basically" today. If you hear it, write it in the chat.`, when_he: `פתיחה. הופך את מה שאתה מתאמן עליו לבדיחה, והקהל בצד שלך.` },
  { line_en: `Today I'll show you how to get free tokens. Legally.`, when_he: `פתיחה, לקהל מהנדסים.` },
  { line_en: `Yes, it's a live demo. If it fails, we'll call it an incident and write a postmortem together.`, when_he: `לפני הדגמה חיה.` },
  { line_en: `It's thinking. Like me before my first coffee.`, when_he: `כשהמודל איטי.` },
  { line_en: `This model is small, but it's ours. Like my first apartment.`, when_he: `כשמסבירים למה מודל קטן מספיק.` },
  { line_en: `My English has an accent. The model doesn't. That's why I brought the model.`, when_he: `פתיחה, אם זה מרגיש טבעי. הומור עצמי מוריד לחץ.` },
  { line_en: `I'll give you the bottom line first, in case someone pulls you into another meeting.`, when_he: `פתיחה מול הנהלה. מצחיק ומכבד את הזמן שלהם.` },
  { line_en: `No tokens were harmed in the making of this demo.`, when_he: `אחרי שההדגמה עבדה.` },
  { line_en: `Questions? Easy ones first, please. Hard ones I'll answer by email. Next year.`, when_he: `מעבר לשאלות. אמור עם חיוך, ואז באמת ענה.` },
  { line_en: `Fun fact: the hardest part of this project wasn't the GPU. It was the name.`, when_he: `כשמציגים את שם הפרויקט.` },
  { line_en: `I tested this demo ten times this morning. So statistically, this is the one that fails.`, when_he: `רגע לפני הדגמה חיה.` },
  { line_en: `If you see me looking at my notes, that's not stress. That's documentation.`, when_he: `כשאתה מציץ בכרטיס המספרים.` },
  { line_en: `I'm an engineer, so I'll keep the jokes short and the logs long.`, when_he: `פתיחה, לקהל טכני.` },
  { line_en: `Live demos. My favorite kind of incident.`, when_he: `כשההדגמה נכשלת. אחר כך עוברים להקלטה.` },
  { line_en: `I promised a short talk. But I'm an engineer, and you know how good we are at time estimates.`, when_he: `פתיחה, או כשמתקרבים לסוף הזמן.` },
  { line_en: `If my video freezes, don't worry. I'm not thinking that hard. It's the network.`, when_he: `פתיחה ב-Teams.` },
  { line_en: `I'll try to finish one minute early. If I don't, blame the model. It writes my estimates now.`, when_he: `פתיחה, אחרי המפה של ההרצאה.` }
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
  { id: 'b-pron-20', title_he: `Claude, לא cloud`, desc_he: `20 תרגילי הגייה.`, icon: 'volume', rule: 'cat:pronunciation:20' },
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
