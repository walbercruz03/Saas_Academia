import { MENSAGEM_SENHA, senhaValida } from '../politicaSenha';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import CamposCadastroAcademia, { useConsultaCep } from '../components/CamposCadastroAcademia';
import '../styles/login.css';

const titulos = ['Dados da academia', 'Endereço', 'Responsável'];
const digitos = (valor) => (valor || '').replace(/\D/g, '');
const moeda = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CadastroAdmin() {
  const [etapa, setEtapa] = useState(0);
  const [dados, setDados] = useState({ tipo: 'mei' });
  const [politicas, setPoliticas] = useState(null);
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const emEnvio = useRef(false);

  useEffect(() => {
    const consulta = new AbortController();
    api.get('/cadastro-publico', { signal: consulta.signal })
      .then(({ data }) => setPoliticas(data))
      .catch(() => {
        if (!consulta.signal.aborted) setPoliticas(false);
      });
    return () => consulta.abort();
  }, []);

  const avisoCep = useConsultaCep(dados, setDados);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (emEnvio.current) return;
    setErro('');
    if (etapa < 2) {
      setEtapa(etapa + 1);
      return;
    }
    if (dados.senha !== dados.confirmacao) {
      setErro('As senhas precisam coincidir.');
      return;
    }
    if (!senhaValida(dados.senha)) {
      setErro(MENSAGEM_SENHA);
      return;
    }
    emEnvio.current = true;
    setOcupado(true);
    try {
      if (!desafio) {
        const { data } = await api.post('/cadastro-publico/email', { email: dados.email });
        setDesafio(data.desafio);
      } else {
        const { confirmacao, ...cadastro } = dados;
        await api.post('/cadastro-publico', { ...cadastro, desafio, codigo, ...politicas });
        setConcluido(true);
        setDados({});
        setCodigo('');
      }
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível concluir o cadastro.');
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Cadastre sua academia</h1>
          <p>30 dias grátis. Depois, {moeda(politicas?.mensalidade_centavos ?? 7999)} por mês. Sem cobrança automática.</p>
        </div>
        {concluido ? (
          <p className="sucesso" role="status">Cadastro concluído. Você já pode entrar com seu e-mail e senha.</p>
        ) : politicas === false ? (
          <p className="erro" role="status">Cadastro temporariamente indisponível.</p>
        ) : politicas && (
          <form onSubmit={enviar} className="login-form">
            <h2>{etapa + 1} de 3 · {titulos[etapa]}</h2>
            <fieldset disabled={ocupado || Boolean(desafio)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <CamposCadastroAcademia dados={dados} setDados={setDados} etapa={etapa} avisoCep={avisoCep} comSenha />
              {etapa === 2 && <>
                {politicas.aceite_comercial_obrigatorio && <label>
                  <input type="checkbox" required checked={dados.aceite_comercial === true}
                    onChange={(e) => setDados({ ...dados, aceite_comercial: e.target.checked })} />
                  {' '}Aceito os 30 dias grátis e a mensalidade de {moeda(politicas.mensalidade_centavos)} após o período gratuito.
                  A forma de pagamento será autorizada na aba Minha assinatura.
                </label>}
                {politicas.termos_url && <label><input type="checkbox" required checked={dados.aceite_termos === true}
                  onChange={(e) => setDados({ ...dados, aceite_termos: e.target.checked })} /> Aceito os <a href={politicas.termos_url} target="_blank" rel="noreferrer">Termos de Uso</a>.</label>}
                {politicas.privacidade_url && <label><input type="checkbox" required checked={dados.aceite_privacidade === true}
                  onChange={(e) => setDados({ ...dados, aceite_privacidade: e.target.checked })} /> Aceito a <a href={politicas.privacidade_url} target="_blank" rel="noreferrer">Política de Privacidade</a>.</label>}
              </>}
            </fieldset>
            {desafio && <div className="campo">
              <label htmlFor="codigo">Código enviado ao seu e-mail</label>
              <input id="codigo" value={codigo} onChange={(e) => setCodigo(digitos(e.target.value))} disabled={ocupado}
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
            </div>}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button type="submit" className="btn-entrar" disabled={ocupado}>
              {ocupado ? 'Aguarde…' : desafio ? 'Confirmar cadastro' : etapa === 2 ? 'Enviar código de verificação' : 'Continuar'}
            </button>
            {(etapa > 0 || desafio) && <button type="button" className="btn-outline" disabled={ocupado}
              onClick={() => { setErro(''); if (desafio) { setDesafio(null); setCodigo(''); } else setEtapa(etapa - 1); }}>
              {desafio ? 'Voltar ou solicitar outro código' : 'Voltar'}
            </button>}
          </form>
        )}
        <div className="cadastro-link"><Link to="/login">Ir para o login</Link></div>
      </div>
    </div>
  );
}
