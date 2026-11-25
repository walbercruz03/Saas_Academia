import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Image, Upload } from 'lucide-react';
import api from '../api';

const formatos = ['image/png', 'image/jpeg', 'image/webp'];
const limite = 128 * 1024;

export default function LogotipoAcademia({ disponivel }) {
  const { hash } = useLocation();
  const [url, setUrl] = useState('');
  const [arquivo, setArquivo] = useState(null);
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

  async function salvar(evento) {
    evento.preventDefault();
    if (!arquivo || ocupado) return;
    const formulario = evento.currentTarget;
    setErro('');
    setMensagem('');
    if (!formatos.includes(arquivo.type) || arquivo.size > limite || !arquivo.size) {
      setErro('Selecione um PNG, JPEG ou WebP de até 128 KiB.');
      return;
    }
    setOcupado(true);
    try {
      await api.put('/configuracoes/dados/logotipo', arquivo, { headers: { 'Content-Type': arquivo.type } });
      formulario.reset();
      setArquivo(null);
      setMensagem('Logotipo salvo.');
      setVersao((atual) => atual + 1);
    } catch (falha) {
      setErro(falha.response?.status === 413
        ? 'O logotipo deve ter até 128 KiB.'
        : 'Não foi possível salvar o logotipo. Confira se o arquivo é uma imagem válida.');
    } finally {
      setOcupado(false);
    }
  }

  return <section id="logotipo-academia" className="config-logotipo" aria-labelledby="config-logotipo-titulo">
    <h3 id="config-logotipo-titulo">Logotipo da academia</h3>
    {disponivel ? <div className="config-logotipo-conteudo">
      {url ? <img src={url} alt="Logotipo atual da academia" width="96" height="96" />
        : <span className="config-logotipo-vazio"><Image aria-hidden="true" /><span>Sem logotipo</span></span>}
      <form onSubmit={salvar} className="campo">
        <label htmlFor="config-logotipo-arquivo">Selecionar arquivo</label>
        <input id="config-logotipo-arquivo" type="file" accept={formatos.join(',')} aria-describedby="config-logotipo-formatos"
          disabled={ocupado} onChange={(evento) => setArquivo(evento.target.files?.[0] || null)} />
        <p id="config-logotipo-formatos">PNG, JPEG ou WebP de até 128 KiB.</p>
        <button className="treinamento-btn treinamento-btn--primario" disabled={ocupado || !arquivo}>
          <Upload size={16} aria-hidden="true" /> {ocupado ? 'Enviando…' : 'Salvar logotipo'}
        </button>
      </form>
    </div> : <p>O envio de logotipo está indisponível neste ambiente.</p>}
    {erro && <p role="alert" className="msg-erro">{erro}</p>}
    {mensagem && <p role="status" className="msg-sucesso">{mensagem}</p>}
  </section>;
}

LogotipoAcademia.propTypes = { disponivel: PropTypes.bool };
