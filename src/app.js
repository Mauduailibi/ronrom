import './styles/tokens.css';
import './planner/planner.css';
import { applySavedPalette } from './lib/palette.js';
import { authClient } from './lib/auth-client.js';
import { boot } from './planner/planner.js';

applySavedPalette();

(async () => {
  try {
    const { data } = await authClient.getSession();
    if (!data?.user){ location.replace('/entrar'); return; }
    await boot({
      user: data.user,
      logout: async () => { await authClient.signOut(); location.href = '/'; },
    });
  } catch(e){
    console.error(e);
    const b = document.getElementById('boot');
    if (b) b.innerHTML = '<p>Não consegui abrir o planner. Confira a internet e recarregue a página.</p>';
  }
})();
