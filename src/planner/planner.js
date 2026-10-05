/* Planner do Ronrom: estado, cálculos, páginas e ações.
   Os dados ficam na API (/api/state); veja sync.js. */
import { $, uid, esc, pad, ymd, parse, addDays, startOfWeek, monthKey, quarterKey, daysInMonth, clamp, pctOf, startDay } from '../shared/utils.js';
import { svg, I, BRAND } from '../shared/icons.js';
import { LOOKS, catSVG } from '../shared/cats.js';
import { DOW, DOW_FULL, MONTHS, MON3, fmtShort, fmtLong, cap, CATS, CAT_COLOR, catColor, COLORS, PROJ_STATUS, STATUS_CLS, WHEEL, WHEEL_SHORT, QUOTES, THEMES, HEALTH } from './constants.js';
import { blankState, seed, quarterRange } from './seed.js';
import { createSync } from './sync.js';

/* ---------- estado + sincronização ---------- */
let S = blankState();
let USER = null, sync = null, onLogout = null, syncState = 'saved';

/** Completa campos que faltam (dados antigos ou backups) e migra nomes de temas. */
function normalize(raw){
  const st = Object.assign(blankState(), raw || {});
  WHEEL.forEach(c => { if (!st.wheel[c]) st.wheel[c] = {score:5, note:''}; });
  st.trip = Object.assign({name:'', start:'', end:'', notes:''}, st.trip || {}); if (!st.trip.checklist) st.trip.checklist = [];
  st.catCare = Object.assign({items:[]}, st.catCare || {}); if (!st.catCare.log) st.catCare.log = {};
  st.memorial = Object.assign({name:'', look:'manteiga', text:''}, st.memorial || {});
  const PAL = {pastel:'manteguinha', verde:'peleguinho', rosa:'phoebe', azul:'noite'}; if (PAL[st.palette]) st.palette = PAL[st.palette];
  return st;
}
const SYNC_LABEL = { saving:'Salvando…', saved:'Salvo na nuvem', offline:'Sem internet, salvo aqui', error:'Erro ao salvar, tentando de novo' };
function setSync(st){ syncState = st; const el = document.getElementById('sync-status'); if (el) el.lastChild.textContent = SYNC_LABEL[st]; }
function save(){ sync?.schedule(); }
function saveNow(){ return sync?.flush(); }
const V = { page: S.page || 'home', ref: new Date(), taskFilter: 'pendentes', openProject: null };

function getWeek(wk){
  if (!S.weeks[wk]) S.weeks[wk] = {intention:'', reflection:'', priorities:[{text:'',done:false},{text:'',done:false},{text:'',done:false}]};
  return S.weeks[wk];
}
function getQuarter(qk){
  if (!S.quarters[qk]) S.quarters[qk] = {
    months: [0,1,2].map(() => ({intention:'', objective:'', desc:''})),
    goals: ['yellow','pink','green'].map(color => ({title:'', category:'', deadline:'', color, notes:'', checklist:[]}))
  };
  return S.quarters[qk];
}
function setPath(obj, path, val){
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++){ if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length-1]] = val;
}

/* ---------- calculations ---------- */
const listPct = l => pctOf((l||[]).filter(i => i.done).length, (l||[]).length);
function goalStatus(g){ if (g.paused) return 'Pausada'; const p = listPct(g.checklist); return p === 100 ? 'Concluída' : p === 0 ? 'Não iniciada' : 'Em andamento'; }
function monthGoalsStat(mk){
  const gs = S.goals.filter(g => g.month === mk);
  let total = 0, done = 0;
  gs.forEach(g => { total += g.checklist.length; done += g.checklist.filter(i => i.done).length; });
  return { goals: gs.length, total, done, pct: pctOf(done, total), complete: gs.filter(g => goalStatus(g) === 'Concluída').length };
}
const weekDates = ws => [0,1,2,3,4,5,6].map(i => ymd(addDays(ws, i)));
const habitCountIn = (h, dates) => dates.filter(x => h.log[x]).length;
function habitWeek(h, ws){ const c = habitCountIn(h, weekDates(ws)); return { count:c, pct: clamp(pctOf(Math.min(c, h.freq), h.freq), 0, 100) }; }
function habitMonth(h, ref){
  const n = daysInMonth(ref), dates = Array.from({length:n}, (_, i) => ymd(new Date(ref.getFullYear(), ref.getMonth(), i+1)));
  const c = habitCountIn(h, dates), exp = Math.max(1, Math.round(h.freq * n / 7));
  return { count:c, expected:exp, pct: clamp(pctOf(c, exp), 0, 100) };
}
function habitRate30(h){
  const t = new Date(), dates = Array.from({length:30}, (_, i) => ymd(addDays(t, -i)));
  const c = habitCountIn(h, dates), exp = Math.max(1, Math.round(h.freq * 30 / 7));
  return clamp(pctOf(c, exp), 0, 100);
}
function streak(h){ let d = new Date(); if (!h.log[ymd(d)]) d = addDays(d, -1); let n = 0; while (h.log[ymd(d)]) { n++; d = addDays(d, -1); } return n; }
function habitWeekStat(ws){
  let exp = 0, done = 0; const dates = weekDates(ws);
  S.habits.forEach(h => { exp += h.freq; done += Math.min(habitCountIn(h, dates), h.freq); });
  return { exp, done, pct: pctOf(done, exp) };
}
const habitsDayPct = date => pctOf(S.habits.filter(h => h.log[date]).length, S.habits.length);
function projectProgress(p){
  if (p.status === 'Concluído') return 100;
  const ts = S.tasks.filter(t => t.projectId === p.id);
  return pctOf(ts.filter(t => t.done).length, ts.length);
}
function projectsStat(){
  const n = S.projects.length;
  const avg = n ? Math.round(S.projects.reduce((a, p) => a + projectProgress(p), 0) / n) : 0;
  return { n, done: S.projects.filter(p => p.status === 'Concluído').length, pct: avg };
}
function tasksWeekStat(ws){
  const dates = new Set(weekDates(ws));
  const ts = S.tasks.filter(t => dates.has(t.date));
  return { total: ts.length, done: ts.filter(t => t.done).length, pct: pctOf(ts.filter(t => t.done).length, ts.length) };
}
const wheelLevel = s => s <= 3 ? ['Crítico','pink'] : s <= 6 ? ['Atenção','yellow'] : s <= 8 ? ['Bom','blue'] : ['Excelente','green'];

/* ---------- small UI helpers ---------- */
const bar = (p, cls='') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
const tag = (text, color) => `<span class="tag t-${color}">${esc(text)}</span>`;
const empty = (title, text, btn='') => `<div class="empty">${catSVG('cinza','empty-cat')}<b>${title}</b>${text}${btn ? `<div style="margin-top:14px">${btn}</div>` : ''}</div>`;
const head = (kicker, title, sub, right='') => `<header class="page-head"><div>${kicker ? `<div class="kicker">${kicker}</div>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="head-right">${right}</div></header>`;
const weekLabel = ws => { const we = addDays(ws, 6); return ws.getMonth() === we.getMonth() ? `${ws.getDate()} a ${we.getDate()} de ${MON3[we.getMonth()]}` : `${ws.getDate()} ${MON3[ws.getMonth()]} a ${we.getDate()} ${MON3[we.getMonth()]}`; };
const periodNav = (label, unit) => `<div class="period"><button class="icon-btn" data-a="prev" data-unit="${unit}" aria-label="Período anterior">${I.left}</button><span>${label}</span><button class="icon-btn" data-a="next" data-unit="${unit}" aria-label="Próximo período">${I.right}</button></div><button class="btn btn-ghost" data-a="today">Hoje</button>`;
const opts = (list, val) => list.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}" ${o[0]===val?'selected':''}>${esc(o[1])}</option>` : `<option ${o===val?'selected':''}>${esc(o)}</option>`).join('');
const statusSelect = (p) => `<select class="status-sel sel-${STATUS_CLS[p.status]}" data-c="proj-status" data-id="${p.id}" aria-label="Status do projeto">${opts(PROJ_STATUS, p.status)}</select>`;

function checklistHTML(t, list){
  return `<ul class="checklist">${list.map(it => `<li class="${it.done?'done':''}"><label><input type="checkbox" class="ck" data-c="check" data-t="${t}" data-id="${it.id}" ${it.done?'checked':''}><span>${esc(it.text)}</span></label><button class="icon-btn sm" data-a="del-check" data-t="${t}" data-id="${it.id}" aria-label="Remover etapa">${I.x}</button></li>`).join('')}</ul>
  <div class="add-row"><input class="inp-line" placeholder="Adicionar etapa e pressionar Enter" data-enter="add-check" data-t="${t}" aria-label="Nova etapa"><button class="icon-btn sm" data-a="add-check" data-t="${t}" aria-label="Adicionar etapa">${I.plus}</button></div>`;
}
function getList(t){
  const [k, a, b] = t.split(':');
  if (k === 'goal') return S.goals.find(g => g.id === a)?.checklist;
  if (k === 'qgoal') return getQuarter(a).goals[+b].checklist;
  if (k === 'trip') return S.trip.checklist;
  return null;
}
function taskRow(t, opt={}){
  const p = S.projects.find(p => p.id === t.projectId);
  const late = !t.done && t.date && t.date < ymd(new Date());
  const meta = [opt.noDate ? '' : (t.date ? (late ? `Atrasada, ${fmtShort(t.date)}` : fmtShort(t.date)) : ''), p && !opt.noProject ? p.name : ''].filter(Boolean).join(', ');
  return `<li class="${t.done?'done':''}"><label><input type="checkbox" class="ck" data-c="task" data-id="${t.id}" ${t.done?'checked':''}><span class="t"><span>${esc(t.title)}</span>${meta && !opt.compact ? `<small style="${late?'color:var(--pink-ink)':''}">${esc(meta)}</small>` : ''}</span></label>
  ${opt.compact ? '' : `${t.priority==='Alta' && !t.done ? tag('Alta','pink') : ''}<button class="icon-btn sm" data-a="edit-task" data-id="${t.id}" aria-label="Editar tarefa">${I.edit}</button><button class="icon-btn sm" data-a="del-task" data-id="${t.id}" aria-label="Excluir tarefa">${I.trash}</button>`}</li>`;
}

const classesOn = i => S.classes.filter(c => (c.days || []).includes(i)).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
const classChip = c => `<span class="class-chip"><b>${esc(c.name)}</b>${esc(c.start || '')}${c.end ? ' às ' + esc(c.end) : ''}${c.place ? ', ' + esc(c.place) : ''}</span>`;
function tripChip(){
  const t = S.trip, p = listPct(t.checklist); let when = 'defina a data de ida';
  if (t.start){ const dd = Math.round((parse(t.start) - startDay()) / 864e5); when = dd > 1 ? `faltam ${dd} dias` : dd === 1 ? 'falta 1 dia' : dd === 0 ? 'é hoje' : 'em andamento'; }
  return `<button class="hero-chip" data-a="nav" data-page="trip"><span class="ic">${I.globe}</span><span><b>Intercâmbio</b>: ${when}, preparação em ${p}%</span></button>`;
}
function healthInfo(date){
  if (!date) return ['Sem data','neutral'];
  const dd = Math.round((parse(date) - startDay()) / 864e5);
  if (dd < 0) return [`Atrasado ${-dd} ${dd === -1 ? 'dia' : 'dias'}`,'pink'];
  if (dd === 0) return ['É hoje','yellow'];
  return [`Em ${dd} ${dd === 1 ? 'dia' : 'dias'}`, dd <= 14 ? 'yellow' : 'green'];
}
function nextHealth(){
  let best = null;
  S.cats.forEach(c => HEALTH.forEach(([k, l]) => { if (c[k] && (!best || c[k] < best.date)) best = {date:c[k], text:`${l} ${c.name === 'Phoebe' || /a$/i.test(c.name) ? 'da' : 'do'} ${c.name}`}; }));
  if (!best) return `<button class="link" data-a="nav" data-page="cats" style="margin-top:10px">Cadastrar vacina e vermífugo</button>`;
  const [txt, col] = healthInfo(best.date);
  return `<div class="small" style="margin-top:12px;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${esc(best.text)}</span>${tag(txt, col)}</div>`;
}
function careList(T, withDelete){
  const done = S.catCare.log[T] || {};
  return `<ul class="todo">${S.catCare.items.map(it => `<li><label><input type="checkbox" class="ck" data-c="care" data-id="${it.id}" data-date="${T}" ${done[it.id]?'checked':''}><span class="t"><span>${esc(it.text)}</span></span></label>${withDelete ? `<button class="icon-btn sm" data-a="del-care" data-id="${it.id}" aria-label="Remover cuidado">${I.x}</button>` : ''}</li>`).join('')}</ul>`;
}
const careCount = T => { const done = S.catCare.log[T] || {}; return S.catCare.items.filter(i => done[i.id]).length; };

/* =========================================================
   PAGES
   ========================================================= */
const NAV = [
  ['home','Início',I.home],['week','Semana',I.week],['goals','Metas',I.goals],['tasks','Tarefas',I.tasks],
  ['quarter','Trimestre',I.quarter],['projects','Projetos',I.projects],['habits','Hábitos',I.habits],
  ['trip','Intercâmbio',I.globe],['cats','Gatos',I.paw],['look','Aparência',I.look]
];
function renderSidebar(){
  $('#sidebar').innerHTML = `
    <div class="brand"><div class="brand-mark">${BRAND}</div><div><div class="brand-name">${esc(S.appName || 'Ronrom')}</div><div class="brand-sub">planner da ${esc(S.name || 'você')}</div></div></div>
    <nav class="nav" aria-label="Navegação principal">
      ${NAV.map(([id, label, ic], i) => `${i===0?'<div class="nav-group">Visão geral</div>':''}${i===2?'<div class="nav-group">Planejamento</div>':''}${i===6?'<div class="nav-group">Vida</div>':''}${i===9?'<div class="nav-group">Ajustes</div>':''}<button class="${V.page===id?'active':''}" data-a="nav" data-page="${id}" ${V.page===id?'aria-current="page"':''}>${ic}<span>${label}</span></button>`).join('')}
    </nav>
    <div class="side-foot"><button class="side-out" data-a="logout">Sair</button><b>${esc(S.name || 'Seu planner')}</b><span class="saved" id="sync-status"><i></i>${SYNC_LABEL[syncState]}</span>${S.memorial?.name ? `<span class="memo">${I.star}${esc(S.memorial.name)}, sempre por perto</span>` : ''}</div>`;
}

/* ---------- Início ---------- */
const LEGACY_KEY = 'ronrom-julia-v1';
const legacyData = () => { try { const r = localStorage.getItem(LEGACY_KEY); return r ? JSON.parse(r) : null; } catch(e){ return null; } };
function onboardingCard(){
  const legacy = legacyData();
  return `<section class="card c-blue onboarding">
    <div class="ob-cats">${catSVG('siames','cat-mini')}${catSVG('cinza','cat-mini')}</div>
    <div style="flex:1;min-width:240px"><h2>Bem-vinda ao Ronrom${S.name ? ', ' + esc(S.name) : ''}!</h2>
    <p class="muted" style="margin:6px 0 0">Seu planner está vazio. Você pode começar do zero ou preencher com exemplos para ver tudo funcionando e ir editando.</p></div>
    <div class="ob-actions">
      ${legacy ? `<button class="btn" data-a="ob-legacy">Trazer meus dados deste navegador</button>` : ''}
      <button class="btn ${legacy ? 'btn-ghost' : ''}" data-a="ob-sample">Preencher com exemplos</button>
      <button class="btn btn-ghost" data-a="ob-blank">Começar do zero</button>
    </div></section>`;
}

function msCard(m, i){
  const color = ['yellow','pink','green','blue'][i % 4];
  return `<article class="ms c-${color}">
    <div class="ms-top"><span class="tag">${esc(m.category || 'Geral')}</span><div class="ms-actions"><button class="icon-btn sm" data-a="edit-ms" data-id="${m.id}" aria-label="Editar marco">${I.edit}</button><button class="icon-btn sm" data-a="del-ms" data-id="${m.id}" aria-label="Excluir marco">${I.trash}</button></div></div>
    <h3>${esc(m.title)}</h3>
    <div class="ms-meta"><span>Prazo ${fmtShort(m.deadline)}</span><b data-ms-label="${m.id}">${m.progress}%</b></div>
    <input type="range" class="range" min="0" max="100" step="5" value="${m.progress}" data-i="ms" data-id="${m.id}" aria-label="Progresso de ${esc(m.title)}">
  </article>`;
}
function pageHome(){
  const now = new Date(), T = ymd(now), ws = startOfWeek(V.ref), wk = ymd(ws), mk = monthKey(V.ref), W = getWeek(wk);
  const hr = now.getHours(), greet = hr < 5 ? 'Boa noite' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const msg = (S.mantra || '').trim() || QUOTES[doy % QUOTES.length];
  const g = monthGoalsStat(mk), hb = habitWeekStat(ws), pr = projectsStat(), tk = tasksWeekStat(ws);
  const ms = S.milestones.filter(m => m.month === mk);
  const prDone = W.priorities.filter(p => p.done).length;
  const mName = MONTHS[V.ref.getMonth()];
  const isThisWeek = ymd(startOfWeek(now)) === wk;
  const todayTasks = S.tasks.filter(t => (t.date === T) || (!t.done && t.date && t.date < T)).sort((a,b) => a.done - b.done);
  const goals = S.goals.filter(x => x.month === mk);
  const projs = S.projects.filter(p => p.status !== 'Concluído').slice(0, 4);
  const kpi = (color, page, pct, title, desc) => `<button class="kpi c-${color}" data-a="nav" data-page="${page}"><div class="kpi-pct">${pct}<small>%</small></div><div class="kpi-title">${title}</div><div class="kpi-desc">${desc}</div>${bar(pct)}</button>`;
  return `
  <header class="hero">
    <div>
      <div class="date-line">${cap(fmtLong(now))}${isThisWeek ? '' : `, vendo a semana de ${weekLabel(ws)}`}</div>
      <h1>${greet}, ${esc(S.name || 'você')}</h1>
      <p class="hero-msg">${esc(msg)}</p>
    </div>
    <div class="hero-right"><div class="head-right">${periodNav(weekLabel(ws), 'week')}</div>${tripChip()}</div>
  </header>

  ${S.onboarding ? onboardingCard() : ''}
  <section class="kpis" aria-label="Indicadores de progresso">
    ${kpi('yellow','goals', g.pct, 'Metas do mês', `${g.done} de ${g.total} etapas em ${mName}`)}
    ${kpi('green','habits', hb.pct, 'Hábitos da semana', `${hb.done} de ${hb.exp} check-ins previstos`)}
    ${kpi('pink','projects', pr.pct, 'Projetos', `${pr.done} de ${pr.n} concluídos, progresso médio`)}
    ${kpi('blue','tasks', tk.pct, 'Tarefas da semana', `${tk.done} de ${tk.total} tarefas concluídas`)}
  </section>

  <section class="block">
    <div class="block-head"><div><h2>Marcos de ${mName}</h2><p>As conquistas que fariam este mês valer a pena.</p></div><button class="btn" data-a="new-ms">${I.plus}Novo marco</button></div>
    <div class="ms-grid">${ms.length ? ms.map(msCard).join('') : empty('Nenhum marco neste mês', 'Escolha de 2 a 4 marcos e acompanhe o avanço de cada um.')}</div>
  </section>

  <section class="block grid-2">
    <div class="card c-blue">
      <div class="card-title"><h3>Qual é a minha intenção desta semana?</h3></div>
      <textarea class="soft-area" placeholder="Escreva como você quer viver esta semana…" data-bind="weeks.${wk}.intention" aria-label="Intenção da semana">${esc(W.intention)}</textarea>
    </div>
    <div class="card c-yellow">
      <div class="card-title"><h3>3 prioridades da semana</h3><span class="note">${prDone}/3 feitas</span></div>
      <ul class="prio-list">${W.priorities.map((p, i) => `<li class="${p.done?'done':''}"><span class="num">${i+1}</span><input type="checkbox" class="ck" data-c="prio" data-wk="${wk}" data-i="${i}" ${p.done?'checked':''} aria-label="Concluir prioridade ${i+1}"><input class="inp-line" placeholder="Prioridade ${i+1}" value="${esc(p.text)}" data-bind="weeks.${wk}.priorities.${i}.text"></li>`).join('')}</ul>
    </div>
  </section>

  <section class="block">
    <div class="block-head"><div><h2>Hoje</h2><p>${cap(DOW_FULL[(now.getDay()+6)%7])}, ${now.getDate()} de ${MONTHS[now.getMonth()]}</p></div></div>
    <div class="grid-3">
    <div class="card c-pink">
      <div class="card-title"><h3>Agenda</h3><span class="note">${todayTasks.filter(t=>t.done).length}/${todayTasks.length} tarefas</span></div>
      ${classesOn((now.getDay()+6)%7).length ? `<div class="agenda">${classesOn((now.getDay()+6)%7).map(classChip).join('')}</div>` : ''}
      ${todayTasks.length ? `<ul class="todo">${todayTasks.map(t => taskRow(t)).join('')}</ul>` : '<p class="muted small" style="margin:0 0 8px">Nenhuma tarefa para hoje.</p>'}
      <div class="add-row"><input class="inp-line" placeholder="Nova tarefa para hoje e Enter" data-enter="quick-task" data-date="${T}" aria-label="Nova tarefa para hoje"></div>
    </div>
    <div class="card c-green">
      <div class="card-title"><h3>Hábitos</h3><span class="note">${S.habits.filter(h => h.log[T]).length}/${S.habits.length}</span></div>
      ${S.habits.length ? `<ul class="todo">${S.habits.map(h => `<li><label><input type="checkbox" class="ck" data-c="habit" data-id="${h.id}" data-date="${T}" ${h.log[T]?'checked':''}><span class="t"><span>${esc(h.name)}</span><small>${esc(h.target)}</small></span></label><span class="small muted" style="white-space:nowrap" title="dias seguidos"><span class="paw">${I.paw}</span> ${streak(h)}</span></li>`).join('')}</ul>` : empty('Sem hábitos ainda', 'Crie hábitos na página Hábitos.')}
    </div>
    <div class="card c-yellow">
      <div class="card-title"><h3>Gatos</h3><span class="note">${careCount(T)}/${S.catCare.items.length} cuidados</span></div>
      <div style="display:flex;gap:2px;margin:-8px 0 4px">${S.cats.map(c => `<span title="${esc(c.name)}">${catSVG(c.look,'cat-mini')}</span>`).join('')}</div>
      ${careList(T, false)}
      ${nextHealth()}
    </div>
    </div>
  </section>

  <section class="block">
    <div class="block-head"><div><h2>Sua semana</h2><p>Hábitos cumpridos em cada dia. Clique em um dia para abrir a semana.</p></div></div>
    <div class="strip">${weekDates(ws).map((date, i) => { const p = habitsDayPct(date); const ts = S.tasks.filter(t => t.date === date); return `<button class="day ${date===T?'today':''}" data-a="nav" data-page="week"><span class="dn">${DOW[i]}</span><span class="dd">${parse(date).getDate()}</span>${bar(p)}<span class="dp">${p}% hábitos, ${ts.filter(t=>t.done).length}/${ts.length} tarefas</span></button>`; }).join('')}</div>
  </section>

  <section class="block grid-2">
    <div class="card">
      <div class="card-title"><h3>Metas de ${mName}</h3><button class="link" data-a="nav" data-page="goals">Ver metas</button></div>
      ${goals.length ? goals.map(x => { const p = listPct(x.checklist); return `<div class="mini-goal tn-${x.color}"><div class="row"><b>${esc(x.title)}</b><span>${p}%</span></div>${bar(p, 'dark')}</div>`; }).join('') : '<p class="muted small">Nenhuma meta neste mês.</p>'}
    </div>
    <div class="card">
      <div class="card-title"><h3>Projetos em aberto</h3><button class="link" data-a="nav" data-page="projects">Ver projetos</button></div>
      ${projs.length ? projs.map(p => { const pp = projectProgress(p); return `<div class="mini-goal"><div class="row"><b>${esc(p.name)}</b>${tag(p.status, STATUS_CLS[p.status])}</div><div class="prog-cell tn-pink">${bar(pp, 'dark')}<b>${pp}%</b></div></div>`; }).join('') : '<p class="muted small">Nenhum projeto em aberto.</p>'}
    </div>
  </section>`;
}

/* ---------- Semana ---------- */
function pageWeek(){
  const ws = startOfWeek(V.ref), wk = ymd(ws), T = ymd(new Date()), dates = weekDates(ws), W = getWeek(wk);
  const hb = habitWeekStat(ws), tk = tasksWeekStat(ws);
  return `
  ${head('', 'Minha semana', `Hábitos ${hb.pct}% cumpridos e tarefas ${tk.pct}% concluídas nesta semana.`, periodNav(weekLabel(ws), 'week'))}
  <section>
    <div class="block-head"><div><h2>Rotina</h2><p>Marque cada atividade no dia em que ela aconteceu. Tudo é salvo e alimenta os hábitos e o painel.</p></div><button class="btn" data-a="new-habit">${I.plus}Nova atividade</button></div>
    ${S.habits.length ? `<div class="tbl-wrap"><table class="week-tbl">
      <thead><tr><th>Atividade</th>${dates.map((d, i) => `<th class="tc ${d===T?'is-today':''}">${DOW[i]}<span class="dnum">${parse(d).getDate()}</span></th>`).join('')}<th>Semana</th></tr></thead>
      <tbody>${S.habits.map(h => { const w = habitWeek(h, ws); return `<tr><td class="hname"><b>${esc(h.name)}</b><small>${esc(h.target)}</small></td>${dates.map(d => `<td class="tc ${d===T?'is-today':''}"><input type="checkbox" class="ck" data-c="habit" data-id="${h.id}" data-date="${d}" ${h.log[d]?'checked':''} aria-label="${esc(h.name)} em ${fmtShort(d)}"></td>`).join('')}<td><div class="prog-cell tn-green">${bar(w.pct)}<b>${w.count}/${h.freq}</b></div></td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td>Feito no dia</td>${dates.map(d => `<td class="tc">${habitsDayPct(d)}%</td>`).join('')}<td>${hb.pct}% da meta</td></tr></tfoot>
    </table></div>` : empty('Sua rotina está vazia', 'Adicione atividades como estudo, exercício ou água.')}
  </section>
  <section class="block">
    <div class="block-head"><div><h2>Tarefas da semana</h2><p>${tk.done} de ${tk.total} concluídas. Digite em qualquer dia e pressione Enter.</p></div></div>
    <div class="task-cols">${dates.map((d, i) => { const ts = S.tasks.filter(t => t.date === d); return `<div class="tcol ${d===T?'today':''}"><h4>${cap(DOW_FULL[i].replace('-feira',''))} <span>${parse(d).getDate()}</span></h4>${classesOn(i).map(classChip).join('')}<ul class="todo">${ts.map(t => taskRow(t, {compact:true})).join('')}</ul><input class="inp-line" placeholder="+ tarefa" data-enter="quick-task" data-date="${d}" aria-label="Nova tarefa em ${fmtShort(d)}"></div>`; }).join('')}</div>
  </section>
  <section class="block">
    <div class="block-head"><div><h2>Grade de aulas</h2><p>Disciplinas e reuniões fixas aparecem sozinhas em cada dia e na agenda de hoje.</p></div><button class="btn" data-a="new-class">${I.plus}Nova aula</button></div>
    ${S.classes.length ? `<div class="tbl-wrap"><table><thead><tr><th>Disciplina ou compromisso</th><th>Dias</th><th>Horário</th><th>Local</th><th></th></tr></thead><tbody>${S.classes.slice().sort((a,b) => Math.min(...a.days) - Math.min(...b.days) || (a.start||'').localeCompare(b.start||'')).map(c => `<tr><td><b>${esc(c.name)}</b></td><td class="small">${c.days.map(x => DOW[x]).join(', ')}</td><td class="small" style="white-space:nowrap">${esc(c.start||'')}${c.end ? ' às ' + esc(c.end) : ''}</td><td class="small muted">${esc(c.place||'')}</td><td style="white-space:nowrap;text-align:right"><button class="icon-btn" data-a="edit-class" data-id="${c.id}" aria-label="Editar aula">${I.edit}</button><button class="icon-btn" data-a="del-class" data-id="${c.id}" aria-label="Excluir aula">${I.trash}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="goals-grid">${empty('Nenhuma aula cadastrada', 'Cadastre suas disciplinas e as reuniões fixas da pesquisa.')}</div>`}
  </section>
  <section class="block grid-2">
    <div class="card c-blue"><div class="card-title"><h3>Intenção da semana</h3></div><textarea class="soft-area" placeholder="Como você quer viver esta semana?" data-bind="weeks.${wk}.intention">${esc(W.intention)}</textarea></div>
    <div class="card c-blue"><div class="card-title"><h3>Reflexão de fim de semana</h3></div><textarea class="soft-area" placeholder="O que funcionou? O que levar para a próxima?" data-bind="weeks.${wk}.reflection">${esc(W.reflection)}</textarea></div>
  </section>`;
}

/* ---------- Metas ---------- */
function goalCard(g){
  const p = listPct(g.checklist), st = goalStatus(g);
  return `<article class="goal c-${g.color}">
    <div class="goal-top"><span class="tag">${esc(g.category || 'Geral')}</span>${tag(st, STATUS_CLS[st])}<div class="ms-actions"><button class="icon-btn sm" data-a="edit-goal" data-id="${g.id}" aria-label="Editar meta">${I.edit}</button><button class="icon-btn sm" data-a="del-goal" data-id="${g.id}" aria-label="Excluir meta">${I.trash}</button></div></div>
    <h3>${esc(g.title)}</h3>
    ${g.description ? `<p class="desc">${esc(g.description)}</p>` : ''}
    <div class="goal-meta"><span>Prazo ${fmtShort(g.deadline)}</span><b>${p}%</b></div>
    ${bar(p, 'dark')}
    ${checklistHTML('goal:' + g.id, g.checklist)}
  </article>`;
}
function pageGoals(){
  const mk = monthKey(V.ref), st = monthGoalsStat(mk), gs = S.goals.filter(g => g.month === mk);
  const label = `${cap(MONTHS[V.ref.getMonth()])} ${V.ref.getFullYear()}`;
  return `
  ${head('', 'Metas do mês', 'O progresso de cada meta é calculado pelas etapas concluídas do checklist.', periodNav(label, 'month'))}
  <div class="summary card"><span class="big">${st.pct}%</span><div style="flex:1;min-width:180px"><div class="small muted" style="margin-bottom:8px">${st.done} de ${st.total} etapas, ${st.complete} de ${st.goals} metas concluídas</div>${bar(st.pct, 'dark')}</div><button class="btn" data-a="new-goal">${I.plus}Nova meta</button></div>
  <div class="goals-grid">${gs.length ? gs.map(goalCard).join('') : empty('Nenhuma meta para ' + label, 'Crie a primeira meta e divida em etapas pequenas.', `<button class="btn" data-a="new-goal">${I.plus}Nova meta</button>`)}</div>`;
}

/* ---------- Tarefas ---------- */
function pageTasks(){
  const T = ymd(new Date()), in7 = ymd(addDays(new Date(), 7)), f = V.taskFilter;
  const ws = startOfWeek(new Date()), tk = tasksWeekStat(ws);
  const all = S.tasks.filter(t => f === 'todas' ? true : f === 'concluidas' ? t.done : !t.done).sort((a,b) => (a.date||'9999').localeCompare(b.date||'9999'));
  const groups = f === 'concluidas' ? [['Concluídas', all]] : [
    ['Atrasadas', all.filter(t => !t.done && t.date && t.date < T)],
    ['Hoje', all.filter(t => t.date === T)],
    ['Próximos 7 dias', all.filter(t => t.date > T && t.date <= in7)],
    ['Mais adiante', all.filter(t => t.date > in7)],
    ['Sem data', all.filter(t => !t.date)],
    ...(f === 'todas' ? [['Concluídas anteriormente', all.filter(t => t.done && t.date && t.date < T)]] : [])
  ];
  const color = {'Atrasadas':'pink','Hoje':'yellow','Próximos 7 dias':'blue','Mais adiante':'green','Sem data':'neutral','Concluídas':'green','Concluídas anteriormente':'green'};
  return `
  ${head('', 'Tarefas', `Nesta semana: ${tk.done} de ${tk.total} concluídas (${tk.pct}%).`, `<div class="seg" role="tablist">${[['pendentes','Pendentes'],['todas','Todas'],['concluidas','Concluídas']].map(([k,l]) => `<button class="${f===k?'on':''}" data-a="task-filter" data-f="${k}">${l}</button>`).join('')}</div><button class="btn" data-a="new-task">${I.plus}Nova tarefa</button>`)}
  <div class="card c-blue" style="margin-bottom:22px"><div class="prog-cell"><b style="text-align:left;min-width:0;font-family:var(--font-d);font-size:34px;font-weight:400;color:var(--tone)">${tk.pct}%</b><div style="flex:1">${bar(tk.pct,'dark')}</div><span class="small muted">progresso da semana atual</span></div>
    <div class="add-row" style="margin-top:14px;border-top:0;padding:0"><input class="inp" placeholder="Nova tarefa para hoje… (Enter para adicionar)" data-enter="quick-task" data-date="${T}" aria-label="Nova tarefa rápida"></div></div>
  ${groups.filter(([, l]) => l.length).map(([name, l]) => `<section class="block" style="margin-top:22px"><div class="block-head" style="margin-bottom:8px"><h3>${tag(name, color[name])} <span class="muted small" style="font-weight:500">${l.length}</span></h3></div><div class="card" style="padding:6px 18px"><ul class="todo">${l.map(t => taskRow(t)).join('')}</ul></div></section>`).join('') || `<div class="goals-grid">${empty('Nenhuma tarefa aqui', f === 'pendentes' ? 'Tudo em dia. Aproveite.' : 'Crie uma tarefa para começar.')}</div>`}`;
}

/* ---------- Trimestre ---------- */
function pageQuarter(){
  const qk = quarterKey(V.ref), Q = getQuarter(qk), [qs, qe] = quarterRange(qk), q = +qk.split('-T')[1];
  const now = new Date(), total = Math.round((qe - qs) / 864e5) + 1;
  const elapsed = clamp(Math.round((now - qs) / 864e5) + 1, 0, total), timePct = pctOf(elapsed, total);
  const goalsPct = Math.round(Q.goals.reduce((a, g) => a + listPct(g.checklist), 0) / 3);
  const fmtD = d => `${d.getDate()} de ${MON3[d.getMonth()]}`;
  const related = S.projects.filter(p => (p.goalRef || '').startsWith(qk + ':'));
  return `
  ${head('', 'Trimestre', 'Uma visão de 13 semanas: a intenção de cada mês, as 3 metas e os projetos que as sustentam.', periodNav(`${q}º trimestre de ${qs.getFullYear()}`, 'quarter'))}
  <div class="q-band">
    <div><div class="lbl">Trimestre atual</div><div class="val">${q}º de ${qs.getFullYear()}</div></div>
    <div><div class="lbl">Data inicial</div><div class="val">${fmtD(qs)}</div></div>
    <div><div class="lbl">Data final</div><div class="val">${fmtD(qe)}</div></div>
    <div><div class="lbl">Progresso das 3 metas</div><div class="val">${goalsPct}%</div>${bar(goalsPct,'dark')}<div class="lbl" style="margin-top:6px">${timePct}% do trimestre já passou</div></div>
  </div>
  <section class="block">
    <div class="block-head"><div><h2>Intenção de cada mês</h2></div></div>
    <div class="grid-3">${Q.months.map((m, i) => `<div class="card c-blue month-card">
      <div class="mname">${MONTHS[qs.getMonth() + i]}</div>
      <div><div class="field-lbl">Intenção</div><input class="inp-line" placeholder="Uma palavra ou frase" value="${esc(m.intention)}" data-bind="quarters.${qk}.months.${i}.intention"></div>
      <div><div class="field-lbl">Objetivo principal</div><input class="inp-line" placeholder="O que precisa acontecer" value="${esc(m.objective)}" data-bind="quarters.${qk}.months.${i}.objective"></div>
      <div><div class="field-lbl">Descrição</div><textarea class="inp-line" rows="2" style="resize:none" placeholder="Como vai ser este mês" data-bind="quarters.${qk}.months.${i}.desc">${esc(m.desc)}</textarea></div>
    </div>`).join('')}</div>
  </section>
  <section class="block">
    <div class="block-head"><div><h2>As 3 metas</h2><p>O progresso vem do checklist de cada meta.</p></div></div>
    <div class="grid-3">${Q.goals.map((g, i) => { const p = listPct(g.checklist); return `<article class="qgoal c-${g.color}">
      <div class="goal-meta"><span class="qnum">Meta ${i+1}</span><b>${p}%</b></div>
      <textarea class="title-inp" rows="2" style="resize:none" placeholder="Nome da meta" data-bind="quarters.${qk}.goals.${i}.title" aria-label="Título da meta ${i+1}">${esc(g.title)}</textarea>
      ${bar(p,'dark')}
      <div class="row2"><label><div class="field-lbl">Categoria</div><select class="inp" data-c="bind-sel" data-bind="quarters.${qk}.goals.${i}.category"><option value="">Escolher</option>${opts(CATS, g.category)}</select></label>
      <label><div class="field-lbl">Prazo</div><input type="date" class="inp" value="${g.deadline}" data-bind="quarters.${qk}.goals.${i}.deadline"></label></div>
      <div><div class="field-lbl">Checklist</div>${checklistHTML(`qgoal:${qk}:${i}`, g.checklist)}</div>
      <div><div class="field-lbl">Observações</div><textarea class="area" placeholder="Notas, obstáculos, ideias" data-bind="quarters.${qk}.goals.${i}.notes">${esc(g.notes)}</textarea></div>
    </article>`; }).join('')}</div>
  </section>
  <section class="block">
    <div class="block-head"><div><h2>Projetos ligados às metas</h2><p>Vincule projetos a uma das 3 metas ao criar ou editar.</p></div><button class="btn" data-a="new-project" data-goalref="${qk}:0">${I.plus}Projeto vinculado</button></div>
    ${related.length ? `<div class="grid-3">${Q.goals.map((g, i) => { const ps = related.filter(p => p.goalRef === `${qk}:${i}`); return `<div class="card"><div class="card-title"><h3>${esc(g.title || 'Meta ' + (i+1))}</h3><span class="note">${ps.length}</span></div>${ps.length ? ps.map(p => { const pp = projectProgress(p); return `<div class="mini-goal"><div class="row"><b>${esc(p.name)}</b>${tag(p.status, STATUS_CLS[p.status])}</div><div class="prog-cell">${bar(pp,'dark')}<b>${pp}%</b></div></div>`; }).join('') : '<p class="muted small" style="margin:0">Nenhum projeto vinculado.</p>'}</div>`; }).join('')}</div>` : `<div class="goals-grid">${empty('Nenhum projeto vinculado', 'Projetos ligados às metas aparecem aqui com seu progresso.')}</div>`}
  </section>`;
}

/* ---------- Projetos ---------- */
function pageProjects(){
  const counts = PROJ_STATUS.map(s => [s, S.projects.filter(p => p.status === s).length]);
  const pr = projectsStat();
  return `
  ${head('', 'Projetos', `${pr.done} de ${pr.n} concluídos, progresso médio de ${pr.pct}%. O progresso vem das tarefas de cada projeto.`, `<button class="btn" data-a="new-project">${I.plus}Novo projeto</button>`)}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${counts.map(([s, n]) => `<span class="tag t-${STATUS_CLS[s]}">${s}: ${n}</span>`).join('')}</div>
  ${S.projects.length ? `<div class="tbl-wrap"><table>
    <thead><tr><th>Projeto</th><th>Categoria</th><th>Status</th><th>Prazo</th><th>Progresso</th><th>Tarefas</th><th></th></tr></thead>
    <tbody>${S.projects.map(p => {
      const ts = S.tasks.filter(t => t.projectId === p.id), pp = projectProgress(p), open = V.openProject === p.id;
      const goal = p.goalRef ? (() => { const [qk, i] = p.goalRef.split(':'); const g = S.quarters[qk]?.goals[+i]; return g ? (g.title || `Meta ${+i+1}`) : ''; })() : '';
      return `<tr class="row-click" data-a="toggle-project" data-id="${p.id}">
        <td><b>${esc(p.name)}</b>${goal ? `<div class="small muted">Meta: ${esc(goal)}</div>` : ''}</td>
        <td>${tag(p.category || 'Geral', catColor(p.category))}</td>
        <td data-stop="1">${statusSelect(p)}</td>
        <td class="small">${fmtShort(p.deadline)}</td>
        <td><div class="prog-cell tn-pink">${bar(pp,'dark')}<b>${pp}%</b></div></td>
        <td class="small">${ts.filter(t=>t.done).length}/${ts.length}</td>
        <td data-stop="1" style="white-space:nowrap"><button class="icon-btn" data-a="edit-project" data-id="${p.id}" aria-label="Editar projeto">${I.edit}</button><button class="icon-btn" data-a="del-project" data-id="${p.id}" aria-label="Excluir projeto">${I.trash}</button><button class="icon-btn" data-a="toggle-project" data-id="${p.id}" aria-label="Ver tarefas" style="transform:rotate(${open?180:0}deg)">${I.chevDown}</button></td>
      </tr>${open ? `<tr class="expand"><td colspan="7"><div class="expand-inner">
        <div><div class="field-lbl" style="margin-bottom:6px">Tarefas do projeto</div>${ts.length ? `<ul class="todo">${ts.map(t => taskRow(t, {noProject:true})).join('')}</ul>` : '<p class="muted small">Nenhuma tarefa ainda.</p>'}
        <div class="add-row"><input class="inp-line" placeholder="Nova tarefa do projeto e Enter" data-enter="project-task" data-id="${p.id}"></div></div>
        <div><div class="field-lbl" style="margin-bottom:6px">Notas</div><textarea class="area" placeholder="Contexto, links, próximos passos" data-bind="projects.${S.projects.indexOf(p)}.notes">${esc(p.notes)}</textarea></div>
      </div></td></tr>` : ''}`;
    }).join('')}</tbody></table></div>` : `<div class="goals-grid">${empty('Nenhum projeto ainda', 'Crie um projeto e adicione as tarefas que o compõem.', `<button class="btn" data-a="new-project">${I.plus}Novo projeto</button>`)}</div>`}`;
}

/* ---------- Hábitos ---------- */
function pageHabits(){
  const ws = startOfWeek(V.ref), dates = weekDates(ws), T = ymd(new Date());
  const hb = habitWeekStat(ws);
  const rate = S.habits.length ? Math.round(S.habits.reduce((a, h) => a + habitRate30(h), 0) / S.habits.length) : 0;
  const mo = S.habits.length ? Math.round(S.habits.reduce((a, h) => a + habitMonth(h, V.ref).pct, 0) / S.habits.length) : 0;
  const best = S.habits.reduce((a, h) => { const s = streak(h); return s > a.s ? {s, n:h.name} : a; }, {s:0, n:''});
  const n = daysInMonth(V.ref), mDates = Array.from({length:n}, (_, i) => ymd(new Date(V.ref.getFullYear(), V.ref.getMonth(), i+1)));
  const kp = (color, val, title, desc, unit='%') => `<div class="kpi static c-${color}"><div class="kpi-pct">${val}<small>${unit}</small></div><div class="kpi-title">${title}</div><div class="kpi-desc">${desc}</div>${unit==='%' ? bar(val) : ''}</div>`;
  return `
  ${head('', 'Hábitos', 'Cada marcação atualiza a sequência, a taxa de conclusão e o painel inicial.', `${periodNav(weekLabel(ws), 'week')}<button class="btn" data-a="new-habit">${I.plus}Novo hábito</button>`)}
  <section class="kpis three">
    ${kp('green', hb.pct, 'Progresso semanal', `${hb.done} de ${hb.exp} check-ins`)}
    ${kp('blue', mo, 'Progresso mensal', `média em ${MONTHS[V.ref.getMonth()]}`)}
    ${kp('yellow', rate, 'Taxa de conclusão', 'últimos 30 dias')}
    ${kp('pink', best.s, 'Maior sequência', best.n ? esc(best.n) : 'comece hoje', best.s === 1 ? ' dia' : ' dias')}
  </section>
  <section class="block">
    ${S.habits.length ? `<div class="tbl-wrap"><table>
      <thead><tr><th>Hábito</th><th>Frequência</th><th>Meta</th>${dates.map((d, i) => `<th class="tc ${d===T?'is-today':''}">${DOW[i]}<span class="dnum">${parse(d).getDate()}</span></th>`).join('')}<th>Semana</th><th>Mês</th><th>Sequência</th><th></th></tr></thead>
      <tbody>${S.habits.map(h => { const w = habitWeek(h, ws), m = habitMonth(h, V.ref), s = streak(h); return `<tr>
        <td style="white-space:nowrap"><b>${esc(h.name)}</b></td><td class="small" style="white-space:nowrap">${h.freq === 7 ? 'Diário' : h.freq + 'x/semana'}</td><td class="small muted">${esc(h.target)}</td>
        ${dates.map(d => `<td class="tc ${d===T?'is-today':''}"><input type="checkbox" class="ck" data-c="habit" data-id="${h.id}" data-date="${d}" ${h.log[d]?'checked':''} aria-label="${esc(h.name)} em ${fmtShort(d)}"></td>`).join('')}
        <td><div class="prog-cell tn-green">${bar(w.pct)}<b>${w.pct}%</b></div></td>
        <td class="small">${m.count}/${m.expected}</td>
        <td style="white-space:nowrap"><span class="paw">${I.paw}</span> <span class="streak">${s}</span> <span class="small muted">${s===1?'dia':'dias'}</span></td>
        <td style="white-space:nowrap"><button class="icon-btn" data-a="edit-habit" data-id="${h.id}" aria-label="Editar hábito">${I.edit}</button><button class="icon-btn" data-a="del-habit" data-id="${h.id}" aria-label="Excluir hábito">${I.trash}</button></td>
      </tr>`; }).join('')}</tbody></table></div>` : `<div class="goals-grid">${empty('Nenhum hábito ainda', 'Comece com um ou dois hábitos simples.', `<button class="btn" data-a="new-habit">${I.plus}Novo hábito</button>`)}</div>`}
  </section>
  ${S.habits.length ? `<section class="block">
    <div class="block-head"><div><h2>Dias realizados em ${MONTHS[V.ref.getMonth()]}</h2><p>Clique em qualquer dia para marcar ou desmarcar.</p></div></div>
    <div class="tbl-wrap"><table class="heat-wrap"><thead><tr><th style="min-width:150px">Hábito</th><th style="width:100%"><div class="heat-head" style="grid-template-columns:repeat(${n},minmax(14px,1fr))">${mDates.map(d => `<span>${parse(d).getDate()}</span>`).join('')}</div></th><th>Total</th></tr></thead>
    <tbody>${S.habits.map(h => `<tr><td class="small"><b>${esc(h.name)}</b></td><td><div class="heat" style="grid-template-columns:repeat(${n},minmax(14px,1fr))">${mDates.map(d => `<button class="${h.log[d]?'on':''} ${d>T?'future':''} ${d===T?'today':''}" data-a="heat" data-id="${h.id}" data-date="${d}" aria-label="${esc(h.name)} em ${fmtShort(d)}" aria-pressed="${!!h.log[d]}"></button>`).join('')}</div></td><td class="small">${habitCountIn(h, mDates)}</td></tr>`).join('')}</tbody></table></div>
  </section>` : ''}`;
}

/* ---------- Modo viagem / Roda da vida ---------- */
function radarSVG(){
  const n = WHEEL.length, cx = 260, cy = 230, R = 165;
  const pt = (i, r) => { const a = (-90 + i * 360 / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = r => WHEEL.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');
  const rings = [2,4,6,8,10].map(v => `<polygon points="${poly(R * v / 10)}" fill="${v===10?'var(--surface-2)':'none'}" stroke="var(--line)" stroke-width="1"/>`).join('');
  const axes = WHEEL.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`; }).join('');
  const data = WHEEL.map((c, i) => pt(i, R * clamp(+S.wheel[c].score, 0, 10) / 10));
  const labels = WHEEL.map((c, i) => { const [x, y] = pt(i, R + 26); const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'; return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" fill="var(--ink-2)" font-family="var(--font-b)">${esc(WHEEL_SHORT[c] || c)} <tspan font-weight="700" fill="var(--ink)">${S.wheel[c].score}</tspan></text>`; }).join('');
  const nums = [2,4,6,8,10].map(v => `<text x="${cx + 4}" y="${(cy - R * v / 10 + 11).toFixed(1)}" font-size="9.5" fill="var(--ink-3)" font-family="var(--font-b)">${v}</text>`).join('');
  return `<svg viewBox="0 0 520 460" role="img" aria-label="Gráfico radar da Roda da Vida">${rings}${axes}${nums}
    <polygon points="${data.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="var(--green-deep)" fill-opacity=".45" stroke="var(--green-ink)" stroke-width="2" stroke-linejoin="round"/>
    ${data.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--surface)" stroke="var(--green-ink)" stroke-width="2"/>`).join('')}
    ${labels}</svg>`;
}
function wheelStats(){
  const sc = WHEEL.map(c => +S.wheel[c].score), avg = sc.reduce((a, b) => a + b, 0) / sc.length;
  const low = WHEEL.filter(c => S.wheel[c].score <= 5).length;
  return { avg: avg.toFixed(1).replace('.', ','), low };
}
function pageTrip(){
  const tr = S.trip, today = startDay(); let cd = '…', cdl = 'defina a data de ida';
  if (tr.start){
    const st = parse(tr.start), e = tr.end ? parse(tr.end) : st, days = Math.round((st - today) / 864e5);
    if (days > 0){ cd = days; cdl = days === 1 ? 'dia para embarcar' : 'dias para embarcar'; }
    else if (today <= e){ cd = 'Lá fora!'; cdl = 'intercâmbio acontecendo'; }
    else { cd = 'De volta'; cdl = 'hora de revisar a roda da vida'; }
  }
  const ws = wheelStats(), p = listPct(tr.checklist);
  return `
  ${head('', 'Intercâmbio', 'O semestre que vem começa a ser construído agora: documentos, contagem regressiva e uma Roda da Vida para levar na mala.')}
  <div class="card c-blue trip-head">
    <label><div class="field-lbl">Destino e universidade</div><input class="trip-name" placeholder="Cidade, país, universidade" value="${esc(tr.name)}" data-bind="trip.name"></label>
    <label><div class="field-lbl">Ida</div><input type="date" class="inp" value="${tr.start}" data-c="rerender" data-bind="trip.start"></label>
    <label><div class="field-lbl">Volta</div><input type="date" class="inp" value="${tr.end}" data-c="rerender" data-bind="trip.end"></label>
    <div><div class="countdown">${cd}</div><div class="small muted">${cdl}</div></div>
  </div>
  <section class="block grid-2">
    <div class="card c-yellow"><div class="card-title"><h3>Preparação</h3><span class="note">${tr.checklist.filter(i=>i.done).length} de ${tr.checklist.length} itens, ${p}%</span></div>${bar(p,'dark')}<div style="margin-top:12px">${checklistHTML('trip', tr.checklist)}</div></div>
    <div class="card c-pink"><div class="card-title"><h3>Notas do intercâmbio</h3></div><textarea class="area soft-in" style="min-height:300px" placeholder="Disciplinas para aproveitar, contatos, quem cuida dos gatos, medos, sonhos…" data-bind="trip.notes">${esc(tr.notes)}</textarea></div>
  </section>
  <section class="block">
    <div class="block-head"><div><h2>Roda da Vida</h2><p>Dê uma nota de 0 a 10 para cada área. O gráfico muda na hora. Vale refazer antes de ir e depois de voltar.</p></div></div>
    <div class="trip-grid">
      <div class="card radar-card"><div id="radar">${radarSVG()}</div>
        <div class="radar-avg"><div><b id="w-avg">${ws.avg}</b><span>nota média</span></div><div><b id="w-low">${ws.low}</b><span>áreas com nota até 5</span></div></div></div>
      <div class="tbl-wrap"><table class="wheel-tbl"><thead><tr><th>Área</th><th>Nota</th><th>Status</th><th>Observação</th></tr></thead>
        <tbody>${WHEEL.map((c, i) => { const [l, col] = wheelLevel(S.wheel[c].score); return `<tr><td class="small"><b>${esc(c)}</b></td>
          <td><div class="score"><input type="range" min="0" max="10" step="1" value="${S.wheel[c].score}" data-i="wheel" data-w="${i}" aria-label="Nota de ${esc(c)}"><b data-wn="${i}">${S.wheel[c].score}</b></div></td>
          <td data-ws="${i}">${tag(l, col)}</td>
          <td><input class="inp-line small" placeholder="Anotar…" value="${esc(S.wheel[c].note)}" data-bind="wheel.${c}.note" style="min-width:110px"></td></tr>`; }).join('')}</tbody></table></div>
    </div>
  </section>`;
}

/* ---------- Gatos ---------- */
function pageCats(){
  const T = ymd(new Date()), m = S.memorial, tones = ['pink','blue','green','yellow'];
  const lookOpts = v => Object.entries(LOOKS).map(([k, o]) => `<option value="${k}" ${k===v?'selected':''}>${o.label}</option>`).join('');
  return `
  ${head('', 'Gatos', (S.cats.length ? `O cantinho de ${S.cats.map(c => c.name).join(' e ').replace(/ e (?=[^e]* e )/g, ', ')}` : 'Um cantinho para os seus gatos') + (m.name ? `, e um lugar guardado para ${m.name}.` : '.'), `<button class="btn" data-a="new-cat">${I.plus}Novo gato</button>`)}
  <div class="cats-grid">${S.cats.map((c, i) => `<article class="card c-${tones[i % 4]} cat-card">
    <div class="cat-top">${catSVG(c.look)}<div style="flex:1;min-width:0">
      <input class="cat-name" value="${esc(c.name)}" data-bind="cats.${i}.name" aria-label="Nome do gato">
      <input class="inp-line small" value="${esc(c.desc)}" placeholder="Um jeitinho dela ou dele" data-bind="cats.${i}.desc" aria-label="Descrição">
      <select class="look-sel" data-c="rerender" data-bind="cats.${i}.look" aria-label="Pelagem">${lookOpts(c.look)}</select></div>
      <button class="icon-btn sm" data-a="del-cat" data-id="${c.id}" aria-label="Remover ${esc(c.name)}" style="align-self:flex-start">${I.trash}</button></div>
    <div><div class="field-lbl">Saúde</div><div class="health">${HEALTH.map(([k, l]) => { const [txt, col] = healthInfo(c[k]); return `<label>${l}<input type="date" class="inp" value="${c[k] || ''}" data-c="rerender" data-bind="cats.${i}.${k}">${tag(txt, col)}</label>`; }).join('')}</div></div>
    <div><div class="field-lbl">Anotações</div><textarea class="area soft-in" style="min-height:64px" placeholder="Ração, veterinário, manias, quem cuida durante o intercâmbio" data-bind="cats.${i}.notes">${esc(c.notes)}</textarea></div>
  </article>`).join('') || empty('Nenhum gato cadastrado', 'Adicione a Phoebe, o Peleguinho ou quem mais chegar.')}</div>
  <section class="block grid-2">
    <div class="card c-green"><div class="card-title"><h3>Cuidados de hoje</h3><span class="note">${careCount(T)}/${S.catCare.items.length}</span></div>
      ${careList(T, true)}
      <div class="add-row"><input class="inp-line" placeholder="Novo cuidado diário e Enter" data-enter="add-care" aria-label="Novo cuidado"><button class="icon-btn sm" data-a="add-care" aria-label="Adicionar cuidado">${I.plus}</button></div>
    </div>
    <div class="card c-yellow memorial">${catSVG(m.look || 'manteiga')}
      <div><div class="field-lbl">${I.star} Para sempre</div>
        <input class="cat-name" value="${esc(m.name)}" placeholder="Nome" data-bind="memorial.name" data-live="sidebar" aria-label="Nome">
        <select class="look-sel" data-c="rerender" data-bind="memorial.look" aria-label="Pelagem">${lookOpts(m.look || 'manteiga')}</select>
        <textarea class="soft-area" style="font-size:21px;min-height:90px;margin-top:8px" placeholder="Uma lembrança" data-bind="memorial.text">${esc(m.text)}</textarea></div>
    </div>
  </section>`;
}

/* ---------- Aparência ---------- */
function pageLook(){
  return `
  ${head('', 'Aparência', 'Escolha a paleta do seu planner. A mudança vale para todas as páginas e fica salva.')}
  <div class="themes">${THEMES.map(t => `<button class="theme ${S.palette===t.id?'on':''}" data-a="theme" data-id="${t.id}" aria-pressed="${S.palette===t.id}">
    <div class="theme-prev"><div class="s" style="background:${t.s}"></div><div class="b" style="background:${t.bg}">${t.c.map(c => `<i style="background:${c}"></i>`).join('')}</div>${t.look ? `<span class="theme-cat">${catSVG(t.look, '')}</span>` : ''}</div>
    <div><b>${t.name}</b><small>${t.desc}</small></div></button>`).join('')}</div>
  <section class="block grid-2">
    <div class="card"><div class="card-title"><h3>Personalização</h3></div>
      <div class="form"><label class="full">Nome do planner<input class="inp" value="${esc(S.appName)}" data-bind="appName" data-live="sidebar" placeholder="Ronrom"></label><label class="full">Seu nome<input class="inp" value="${esc(S.name)}" data-bind="name" data-live="sidebar" placeholder="Como você quer ser chamada?"></label>
      <label class="full">Frase do painel<input class="inp" value="${esc(S.mantra)}" data-bind="mantra" placeholder="Deixe vazio para ver uma frase diferente por dia"></label></div></div>
    <div class="card"><div class="card-title"><h3>Seus dados</h3></div>
      <p class="small muted" style="margin-top:0">Conectada como <b>${esc(USER?.email || '')}</b>. Tudo é salvo sozinho na sua conta e aparece igual no celular e no computador. O backup é uma cópia extra, só por garantia.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" data-a="backup">Backup e restauração</button><button class="btn btn-ghost" data-a="reset-sample">Restaurar exemplo</button><button class="btn btn-danger" data-a="reset-blank">Começar do zero</button><button class="btn btn-ghost" data-a="logout">Sair da conta</button></div></div>
  </section>`;
}

const PAGES = { home:pageHome, week:pageWeek, goals:pageGoals, tasks:pageTasks, quarter:pageQuarter, projects:pageProjects, habits:pageHabits, trip:pageTrip, cats:pageCats, look:pageLook };

function render(){
  document.documentElement.setAttribute('data-palette', S.palette);
  try { localStorage.setItem('ronrom-palette', S.palette); } catch(e){}
  document.title = `${S.appName || 'Ronrom'} · planner da ${S.name || 'você'}`;
  renderSidebar();
  $('#page').innerHTML = PAGES[V.page]();
}
function rerender(){ const y = window.scrollY; render(); window.scrollTo(0, y); save(); }

/* =========================================================
   MODALS
   ========================================================= */
let modalSave = null;
function openForm(title, fields, onSave, saveLabel='Salvar'){
  const f = fields.map(x => {
    const cls = x.full ? 'full' : '';
    if (x.type === 'textarea') return `<label class="${cls}">${x.label}<textarea class="area" name="${x.name}" placeholder="${esc(x.ph||'')}">${esc(x.value||'')}</textarea></label>`;
    if (x.type === 'days') return `<div class="full"><div style="font-size:13px;color:var(--ink-2);font-weight:500;margin-bottom:6px">Dias da semana</div><div class="days-pick">${DOW.map((d, i) => `<label><input type="checkbox" class="ck" name="d${i}" ${(x.value || []).includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>`;
    if (x.type === 'select') return `<label class="${cls}">${x.label}<select class="sel" name="${x.name}">${opts(x.options, x.value)}</select></label>`;
    return `<label class="${cls}">${x.label}<input class="inp" type="${x.type||'text'}" name="${x.name}" value="${esc(x.value ?? '')}" placeholder="${esc(x.ph||'')}" ${x.min!=null?`min="${x.min}"`:''} ${x.max!=null?`max="${x.max}"`:''} ${x.list?`list="${x.list}"`:''}></label>`;
  }).join('');
  $('#modal-root').innerHTML = `<div class="overlay" data-a="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${title}</h2>
    <datalist id="cats">${CATS.map(c => `<option value="${c}">`).join('')}</datalist>
    <div class="form">${f}</div><div class="modal-actions"><button class="btn btn-ghost" data-a="close">Cancelar</button><button class="btn" data-a="modal-save">${saveLabel}</button></div></div></div>`;
  modalSave = onSave;
  setTimeout(() => $('#modal-root [name]')?.focus(), 30);
}
function confirmBox(msg, onYes, yes='Excluir'){
  $('#modal-root').innerHTML = `<div class="overlay" data-a="overlay"><div class="modal" role="alertdialog" aria-modal="true" style="width:min(420px,100%)"><h2>Tem certeza?</h2><p class="muted" style="margin:-6px 0 0">${msg}</p><div class="modal-actions"><button class="btn btn-ghost" data-a="close">Cancelar</button><button class="btn btn-danger" data-a="modal-save">${yes}</button></div></div></div>`;
  modalSave = () => { onYes(); return true; };
}
function closeModal(){ $('#modal-root').innerHTML = ''; modalSave = null; }
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }

const goalForm = (g = {}) => [
  {name:'title', label:'Título da meta', value:g.title, full:true, ph:'Ex.: Concluir o curso'},
  {name:'category', label:'Categoria', value:g.category, list:'cats', ph:'Estudos'},
  {name:'deadline', label:'Prazo', type:'date', value:g.deadline},
  {name:'description', label:'Descrição', type:'textarea', value:g.description, full:true, ph:'Por que isso importa?'},
  {name:'color', label:'Cor do cartão', type:'select', options:COLORS, value:g.color || 'yellow'},
  {name:'paused', label:'Status', type:'select', options:[['no','Automático pelo checklist'],['yes','Pausada']], value:g.paused ? 'yes' : 'no'},
  ...(g.id ? [] : [{name:'items', label:'Etapas do checklist (uma por linha)', type:'textarea', full:true, ph:'Aula 1\nAula 2\nAula 3'}])
];
const projectGoalOptions = () => {
  const qk = quarterKey(V.ref), Q = getQuarter(qk);
  return [['','Nenhuma'], ...Q.goals.map((g, i) => [`${qk}:${i}`, `Trimestre: ${g.title || 'Meta ' + (i+1)}`])];
};
const projectForm = (p = {}) => [
  {name:'name', label:'Nome do projeto', value:p.name, full:true},
  {name:'category', label:'Categoria', value:p.category, list:'cats'},
  {name:'status', label:'Status', type:'select', options:PROJ_STATUS, value:p.status || 'Não iniciado'},
  {name:'deadline', label:'Prazo', type:'date', value:p.deadline},
  {name:'goalRef', label:'Meta vinculada', type:'select', options:(() => { const o = projectGoalOptions(); if (p.goalRef && !o.find(x => x[0] === p.goalRef)) o.push([p.goalRef, 'Meta de outro trimestre']); return o; })(), value:p.goalRef || ''},
  {name:'notes', label:'Notas', type:'textarea', value:p.notes, full:true}
];
const taskForm = (t = {}) => [
  {name:'title', label:'Tarefa', value:t.title, full:true},
  {name:'date', label:'Data', type:'date', value:t.date ?? ymd(new Date())},
  {name:'priority', label:'Prioridade', type:'select', options:['Baixa','Média','Alta'], value:t.priority || 'Média'},
  {name:'projectId', label:'Projeto', type:'select', options:[['','Nenhum'], ...S.projects.map(p => [p.id, p.name])], value:t.projectId || '', full:true}
];
const habitForm = (h = {}) => [
  {name:'name', label:'Nome do hábito', value:h.name, full:true, ph:'Ex.: Leitura'},
  {name:'freq', label:'Frequência', type:'select', options:[7,6,5,4,3,2,1].map(n => [String(n), n === 7 ? 'Todos os dias' : n + 'x por semana']), value:String(h.freq || 7)},
  {name:'target', label:'Meta', value:h.target, ph:'Ex.: 20 páginas'}
];
const msForm = (m = {}) => [
  {name:'title', label:'Marco', value:m.title, full:true},
  {name:'category', label:'Categoria', value:m.category, list:'cats'},
  {name:'deadline', label:'Prazo', type:'date', value:m.deadline},
  {name:'progress', label:'Progresso (%)', type:'number', min:0, max:100, value:m.progress ?? 0}
];
const classForm = (c = {}) => [
  {name:'name', label:'Disciplina ou compromisso', value:c.name, full:true, ph:'Ex.: Engenharia de Reservatórios'},
  {name:'start', label:'Início', type:'time', value:c.start || '08:00'},
  {name:'end', label:'Fim', type:'time', value:c.end || '10:00'},
  {name:'place', label:'Local', value:c.place, full:true, ph:'Sala, prédio ou link'},
  {name:'days', type:'days', value:c.days || []}
];
function saveClass(c, v){
  const days = [0,1,2,3,4,5,6].filter(i => v['d' + i]);
  if (!v.name || !days.length){ toast('Informe o nome e pelo menos um dia'); return false; }
  const o = {name:v.name, start:v.start, end:v.end, place:v.place, days};
  if (c) Object.assign(c, o); else S.classes.push({id:uid(), ...o});
  toast(c ? 'Aula atualizada' : 'Aula adicionada');
}
function addCare(input){
  const text = (input?.value || '').trim(); if (!text) return;
  S.catCare.items.push({id:uid(), text}); rerender();
  document.querySelector('[data-enter="add-care"]')?.focus();
}
const readForm = () => { const o = {}; document.querySelectorAll('#modal-root [name]').forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim()); return o; };

/* =========================================================
   ACTIONS
   ========================================================= */
const findTask = id => S.tasks.find(t => t.id === id);
const ACTIONS = {
  nav: el => { V.page = el.dataset.page; S.page = V.page; V.openProject = null; render(); window.scrollTo(0, 0); save(); },
  prev: el => shift(el.dataset.unit, -1),
  next: el => shift(el.dataset.unit, 1),
  today: () => { V.ref = new Date(); rerender(); },
  overlay: (el, e) => { if (e.target === el) closeModal(); },
  close: closeModal,
  'modal-save': () => { if (modalSave && modalSave(readForm()) !== false) { closeModal(); rerender(); } },

  'new-ms': () => openForm('Novo marco', msForm(), v => { if (!v.title) return false; S.milestones.push({id:uid(), month:monthKey(V.ref), title:v.title, category:v.category, deadline:v.deadline, progress:clamp(+v.progress||0,0,100)}); toast('Marco criado'); }),
  'edit-ms': el => { const m = S.milestones.find(x => x.id === el.dataset.id); openForm('Editar marco', msForm(m), v => { if (!v.title) return false; Object.assign(m, v, {progress:clamp(+v.progress||0,0,100)}); toast('Marco atualizado'); }); },
  'del-ms': el => confirmBox('O marco será removido.', () => { S.milestones = S.milestones.filter(x => x.id !== el.dataset.id); toast('Marco excluído'); }),

  'new-goal': () => openForm('Nova meta', goalForm(), v => {
    if (!v.title) return false;
    S.goals.push({id:uid(), month:monthKey(V.ref), title:v.title, category:v.category, description:v.description, deadline:v.deadline, color:v.color, paused:v.paused==='yes',
      checklist:(v.items||'').split('\n').map(s => s.trim()).filter(Boolean).map(text => ({id:uid(), text, done:false}))});
    toast('Meta criada');
  }, 'Criar meta'),
  'edit-goal': el => { const g = S.goals.find(x => x.id === el.dataset.id); openForm('Editar meta', goalForm(g), v => { if (!v.title) return false; Object.assign(g, {title:v.title, category:v.category, description:v.description, deadline:v.deadline, color:v.color, paused:v.paused==='yes'}); toast('Meta atualizada'); }); },
  'del-goal': el => confirmBox('A meta e o checklist dela serão removidos.', () => { S.goals = S.goals.filter(x => x.id !== el.dataset.id); toast('Meta excluída'); }),
  'add-check': el => addCheck(el.dataset.t, el.parentElement.querySelector('input')),
  'del-check': el => { const l = getList(el.dataset.t); const i = l.findIndex(x => x.id === el.dataset.id); if (i > -1) l.splice(i, 1); rerender(); },

  'new-task': () => openForm('Nova tarefa', taskForm(), v => { if (!v.title) return false; S.tasks.push({id:uid(), title:v.title, date:v.date, done:false, projectId:v.projectId, priority:v.priority}); toast('Tarefa criada'); }, 'Criar tarefa'),
  'edit-task': el => { const t = findTask(el.dataset.id); openForm('Editar tarefa', taskForm(t), v => { if (!v.title) return false; Object.assign(t, v); toast('Tarefa atualizada'); }); },
  'del-task': el => confirmBox('A tarefa será removida.', () => { S.tasks = S.tasks.filter(t => t.id !== el.dataset.id); toast('Tarefa excluída'); }),
  'task-filter': el => { V.taskFilter = el.dataset.f; rerender(); },

  'new-habit': () => openForm('Novo hábito', habitForm(), v => { if (!v.name) return false; S.habits.push({id:uid(), name:v.name, freq:+v.freq, target:v.target, log:{}}); toast('Hábito criado'); }, 'Criar hábito'),
  'edit-habit': el => { const h = S.habits.find(x => x.id === el.dataset.id); openForm('Editar hábito', habitForm(h), v => { if (!v.name) return false; Object.assign(h, {name:v.name, freq:+v.freq, target:v.target}); toast('Hábito atualizado'); }); },
  'del-habit': el => confirmBox('O hábito e todo o histórico de dias serão removidos.', () => { S.habits = S.habits.filter(x => x.id !== el.dataset.id); toast('Hábito excluído'); }),
  heat: el => { toggleHabit(el.dataset.id, el.dataset.date); rerender(); },

  'new-project': el => openForm('Novo projeto', projectForm({goalRef: el.dataset.goalref || ''}), v => { if (!v.name) return false; S.projects.push({id:uid(), ...v}); toast('Projeto criado'); }, 'Criar projeto'),
  'edit-project': el => { const p = S.projects.find(x => x.id === el.dataset.id); openForm('Editar projeto', projectForm(p), v => { if (!v.name) return false; Object.assign(p, v); toast('Projeto atualizado'); }); },
  'del-project': el => confirmBox('O projeto será removido. As tarefas ligadas a ele continuam na lista de tarefas.', () => { const id = el.dataset.id; S.projects = S.projects.filter(x => x.id !== id); S.tasks.forEach(t => { if (t.projectId === id) t.projectId = ''; }); toast('Projeto excluído'); }),
  'toggle-project': (el, e) => { if (e.target.closest('[data-stop]') && !e.target.closest('[data-a="toggle-project"].icon-btn')) return; V.openProject = V.openProject === el.dataset.id ? null : el.dataset.id; rerender(); },

  'new-class': () => openForm('Nova aula', classForm(), v => saveClass(null, v), 'Adicionar'),
  'edit-class': el => { const c = S.classes.find(x => x.id === el.dataset.id); openForm('Editar aula', classForm(c), v => saveClass(c, v)); },
  'del-class': el => confirmBox('A aula sai da grade semanal.', () => { S.classes = S.classes.filter(x => x.id !== el.dataset.id); toast('Aula removida'); }),
  'new-cat': () => openForm('Novo gato', [{name:'name', label:'Nome', full:true}, {name:'look', label:'Pelagem', type:'select', options:Object.entries(LOOKS).map(([k, o]) => [k, o.label]), value:'caramelo'}, {name:'desc', label:'Descrição', ph:'Um jeitinho'}], v => { if (!v.name) return false; S.cats.push({id:uid(), name:v.name, look:v.look, desc:v.desc, vacina:'', vermifugo:'', antipulgas:'', notes:''}); toast('Gato adicionado'); }, 'Adicionar'),
  'del-cat': el => confirmBox('Os dados deste gato saem do planner.', () => { S.cats = S.cats.filter(x => x.id !== el.dataset.id); }, 'Remover'),
  'add-care': el => addCare(el.parentElement.querySelector('input')),
  'del-care': el => { S.catCare.items = S.catCare.items.filter(x => x.id !== el.dataset.id); rerender(); },
  logout: async () => { await saveNow(); onLogout?.(); },
  'ob-sample': () => { const keep = {name:S.name, palette:S.palette}; S = normalize(seed()); if (keep.name) S.name = keep.name; S.palette = keep.palette; S.onboarding = false; rerender(); toast('Exemplos carregados'); },
  'ob-blank': () => { S.onboarding = false; rerender(); },
  'ob-legacy': () => { const d = legacyData(); if (!d) return; S = normalize(d); S.onboarding = false; rerender(); toast('Seus dados vieram junto'); },
  theme: el => { S.palette = el.dataset.id; rerender(); toast('Tema aplicado'); },
  backup: () => {
    $('#modal-root').innerHTML = `<div class="overlay" data-a="overlay"><div class="modal" role="dialog" aria-modal="true"><h2>Backup e restauração</h2>
      <p class="small muted" style="margin-top:-8px">Copie o texto abaixo e guarde em um lugar seguro. Para restaurar, cole um backup aqui e clique em Restaurar.</p>
      <textarea class="area" id="bk" style="min-height:220px;font-size:12px;font-family:ui-monospace,Menlo,monospace">${esc(JSON.stringify(S))}</textarea>
      <div class="modal-actions"><button class="btn btn-ghost" data-a="close">Fechar</button><button class="btn btn-ghost" data-a="bk-select">Selecionar tudo</button><button class="btn" data-a="bk-restore">Restaurar</button></div></div></div>`;
  },
  'bk-select': () => { const t = $('#bk'); t.focus(); t.select(); try { navigator.clipboard?.writeText(t.value).then(() => toast('Backup copiado')).catch(() => {}); } catch(e){} },
  'bk-restore': () => { try { const d = JSON.parse($('#bk').value); if (!d || typeof d !== 'object' || !Array.isArray(d.goals)) throw 0; S = normalize(d); closeModal(); saveNow(); V.page = 'home'; render(); toast('Dados restaurados'); } catch(e){ toast('Esse texto não é um backup válido'); } },
  'reset-sample': () => confirmBox('Seus dados atuais serão substituídos pelos dados de exemplo.', () => { const nm = S.name; S = normalize(seed()); if (nm) S.name = nm; S.page = 'look'; saveNow(); toast('Exemplo restaurado'); }, 'Restaurar'),
  'reset-blank': () => confirmBox('Todas as metas, tarefas, hábitos e projetos serão apagados. Não é possível desfazer.', () => { const keep = {name:S.name, palette:S.palette}; S = normalize(Object.assign(blankState(), keep, {page:'look'})); saveNow(); toast('Planner zerado'); }, 'Apagar tudo'),
};
function shift(unit, dir){
  const r = V.ref;
  if (unit === 'week') V.ref = addDays(r, 7 * dir);
  else if (unit === 'month') V.ref = new Date(r.getFullYear(), r.getMonth() + dir, 1);
  else if (unit === 'quarter') V.ref = new Date(r.getFullYear(), r.getMonth() + 3 * dir, 1);
  rerender();
}
function toggleHabit(id, date){ const h = S.habits.find(x => x.id === id); if (!h) return; if (h.log[date]) delete h.log[date]; else h.log[date] = true; }
function addCheck(t, input){
  const text = (input?.value || '').trim(); if (!text) return;
  const l = getList(t); if (!l) return;
  l.push({id:uid(), text, done:false}); rerender();
  document.querySelector(`[data-enter="add-check"][data-t="${t}"]`)?.focus();
}

const CHANGES = {
  check: el => { const it = getList(el.dataset.t)?.find(x => x.id === el.dataset.id); if (it) it.done = el.checked; rerender(); },
  task: el => { const t = findTask(el.dataset.id); if (t) t.done = el.checked; rerender(); },
  habit: el => { const h = S.habits.find(x => x.id === el.dataset.id); if (h){ if (el.checked) h.log[el.dataset.date] = true; else delete h.log[el.dataset.date]; } rerender(); },
  prio: el => { getWeek(el.dataset.wk).priorities[+el.dataset.i].done = el.checked; rerender(); },
  'proj-status': el => { const p = S.projects.find(x => x.id === el.dataset.id); if (p) p.status = el.value; rerender(); },
  'bind-sel': () => rerender(),
  rerender: () => rerender(),
  care: el => { const l = S.catCare.log[el.dataset.date] || (S.catCare.log[el.dataset.date] = {}); if (el.checked) l[el.dataset.id] = true; else delete l[el.dataset.id]; rerender(); },
  'trip-date': () => rerender(),
};
const INPUTS = {
  ms: el => { const m = S.milestones.find(x => x.id === el.dataset.id); if (!m) return; m.progress = +el.value; const l = document.querySelector(`[data-ms-label="${m.id}"]`); if (l) l.textContent = m.progress + '%'; save(); },
  wheel: el => {
    const i = +el.dataset.w, c = WHEEL[i]; S.wheel[c].score = +el.value;
    document.querySelector(`[data-wn="${i}"]`).textContent = el.value;
    const [l, col] = wheelLevel(+el.value); document.querySelector(`[data-ws="${i}"]`).innerHTML = tag(l, col);
    $('#radar').innerHTML = radarSVG(); const ws = wheelStats(); $('#w-avg').textContent = ws.avg; $('#w-low').textContent = ws.low; save();
  },
};
const ENTERS = {
  'add-check': el => addCheck(el.dataset.t, el),
  'quick-task': el => { const v = el.value.trim(); if (!v) return; S.tasks.push({id:uid(), title:v, date:el.dataset.date, done:false, projectId:'', priority:'Média'}); rerender(); document.querySelector(`[data-enter="quick-task"][data-date="${el.dataset.date}"]`)?.focus(); },
  'add-care': el => addCare(el),
  'project-task': el => { const v = el.value.trim(); if (!v) return; S.tasks.push({id:uid(), title:v, date:'', done:false, projectId:el.dataset.id, priority:'Média'}); rerender(); document.querySelector(`[data-enter="project-task"][data-id="${el.dataset.id}"]`)?.focus(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.tagName === 'TR' && e.target.closest('[data-stop]')) return;
  const fn = ACTIONS[el.dataset.a]; if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.bind && (el.type === 'date' || el.tagName === 'SELECT')) { setPath(S, el.dataset.bind, el.value); save(); }
  if (el.dataset.c && CHANGES[el.dataset.c]) CHANGES[el.dataset.c](el);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind && el.type !== 'date' && el.tagName !== 'SELECT') { setPath(S, el.dataset.bind, el.value); save(); if (el.dataset.live === 'sidebar') renderSidebar(); }
  if (el.dataset.i && INPUTS[el.dataset.i]) INPUTS[el.dataset.i](el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalSave) closeModal();
  if (e.key === 'Enter' && e.target.dataset?.enter && !e.isComposing) { e.preventDefault(); ENTERS[e.target.dataset.enter](e.target); }
  if (e.key === 'Enter' && e.target.closest?.('.modal') && e.target.tagName === 'INPUT') { e.preventDefault(); $('[data-a="modal-save"]')?.click(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else sync?.pull(); });
window.addEventListener('focus', () => sync?.pull());
window.addEventListener('online', () => saveNow());

/**
 * Ponto de entrada do planner: recebe a pessoa logada, busca o planner
 * dela na API e desenha a tela.
 */
export async function boot({ user, logout }){
  USER = user; onLogout = logout;
  sync = createSync({
    userId: user.id,
    getState: () => S,
    onStatus: setSync,
    onRemote: data => { S = normalize(data); render(); toast('Atualizado com o que você fez em outro aparelho'); },
  });
  const remote = await sync.load();
  if (remote.unauthorized){ location.replace('/entrar'); return; }
  if (remote.data) S = normalize(remote.data);
  else {
    S = normalize(blankState());
    S.name = (user.name || '').split(' ')[0];
    S.onboarding = true;
  }
  V.page = S.page || 'home';
  document.getElementById('boot')?.remove();
  render();
  if (!remote.data) save();
}
