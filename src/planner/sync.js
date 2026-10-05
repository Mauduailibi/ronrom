/**
 * Sincroniza o planner com a API.
 *
 * - Cada mudança marca o estado como "sujo" e agenda um PUT /api/state.
 * - O servidor guarda uma versão; se outro aparelho salvou antes (409),
 *   adotamos a versão do servidor e avisamos.
 * - Uma cópia fica no localStorage para abrir rápido e não perder nada
 *   sem internet. Quando a conexão volta, o que ficou pendente é enviado.
 */
export function createSync({ userId, getState, onStatus, onRemote }){
  let version = 0, dirty = false, edits = 0, timer = null, inflight = null, retry = null;
  const key = `ronrom-cache-${userId}`;

  const writeCache = pending => { try { localStorage.setItem(key, JSON.stringify({ version, pending, data: getState() })); } catch(e){} };
  const readCache = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } };
  const retryLater = () => { clearTimeout(retry); retry = setTimeout(push, 5000); };

  async function load(){
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.status === 401) return { unauthorized: true };
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      version = j.version;
      const c = readCache();
      // Mudanças feitas sem internet em cima desta mesma versão: mantém e envia.
      if (c?.pending && c.version === j.version && c.data){ dirty = true; edits++; setTimeout(push, 300); return { data: c.data, version }; }
      return j;
    } catch(e){
      const c = readCache();
      if (c?.data){ version = c.version; dirty = !!c.pending; onStatus('offline'); return { data: c.data, version }; }
      throw e;
    }
  }

  function schedule(){
    edits++; dirty = true; writeCache(true); onStatus('saving');
    clearTimeout(timer); timer = setTimeout(push, 800);
  }

  async function push(){
    clearTimeout(timer);
    if (inflight){ await inflight; if (dirty) return push(); return; }
    if (!dirty) return;
    const sent = edits;
    const body = JSON.stringify({ data: getState(), baseVersion: version });
    inflight = (async () => {
      try {
        const r = await fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 });
        if (r.ok){
          version = (await r.json()).version;
          if (edits === sent){ dirty = false; writeCache(false); onStatus('saved'); }
        } else if (r.status === 409){
          const j = await r.json();
          version = j.version; dirty = false;
          if (j.data) onRemote(j.data);
          writeCache(false); onStatus('saved');
        } else if (r.status === 401){
          location.replace('/entrar');
        } else { onStatus('error'); retryLater(); }
      } catch(e){ onStatus('offline'); retryLater(); }
    })();
    await inflight; inflight = null;
    if (dirty && edits !== sent) return push();
  }

  /** Busca a versão do servidor quando a aba volta ao foco (outro aparelho pode ter salvo). */
  async function pull(){
    if (dirty || inflight) return;
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.version > version && j.data){ version = j.version; onRemote(j.data); writeCache(false); }
    } catch(e){}
  }

  return { load, schedule, flush: push, pull };
}
