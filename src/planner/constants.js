/* Listas fixas: dias, meses, categorias, temas, Roda da Vida. */
import { parse } from '../shared/utils.js';
export const DOW = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
export const DOW_FULL = ['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo'];
export const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const MON3 = MONTHS.map(m => m.slice(0,3));
export const fmtShort = s => { if (!s) return 'Sem prazo'; const d = parse(s); return `${d.getDate()} ${MON3[d.getMonth()]}`; };
export const fmtLong = d => `${DOW_FULL[(d.getDay()+6)%7]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const CATS = ['Pesquisa','Aulas','Intercâmbio','Saúde','Finanças','Gatos','Pessoal','Relacionamento','Casa','Lazer'];
export const CAT_COLOR = {Pesquisa:'blue',Aulas:'yellow',Intercâmbio:'pink',Saúde:'green',Finanças:'yellow',Gatos:'pink',Pessoal:'green',Relacionamento:'pink',Casa:'green',Lazer:'yellow'};
export const catColor = c => CAT_COLOR[c] || 'green';
export const COLORS = [['yellow','Amarelo'],['pink','Rosa'],['green','Verde'],['blue','Azul']];
export const PROJ_STATUS = ['Não iniciado','Em andamento','Concluído','Pausado'];
export const STATUS_CLS = {'Não iniciado':'neutral','Em andamento':'blue','Concluído':'green','Pausado':'pink','Não iniciada':'neutral','Concluída':'green','Pausada':'pink'};
export const WHEEL = ['Saúde','Carreira','Finanças','Família','Relacionamentos','Lazer','Desenvolvimento pessoal','Espiritualidade','Vida social','Estudos','Ambiente','Outros'];
export const WHEEL_SHORT = {'Desenvolvimento pessoal':'Desenv. pessoal','Relacionamentos':'Relacionam.'};
export const QUOTES = [
  'Pequenos passos, todos os dias, constroem a vida que você quer.',
  'Hoje é um bom dia para cuidar do que realmente importa.',
  'Foque no essencial. O resto pode esperar um pouco.',
  'Constância vale mais do que intensidade.',
  'Você não precisa fazer tudo, só o próximo passo.',
  'Organize o seu dia antes que ele organize você.',
  'Celebre o progresso, não a perfeição.',
  'Descanse como um gato: sem culpa e no lugar mais quentinho.',
  'Curiosidade de gato, constância de pesquisadora.',
  'Um passo de cada vez, até o embarque.'
];
export const THEMES = [
  {id:'manteguinha', look:'manteiga', name:'Manteguinha', desc:'Manteiga, creme e verde-musgo, em memória do meu eterno Manteguinha', s:'#1E3A2D', bg:'#F8F5EE', c:['#F8EBC0','#F5E0DC','#DFEAD7','#DCE6EF']},
  {id:'phoebe', look:'siames', name:'Phoebe', desc:'Creme e chocolate de siamesa, com o azul dos olhos dela', s:'#3B2A22', bg:'#F8F3EC', c:['#F4E7D2','#F3E0DA','#E6E7D8','#DCE9F5']},
  {id:'peleguinho', look:'cinza', name:'Peleguinho', desc:'Cinza rajadinho, discreto e aconchegante', s:'repeating-linear-gradient(118deg,#3B4045 0 6px,#474D53 6px 12px)', bg:'#F3F3F1', c:['#EFEBDA','#EDE3E1','#E2E8DE','#E0E6EC']},
  {id:'noite', name:'Noite', desc:'Escuro e calmo, para estudar tarde enquanto os gatos dormem', s:'#0D131A', bg:'#131A22', c:['#36321F','#3A2730','#21352B','#1F3249']},
  {id:'auto', name:'Automático', desc:'Manteguinha de dia, Noite quando o sistema estiver escuro', s:'linear-gradient(#1E3A2D 50%,#0D131A 50%)', bg:'linear-gradient(135deg,#F8F5EE 50%,#131A22 50%)', c:['#F8EBC0','#F5E0DC','#21352B','#1F3249']}
];

export const HEALTH = [['vacina','Vacina'],['vermifugo','Vermífugo'],['antipulgas','Antipulgas']];
