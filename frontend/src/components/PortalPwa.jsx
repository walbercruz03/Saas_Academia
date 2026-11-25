import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Share, WifiOff } from 'lucide-react';

function emStandalone() {
  return Boolean(navigator.standalone || window.matchMedia('(display-mode: standalone)').matches);
}

function emIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function PortalIndisponivel({ tentar, saidaPendente = false, enviando = false, erroSaida = '' }) {
  return <main className="portal-offline">
    <section className="portal-card" aria-labelledby="portal-offline-titulo">
      <WifiOff size={34} aria-hidden="true" />
      <h1 id="portal-offline-titulo">Conexão indisponível</h1>
      {saidaPendente ? <p>A saída precisa ser confirmada pelo servidor. O portal continuará fechado enquanto isso.</p>
        : <p>O portal precisa se conectar para validar sua sessão.</p>}
      {!saidaPendente && <p>Ao reconectar, confira o que o servidor confirmou antes de registrar novas alterações.</p>}
      {erroSaida && <p role="status">{erroSaida}</p>}
      <button className="portal-botao" type="button" onClick={tentar} disabled={enviando}><RefreshCw size={18} aria-hidden="true" /> {enviando ? 'Encerrando sessão…' : 'Tentar novamente'}</button>
    </section>
  </main>;
}

export default function ControlesPwa({ podeAtualizar }) {
  const [instalado,setInstalado] = useState(emStandalone);
  const [convite,setConvite] = useState(null);
  const [aguardando,setAguardando] = useState(null);
  const [aviso,setAviso] = useState('');
  const [atualizando,setAtualizando] = useState(false);
  const [mostraOrientacao,setMostraOrientacao] = useState(false);
  const clicouAtualizar = useRef(false);
  const ios = emIOS();

  useEffect(() => {
    if (!import.meta.env.PROD || !window.isSecureContext) return;

    const standalone = window.matchMedia('(display-mode: standalone)');
    const instalar = (evento) => { evento.preventDefault(); setConvite(evento); };
    const instaladoAgora = () => { setInstalado(true); setConvite(null); setMostraOrientacao(false); };
    const modoAlterado = () => setInstalado(emStandalone());
    standalone.addEventListener?.('change',modoAlterado);
    window.addEventListener('beforeinstallprompt',instalar);
    window.addEventListener('appinstalled',instaladoAgora);

    const sw = navigator.serviceWorker;
    let registro;
    let worker;
    let cancelado = false;
    const instaladoWorker = () => {
      if (worker?.state === 'installed' && sw.controller) setAguardando(registro.waiting || worker);
    };
    const atualizacao = () => {
      worker?.removeEventListener('statechange',instaladoWorker);
      worker = registro.installing;
      worker?.addEventListener('statechange',instaladoWorker);
      instaladoWorker();
    };
    const mudouControle = () => {
      setAguardando(null);
      if (clicouAtualizar.current) window.location.reload();
    };
    const verificar = () => registro?.update().catch(() => {});
    if (sw) {
      sw.addEventListener('controllerchange',mudouControle);
      window.addEventListener('online',verificar);
      sw.register('/aluno/pwa-worker.js',{ scope:'/aluno/', updateViaCache:'none' }).then((valor) => {
        if (cancelado) return;
        registro = valor;
        if (registro.waiting && sw.controller) setAguardando(registro.waiting);
        registro.addEventListener('updatefound',atualizacao);
        atualizacao();
      }).catch(() => {});
    }

    return () => {
      cancelado = true;
      standalone.removeEventListener?.('change',modoAlterado);
      window.removeEventListener('beforeinstallprompt',instalar);
      window.removeEventListener('appinstalled',instaladoAgora);
      window.removeEventListener('online',verificar);
      sw?.removeEventListener('controllerchange',mudouControle);
      registro?.removeEventListener('updatefound',atualizacao);
      worker?.removeEventListener('statechange',instaladoWorker);
    };
  },[]);

  async function instalarAplicativo() {
    setAviso('');
    if (ios && !convite) {
      setMostraOrientacao((valor) => !valor);
      return;
    }
    const prompt = convite;
    setConvite(null);
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') setInstalado(true);
    } catch {
      setAviso('A instalação não pôde ser aberta. Use a opção de instalação no menu do navegador, se disponível.');
    }
  }

  const mostrarInstalacao = import.meta.env.PROD && window.isSecureContext &&
    !instalado && (convite || ios);
  if (!mostrarInstalacao && !aviso && !aguardando) return null;

  return <aside className="portal-pwa-controles" aria-label="Aplicativo Wc Fit">
    {mostrarInstalacao && <button className="portal-botao portal-botao-secundario" type="button" onClick={instalarAplicativo}
      aria-expanded={ios && !convite ? mostraOrientacao : undefined}>
      <Download size={18} aria-hidden="true" /> Instalar aplicativo
    </button>}
    {mostrarInstalacao && mostraOrientacao && <div className="portal-card">
      <h2>Instalar no iPhone</h2>
      <p>Abra o Portal do Aluno no Safari. Toque em <Share size={15} aria-hidden="true" /> <strong>Compartilhar</strong>,
        escolha <strong>Adicionar à Tela de Início</strong>, ative <strong>Abrir como App da Web</strong> se aparecer e confirme em <strong>Adicionar</strong>.</p>
    </div>}
    {aviso && <p role="status">{aviso}</p>}
    {aguardando && <div className="portal-card portal-pwa-atualizacao">
      <p role="status">{podeAtualizar ? 'Uma atualização do aplicativo está pronta.' : 'Atualização pronta. Abra outra tela do portal quando terminar de registrar as séries.'}</p>
      {podeAtualizar && <button type="button" className="portal-botao" disabled={atualizando} onClick={() => {
        clicouAtualizar.current = true;
        setAtualizando(true);
        aguardando.postMessage({ tipo:'WCFIT_ATIVAR_ATUALIZACAO' });
      }}><RefreshCw size={18} aria-hidden="true" /> {atualizando ? 'Atualizando…' : 'Atualizar aplicativo'}</button>}
    </div>}
  </aside>;
}

PortalIndisponivel.propTypes = {
  tentar: PropTypes.func.isRequired,
  saidaPendente: PropTypes.bool,
  enviando: PropTypes.bool,
  erroSaida: PropTypes.string,
};

ControlesPwa.propTypes = { podeAtualizar: PropTypes.bool.isRequired };
