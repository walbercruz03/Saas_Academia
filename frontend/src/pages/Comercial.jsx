import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, CalendarCheck, Check, ChevronDown, ClipboardList, Dumbbell,
  Menu, ShieldCheck, Users, Wallet, X,
} from 'lucide-react';
import { apiPublica } from '../api';
import '../styles/comercial.css';

const modulos = [
  [Users, 'Alunos', 'Centralize cadastros e consulte a situação de cada aluno.'],
  [ClipboardList, 'Matrículas', 'Vincule alunos aos planos e acompanhe vigências, renovações e vencimentos.'],
  [ShieldCheck, 'Professores', 'Organize a equipe e defina o acesso de cada professor aos módulos.'],
  [CalendarCheck, 'Check-in', 'Registre a presença e consulte o histórico de frequência da academia.'],
  [Dumbbell, 'Treinamentos', 'Monte fichas de treino e reaproveite modelos e exercícios da biblioteca.'],
  [Wallet, 'Financeiro', 'Acompanhe vendas, contas a pagar e a receber em um só lugar.'],
  [BarChart3, 'Relatórios', 'Consulte indicadores de alunos, matrículas e frequência por período.'],
];

const demonstracoes = [
  ['painel', 'Painel', 'Indicadores, matrículas e gráficos no painel da academia.'],
  ['treinos', 'Treinamentos', 'Criação de fichas e seleção de exercícios na biblioteca.'],
  ['financeiro', 'Financeiro', 'Contas a receber, com filtros e formulários de lançamento.'],
];

const perguntas = [
  ['Como funcionam os 30 dias grátis?', 'O período gratuito faz parte da oferta para novas academias. Quando o cadastro estiver disponível, você poderá consultar as condições e começar pela página de cadastro.'],
  ['Quanto custa após o período gratuito?', 'O plano custa R$ 79,99 por mês após os 30 dias grátis. Você pode cancelar a qualquer momento.'],
  ['Administradores e professores entram pelo mesmo lugar?', 'Sim. Ambos usam a página Entrar. As funções disponíveis dependem do perfil e das permissões concedidas pela academia.'],
  ['Preciso instalar algum programa?', 'O Wc Fit funciona no navegador. Você pode acessar o sistema pelo computador, tablet ou celular.'],
  ['Como acompanho meu financeiro?', 'Use o módulo Financeiro para registrar vendas, acompanhar contas a pagar e a receber e consultar movimentações.'],
];

const emailContato = import.meta.env.VITE_WCFIT_CONTACT_EMAIL?.trim();

function Marca() {
  return <Link className="comercial-marca" to="/" aria-label="Wc Fit, início">
    <span aria-hidden="true">WF</span> Wc Fit
  </Link>;
}

export default function Comercial() {
  const [menu, setMenu] = useState(false);
  const [demo, setDemo] = useState(0);
  const [publico, setPublico] = useState({ cadastro: false, documentos: null, carregando: true });

  useEffect(() => {
    const controle = new AbortController();
    const config = { signal: controle.signal };
    apiPublica.get('/cadastro-publico', config).then(
      ({ data }) => {
        if (!controle.signal.aborted) setPublico((atual) => ({ ...atual, cadastro: Boolean(data?.mensalidade_centavos), carregando: false }));
      },
      () => {
        if (!controle.signal.aborted) setPublico((atual) => ({ ...atual, carregando: false }));
      },
    );
    apiPublica.get('/documentos-legais', config).then(({ data }) => {
      if (!controle.signal.aborted && data?.termos_url && data?.privacidade_url) {
        setPublico((atual) => ({ ...atual, documentos: data }));
      }
    }).catch(() => {});
    return () => controle.abort();
  }, []);

  const [arquivo, rotulo, descricao] = demonstracoes[demo];

  return (
    <div className="comercial">
      <a className="comercial-skip" href="#conteudo-comercial">Ir para o conteúdo</a>
      <header className="comercial-header">
        <div className="comercial-limite comercial-header-inner">
          <Marca />
          <button type="button" className="comercial-menu-toggle" aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
            aria-controls="comercial-navegacao" aria-expanded={menu}
            onClick={() => setMenu((aberto) => !aberto)}>
            {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <nav id="comercial-navegacao" className={menu ? 'comercial-nav aberta' : 'comercial-nav'}
            aria-label="Navegação comercial" onKeyDown={(evento) => {
              if (evento.key === 'Escape') {
                setMenu(false);
                evento.currentTarget.previousElementSibling?.focus();
              }
            }}>
            <a href="#funcionalidades" onClick={() => setMenu(false)}>Funcionalidades</a>
            <a href="#precos" onClick={() => setMenu(false)}>Preços</a>
            <Link to="/login">Entrar</Link>
            {publico.cadastro
              ? <Link className="comercial-botao comercial-botao-nav" to="/cadastro">Cadastrar academia</Link>
              : <a className="comercial-botao comercial-botao-nav" href="#precos" onClick={() => setMenu(false)}>Cadastrar academia</a>}
          </nav>
        </div>
      </header>

      <main id="conteudo-comercial" tabIndex={-1}>
        <section className="comercial-hero" aria-labelledby="comercial-titulo">
          <div className="comercial-limite comercial-hero-grid">
            <div className="comercial-hero-copy">
              <p className="comercial-sobretitulo">Software de gestão para academias</p>
              <h1 id="comercial-titulo">Sua academia em <em>movimento.</em></h1>
              <p>Da primeira matrícula ao treino do dia, organize a rotina da sua academia em um só sistema.</p>
              <div className="comercial-acoes">
                {publico.cadastro
                  ? <Link className="comercial-botao comercial-botao-verde" to="/cadastro">Começar 30 dias grátis</Link>
                  : <a className="comercial-botao comercial-botao-verde" href="#precos">Começar 30 dias grátis</a>}
                <a className="comercial-botao comercial-botao-transparente" href="#demonstracao">Ver o sistema</a>
              </div>
              <p className="comercial-condicoes">R$ 79,99/mês após o teste gratuito · Cancele quando quiser</p>
            </div>
            <figure className="comercial-hero-figura">
              <img src="/demo/painel.webp" width="1200" height="750" alt="Painel Wc Fit com gráficos e indicadores de alunos, planos e matrículas" />
              <figcaption>Captura do Wc Fit com dados fictícios</figcaption>
            </figure>
          </div>
        </section>

        <section id="funcionalidades" className="comercial-secao comercial-limite" aria-labelledby="comercial-modulos">
          <p className="comercial-sobretitulo">Funcionalidades</p>
          <h2 id="comercial-modulos">Da recepção à sala de treino</h2>
          <div className="comercial-modulos">
            {modulos.map(([Icone, titulo, texto]) => (
              <article className="comercial-modulo" key={titulo}>
                <span className="comercial-icone"><Icone size={22} aria-hidden="true" /></span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="demonstracao" className="comercial-demonstracao" aria-labelledby="comercial-demo">
          <div className="comercial-secao comercial-limite">
            <p className="comercial-sobretitulo">Demonstração</p>
            <h2 id="comercial-demo">Conheça o sistema por dentro</h2>
            <div className="comercial-demo-controles" role="group" aria-label="Telas de demonstração">
              {demonstracoes.map(([nome, titulo], indice) => (
                <button key={nome} type="button" aria-pressed={demo === indice}
                  aria-controls="comercial-captura" onClick={() => setDemo(indice)}>{titulo}</button>
              ))}
            </div>
            <figure id="comercial-captura" className="comercial-captura" key={arquivo}>
              <img src={`/demo/${arquivo}.webp`} width="1200" height="750" loading="lazy" decoding="async" alt={descricao} />
              <figcaption>{rotulo} · Captura do sistema com dados fictícios</figcaption>
            </figure>
          </div>
        </section>

        <section id="precos" className="comercial-secao comercial-limite comercial-precos" aria-labelledby="comercial-preco">
          <div>
            <p className="comercial-sobretitulo">Plano mensal</p>
            <h2 id="comercial-preco">30 dias para experimentar o Wc Fit</h2>
            <p>Explore os módulos e veja como o Wc Fit se encaixa na rotina da sua academia.</p>
          </div>
          <article className="comercial-plano">
            <h3>Wc Fit</h3>
            <p className="comercial-valor"><strong>R$ 79,99</strong> / mês</p>
            <ul>
              {['30 dias grátis', 'Acesso a todos os módulos apresentados', 'Cancelamento a qualquer momento'].map((texto) => (
                <li key={texto}><Check size={19} aria-hidden="true" /> {texto}</li>
              ))}
            </ul>
            {publico.cadastro
              ? <Link className="comercial-botao comercial-botao-verde" to="/cadastro">Cadastrar minha academia</Link>
              : <p className="comercial-disponibilidade" role="status">
                {publico.carregando ? 'Consultando disponibilidade do cadastro…' : 'Cadastro de novas academias indisponível neste ambiente.'}
              </p>}
          </article>
        </section>

        <section className="comercial-faq" aria-labelledby="comercial-perguntas">
          <div className="comercial-secao comercial-limite comercial-faq-grid">
            <h2 id="comercial-perguntas">Perguntas frequentes</h2>
            <div>
              {perguntas.map(([pergunta, resposta]) => (
                <details key={pergunta}>
                  <summary>{pergunta}<ChevronDown size={20} aria-hidden="true" /></summary>
                  <p>{resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="comercial-footer">
        <div className="comercial-limite comercial-footer-grid">
          <div><Marca /><p>Gestão para academias.</p></div>
          <nav aria-label="Acesso ao sistema">
            <h2>Acesso ao sistema</h2>
            <Link to="/login">Entrar como administrador</Link>
            <Link to="/login">Entrar como professor</Link>
          </nav>
          <nav aria-label="Informações comerciais">
            <h2>Wc Fit</h2>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#precos">Preços</a>
            {emailContato && <a href={`mailto:${emailContato}`}>Contato</a>}
            {publico.documentos && <>
              <a href={publico.documentos.termos_url}>Termos de Uso</a>
              <a href={publico.documentos.privacidade_url}>Política de Privacidade</a>
            </>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
