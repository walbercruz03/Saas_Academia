import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Image, Upload } from 'lucide-react';
import api from '../api';

import { formatosLogotipo, prepararLogotipo } from '../utils/prepararLogotipo';

export default function LogotipoAcademia({ disponivel }) {
  const { hash } = useLocation();
  const [url, setUrl] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState('');
  const [processando, setProcessando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (hash === '#logotipo-academia') document.getElementById('logotipo-academia')?.scrollIntoView();
  }, [hash]);

  useEffect(() => {
    if (!disponivel) return;
    const controle = new AbortController();
    let criada;
    api.get('/configuracoes/dados/logotipo', { responseType: 'blob', signal: controle.signal })
      .then(({ data }) => {
        if (controle.signal.aborted) return;
        criada = URL.createObjectURL(data);
        setUrl(criada);
      })
      .catch((falha) => {
        if (!controle.signal.aborted && falha.response?.status !== 404) {
          setErro('Não foi possível consultar o logotipo.');
        }
      });
    return () => {
      controle.abort();
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [disponivel, versao]);

  useEffect(() => {
    if (!arquivo) {
      setPrevia('');
      return;
    }
    const criada = URL.createObjectURL(arquivo);
    setPrevia(criada);
    return () => URL.revokeObjectURL(criada);
  }, [arquivo]);

  async function selecionar(evento) {
    const campo = evento.currentTarget;
    const original = campo.files?.[0];
    setArquivo(null);
    setErro('');
    setMensagem('');
    if (!original) return;

    setProcessando(true);
    try {
      setArquivo(await prepararLogotipo(original));
    } catch (falha) {
      campo.value = '';
      setErro(falha.message);
    } finally {
      setProcessando(false);
    }
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (!arquivo || processando || ocupado) return;
    const formulario = evento.currentTarget;
    setErro('');
    setMensagem('');
    setOcupado(true);
    try {
      await api.put('/configuracoes/dados/logotipo', arquivo, { headers: { 'Content-Type': arquivo.type } });
      formulario.reset();
      setArquivo(null);
      setMensagem('Logotipo salvo.');
      setVersao((atual) => atual + 1);
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível salvar o logotipo. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }

  return <section id="logotipo-academia" className="config-logotipo" aria-labelledby="config-logotipo-titulo">
    <h3 id="config-logotipo-titulo">Logotipo da academia</h3>
    {disponivel ? <div className="config-logotipo-conteudo">
      {(previa || url) ? <img src={previa || url} alt={previa ? "Prévia do novo logotipo" : "Logotipo atual da academia"} width="96" height="96" />
        : <span className="config-logotipo-vazio"><Image aria-hidden="true" /><span>Sem logotipo</span></span>}
      <form onSubmit={salvar} className="campo">
        <label htmlFor="config-logotipo-arquivo">Selecionar arquivo</label>
        <input id="config-logotipo-arquivo" type="file" accept={formatosLogotipo.join(',')} aria-describedby="config-logotipo-formatos"
          disabled={ocupado || processando} onChange={selecionar} />
        <p id="config-logotipo-formatos">PNG, JPEG ou WebP de até 10 MB.</p>
        {processando && <p role="status">Preparando imagem…</p>}
        {previa && <p>Prévia do novo logotipo</p>}
        <button className="treinamento-btn treinamento-btn--primario" disabled={ocupado || processando || !previa}>
          <Upload size={16} aria-hidden="true" /> {ocupado ? 'Enviando…' : 'Salvar logotipo'}
        </button>
      </form>
    </div> : <p>O envio de logotipo está indisponível neste ambiente.</p>}
    {erro && <p role="alert" className="msg-erro">{erro}</p>}
    {mensagem && <p role="status" className="msg-sucesso">{mensagem}</p>}
  </section>;
}

LogotipoAcademia.propTypes = { disponivel: PropTypes.bool };
