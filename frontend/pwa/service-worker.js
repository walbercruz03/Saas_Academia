const prefixo = 'wcfit-aluno-publico-';
const versao = '__WCFIT_PWA_VERSION__';
const cachePublico = prefixo + versao;
const offline = '/aluno/pwa/offline.html';
const icone = '/aluno/pwa/icone-192.png';

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const [pagina, imagem] = await Promise.all([offline, icone].map((path) =>
      fetch(path, { cache:'reload', credentials:'omit', redirect:'error' })));
    if (!pagina.ok || !pagina.headers.get('Content-Type')?.includes('text/html') ||
        !(await pagina.clone().text()).includes('name="wcfit-offline" content="public"') ||
        !imagem.ok || !imagem.headers.get('Content-Type')?.includes('image/png')) {
      throw new Error('Os arquivos públicos da versão não estão disponíveis.');
    }
    const cache = await caches.open(cachePublico);
    await Promise.all([cache.put(offline,pagina),cache.put(icone,imagem)]);
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome.startsWith(prefixo) && nome !== cachePublico)
      .map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'WCFIT_ATIVAR_ATUALIZACAO' &&
      evento.source?.url?.startsWith(self.location.origin + '/aluno/')) {
    evento.waitUntil(self.skipWaiting());
  }
});

async function paginaOffline() {
  return (await (await caches.open(cachePublico)).match(offline)) ||
    new Response('Conexão indisponível. Reconecte-se para acessar o Portal do Aluno.',
      { status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'} });
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/api/aluno' || url.pathname.startsWith('/api/aluno/')) {
    evento.respondWith(fetch(req,{ cache:'no-store' }));
    return;
  }

  if (req.method !== 'GET' || !url.pathname.startsWith('/aluno/')) return;
  if (req.mode === 'navigate') {
    evento.respondWith(fetch(req,{ cache:'no-store' }).then((resposta) =>
      [502,503,504].includes(resposta.status) ? paginaOffline() : resposta).catch(paginaOffline));
  } else if (url.pathname === icone && !url.search && req.destination === 'image') {
    evento.respondWith((async () => (await (await caches.open(cachePublico)).match(icone)) || fetch(req))());
  }
});
