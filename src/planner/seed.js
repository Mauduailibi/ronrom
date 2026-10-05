/* Estado vazio e dados de exemplo (a rotina da Julia). */
import { $, uid, esc, pad, ymd, parse, addDays, startOfWeek, monthKey, quarterKey, daysInMonth, clamp, pctOf, startDay } from '../shared/utils.js';
import { DOW, DOW_FULL, MONTHS, MON3, fmtShort, fmtLong, cap, CATS, CAT_COLOR, catColor, COLORS, PROJ_STATUS, STATUS_CLS, WHEEL, WHEEL_SHORT, QUOTES, THEMES, HEALTH } from './constants.js';

export function blankState(){
  const wheel = {}; WHEEL.forEach(c => wheel[c] = {score:5, note:''});
  return { v:2, appName:'Ronrom', name:'', mantra:'', palette:'manteguinha', page:'home', weeks:{}, milestones:[], goals:[], tasks:[], habits:[], projects:[], quarters:{}, classes:[], cats:[], catCare:{items:[], log:{}}, memorial:{name:'', look:'manteiga', text:''}, wheel, trip:{name:'', start:'', end:'', notes:'', checklist:[]} };
}

export function seed(){
  const S0 = blankState();
  const t = new Date(), T = ymd(t), ws = startOfWeek(t), mk = monthKey(t), qk = quarterKey(t);
  const d = n => ymd(addDays(t, n)), wd = n => ymd(addDays(ws, n));
  const endMonth = ymd(new Date(t.getFullYear(), t.getMonth()+1, 0));
  const [qs, qe] = quarterRange(qk);
  S0.name = 'Julia';
  S0.habits = [['Ler artigos da pesquisa',5,'1 artigo ou 30 min'],['Estudar as disciplinas',5,'2 blocos de 50 min'],['Idioma do intercâmbio',7,'20 minutos'],['Exercício',4,'40 minutos'],['Água',7,'2 litros'],['Brincar com a Phoebe e o Peleguinho',7,'15 minutos de varinha'],['Dormir até 23h',7,'Sem telas às 22h30']]
    .map(([name,freq,target], hi) => {
      const log = {};
      for (let i = 1; i <= 24; i++) if ((i*7 + hi*3) % 5 !== 0 && (freq === 7 || (i + hi) % 7 < freq)) log[d(-i)] = true;
      if (hi === 1 || hi === 4) log[T] = true;
      return { id: uid(), name, freq, target, log };
    });
  const mkList = arr => arr.map(([text, done]) => ({id: uid(), text, done: !!done}));
  S0.goals = [
    {id:uid(), month:mk, title:'Avançar no projeto FORWARD', category:'Pesquisa', description:'Deixar a análise andando e o relatório parcial encaminhado.', deadline:endMonth, color:'blue', paused:false,
      checklist: mkList([['Revisão bibliográfica da etapa',1],['Reunião com orientador(a)',1],['Organizar dados e resultados'],['Rascunho do relatório parcial'],['Atualizar o cronograma']])},
    {id:uid(), month:mk, title:'Documentos do intercâmbio', category:'Intercâmbio', description:'Tirar do caminho tudo que depende de prazo e de outras pessoas.', deadline:d(25), color:'pink', paused:false,
      checklist: mkList([['Conferir validade do passaporte',1],['Pedir a carta de aceite'],['Cotar seguro saúde'],['Separar comprovante financeiro']])},
    {id:uid(), month:mk, title:'Provas e trabalhos do mês', category:'Aulas', description:'Estudar com antecedência para não virar noite.', deadline:endMonth, color:'yellow', paused:false,
      checklist: mkList([['Lista de Reservatórios',1],['Prova de Elevação e Escoamento'],['Trabalho de Perfuração'],['Revisar Geologia do Petróleo']])},
  ];
  S0.milestones = [
    {id:uid(), month:mk, title:'Relatório parcial do FORWARD', category:'Pesquisa', deadline:endMonth, progress:30},
    {id:uid(), month:mk, title:'Documentos do intercâmbio enviados', category:'Intercâmbio', deadline:d(25), progress:25},
    {id:uid(), month:mk, title:'Média acima de 7 nas provas', category:'Aulas', deadline:endMonth, progress:50},
  ];
  const pF = uid(), pI = uid(), pS = uid(), pG = uid();
  S0.projects = [
    {id:pF, name:'Projeto FORWARD', category:'Pesquisa', status:'Em andamento', deadline:ymd(qe), goalRef:`${qk}:0`, notes:''},
    {id:pI, name:'Intercâmbio', category:'Intercâmbio', status:'Em andamento', deadline:d(70), goalRef:`${qk}:1`, notes:''},
    {id:pS, name:'Semestre: provas e trabalhos', category:'Aulas', status:'Em andamento', deadline:ymd(qe), goalRef:`${qk}:2`, notes:''},
    {id:pG, name:'Arranhador novo para os gatos', category:'Gatos', status:'Não iniciado', deadline:d(30), goalRef:'', notes:'Um alto, perto da janela: a Phoebe adora ver a rua.'},
  ];
  const tk = (title, date, done, projectId='', priority='Média') => ({id:uid(), title, date, done:!!done, projectId, priority});
  S0.tasks = [
    tk('Ler 2 artigos de referência', wd(0), 1, pF, 'Alta'),
    tk('Organizar planilha de resultados', wd(2), 0, pF),
    tk('Preparar slides para a reunião do FORWARD', wd(3), 0, pF, 'Alta'),
    tk('Rascunho do relatório parcial', d(14), 0, pF),
    tk('Conferir validade do passaporte', wd(1), 1, pI),
    tk('Pedir a carta de aceite', wd(4), 0, pI, 'Alta'),
    tk('Pesquisar seguro saúde', d(10), 0, pI),
    tk('Lista de exercícios de Reservatórios', wd(1), 1, pS),
    tk('Estudar para a prova de Elevação e Escoamento', wd(4), 0, pS, 'Alta'),
    tk('Trabalho de Perfuração', d(9), 0, pS),
    tk('Medir o espaço para o arranhador', wd(5), 0, pG, 'Baixa'),
    tk('Comprar ração e areia', T, 0),
    tk('Responder e-mail do(a) orientador(a)', T, 1),
    tk('Lavar a roupa', wd(6), 0, '', 'Baixa'),
  ];
  S0.weeks[ymd(ws)] = {
    intention: 'Proteger as manhãs para a pesquisa e chegar leve no fim de semana.',
    reflection: '',
    priorities: [{text:'Avançar na análise do FORWARD', done:false},{text:'Estudar para a prova de Elevação', done:false},{text:'Pedir a carta de aceite do intercâmbio', done:false}]
  };
  S0.quarters[qk] = {
    months: [
      {intention:'Foco na pesquisa', objective:'Resultados do FORWARD organizados', desc:'Manhãs protegidas para leitura e análise.'},
      {intention:'Preparar a partida', objective:'Documentos do intercâmbio prontos', desc:'Visto, seguro e moradia encaminhados.'},
      {intention:'Fechar ciclos', objective:'Semestre fechado e malas prontas', desc:'Provas finais, despedidas e descanso.'}
    ],
    goals: [
      {title:'Entregar resultados do FORWARD', category:'Pesquisa', deadline:ymd(qe), color:'yellow', notes:'', checklist: mkList([['Revisão bibliográfica',1],['Análise dos dados'],['Relatório parcial'],['Apresentação para o grupo']])},
      {title:'Intercâmbio 100% organizado', category:'Intercâmbio', deadline:ymd(qe), color:'pink', notes:'', checklist: mkList([['Passaporte',1],['Carta de aceite'],['Visto'],['Seguro saúde'],['Moradia']])},
      {title:'Fechar o semestre aprovada', category:'Aulas', deadline:ymd(qe), color:'green', notes:'', checklist: mkList([['Provas do 1º bimestre',1],['Trabalhos entregues'],['Provas finais']])}
    ]
  };
  S0.classes = [
    {id:uid(), name:'Engenharia de Reservatórios', days:[0,2], start:'08:00', end:'10:00', place:'Sala 204'},
    {id:uid(), name:'Elevação e Escoamento', days:[1,3], start:'10:00', end:'12:00', place:'Sala 108'},
    {id:uid(), name:'Perfuração de Poços', days:[4], start:'08:00', end:'10:00', place:'Laboratório'},
    {id:uid(), name:'Reunião do FORWARD', days:[3], start:'14:00', end:'15:00', place:'Grupo de pesquisa'},
  ];
  S0.cats = [
    {id:uid(), name:'Phoebe', look:'siames', desc:'Siamesa vira-lata, dona da casa', vacina:'', vermifugo:'', antipulgas:'', notes:''},
    {id:uid(), name:'Peleguinho', look:'cinza', desc:'Cinza rajadinho', vacina:'', vermifugo:'', antipulgas:'', notes:''},
  ];
  S0.catCare = { items: ['Ração','Água fresca','Caixa de areia','Brincar e carinho'].map(text => ({id:uid(), text})), log:{} };
  S0.memorial = { name:'Manteguinha', look:'manteiga', text:'Meu eterno Manteguinha.' };
  const ws0 = [7,7,6,8,8,6,7,6,6,7,7,6];
  WHEEL.forEach((c,i) => S0.wheel[c] = {score: ws0[i], note:''});
  S0.wheel['Carreira'].note = 'FORWARD andando';
  S0.wheel['Estudos'].note = 'Semestre puxado';
  S0.trip = {name:'', start:'', end:'', notes:'', checklist: mkList([['Passaporte válido',1],['Carta de aceite'],['Visto de estudante'],['Seguro saúde'],['Comprovante financeiro'],['Moradia'],['Aproveitamento das disciplinas'],['Passagem'],['Plano para os gatos enquanto eu estiver fora']])};
  return S0;
}

export function quarterRange(qk){
  const [y, q] = qk.split('-T').map(Number);
  return [new Date(y, (q-1)*3, 1), new Date(y, q*3, 0)];
}
