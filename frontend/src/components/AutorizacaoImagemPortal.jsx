import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import api from '../api';

export default function AutorizacaoImagemPortal({ id }) {
  const [autorizada, setAutorizada] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const rota = `/exercicios/${id}/portal-imagem`;

  useEffect(() => {
    const controle = new AbortController();
    api.get(rota, { signal:controle.signal })
      .then(({ data }) => { if (!controle.signal.aborted) setAutorizada(data.autorizada); })
      .catch(() => {});
    return () => controle.abort();
  }, [rota]);

  if (autorizada === null) return null;
  async function atualizar() {
    if (!autorizada && !window.confirm('Você confirma que a academia tem autorização para exibir esta imagem aos alunos?')) return;
    setSalvando(true);
    setErro('');
    try {
      await api.put(rota, { autorizada:!autorizada });
      setAutorizada(!autorizada);
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível atualizar a autorização.');
    } finally {
      setSalvando(false);
    }
  }

  return <div className="treinamento-item-box">
    <p role="status">{autorizada ? 'Imagem autorizada no Portal do Aluno.' : 'Imagem disponível apenas na biblioteca interna.'}</p>
    <button className="treinamento-btn treinamento-btn--neutro" type="button" disabled={salvando}
      onClick={atualizar}>{autorizada ? 'Revogar autorização' : 'Autorizar imagem no portal'}</button>
    {erro && <p role="alert" className="msg-erro">{erro}</p>}
  </div>;
}

AutorizacaoImagemPortal.propTypes = { id: PropTypes.number.isRequired };
