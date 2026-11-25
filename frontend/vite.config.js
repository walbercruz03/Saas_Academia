import process from 'node:process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function metadadosComerciais(urlPublica) {
  return {
    name: 'wcfit-metadados-comerciais',
    transformIndexHtml(html) {
      if (!urlPublica || html.includes('href="/aluno/pwa/manifest.webmanifest"')) return html;
      const origem = new URL(urlPublica);
      if (origem.protocol !== 'https:' && origem.protocol !== 'http:') {
        throw new Error('VITE_WCFIT_SITE_URL deve ser uma URL HTTP ou HTTPS.');
      }
      const url = `${origem.origin}/`;
      return {
        html: html.replaceAll('content="/demo/compartilhamento.jpg"', `content="${url}demo/compartilhamento.jpg"`),
        tags: [
          { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
        ],
      };
    },
  };
}

function portalPwa() {
  const raiz = new URL('.',import.meta.url);
  function entradaPortal(req,_res,next) {
    const caminho = req.url?.split('?')[0];
    if (req.headers.accept?.includes('text/html') && (caminho === '/aluno' ||
      (caminho?.startsWith('/aluno/') && !caminho.startsWith('/aluno/pwa/') && caminho !== '/aluno/pwa-worker.js'))) {
      req.url = '/portal.html';
    }
    next();
  }

  return {
    name:'wcfit-pwa-aluno',
    enforce:'post',
    configureServer(servidor) { servidor.middlewares.use(entradaPortal); },
    configurePreviewServer(servidor) { servidor.middlewares.use(entradaPortal); },
    generateBundle(_opcoes,bundle) {
      const fonte = readFileSync(new URL('pwa/service-worker.js',raiz),'utf8');
      // Os nomes com hash do Rollup fazem a revisão mudar com o aplicativo.
      const hash = createHash('sha256').update(fonte).update(Object.keys(bundle).sort().join('\n'));
      const publicos = new URL('public/aluno/pwa/',raiz);
      hash.update(readFileSync(new URL('portal.html',raiz)));
      for (const nome of readdirSync(publicos).sort()) {
        hash.update(nome).update(readFileSync(new URL(nome,publicos)));
      }
      this.emitFile({ type:'asset', fileName:'aluno/pwa-worker.js',
        source:fonte.replace('__WCFIT_PWA_VERSION__',hash.digest('hex').slice(0,20)) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(),metadadosComerciais(env.VITE_WCFIT_SITE_URL),portalPwa()],
    build: { rollupOptions: { input: {
      principal:fileURLToPath(new URL('index.html',import.meta.url)),
      portal:fileURLToPath(new URL('portal.html',import.meta.url)),
    } } },
    server: {
      port: 5173,
      host: true,
      open: false,
      proxy: { '/api/aluno/': 'http://localhost:3001', '/api/super-admin': 'http://localhost:3001', '/api/convites': 'http://localhost:3001' },
    },
  };
});
