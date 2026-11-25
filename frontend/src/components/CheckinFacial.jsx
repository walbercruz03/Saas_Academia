import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Camera, Expand, ScanFace, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../api';
import '../styles/checkinFacial.css';

const rota = '/checkin/facial';
const erroApi = (falha) => falha.response?.data?.mensagem || 'Operação indisponível. Use a alternativa manual.';

function quadroDoVideo(video) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('A câmera ainda está carregando.');
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d',{ willReadFrequently:true });
  const lado = Math.min(video.videoWidth,video.videoHeight);
  ctx.drawImage(video,(video.videoWidth-lado)/2,(video.videoHeight-lado)/2,lado,lado,0,0,64,64);
  const { data } = ctx.getImageData(0,0,64,64);
  let cinza = '';
  for (let i=0;i<data.length;i+=4) cinza += String.fromCharCode(Math.round(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114));
  data.fill(0);
  ctx.clearRect(0,0,64,64);
  return btoa(cinza);
}

function CameraFacial({ aluno, aviso, fechar, aoConcluir }) {
  const dialogo = useRef(null);
  const video = useRef(null);
  const pedido = useRef(null);
  const [camera, setCamera] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [acordo, setAcordo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [desafio, setDesafio] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [cpf, setCpf] = useState('');
  const [resultado, setResultado] = useState('');

  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => { if (elemento.open) elemento.close(); pedido.current?.abort(); };
  },[]);

  useEffect(() => {
    if (!camera) return;
    let stream;
    let descartado = false;
    const elemento = video.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMensagem('Abra o sistema em um endereço seguro e permita o acesso à câmera.');
      setCamera(false);
      return;
    }
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false})
      .then((captura) => {
        if (descartado) { captura.getTracks().forEach((track) => track.stop()); return; }
        stream = captura;
        elemento.srcObject = captura;
      })
      .catch(() => {
        if (!descartado) { setMensagem('Não foi possível abrir a câmera. Confira as permissões.'); setCamera(false); }
      });
    return () => {
      descartado = true;
      stream?.getTracks().forEach((track) => track.stop());
      elemento.srcObject = null;
    };
  },[camera]);

  async function executar(caminho,dados,tratar) {
    if (pedido.current) return;
    const controle = new AbortController();
    pedido.current = controle;
    setOcupado(true);
    setMensagem('');
    try {
      const { data } = await api.post(rota+caminho,dados(),{ signal:controle.signal });
      if (!controle.signal.aborted) tratar(data);
    } catch (falha) {
      if (!controle.signal.aborted) {
        setMensagem(falha.response ? erroApi(falha) : falha.message);
        setDesafio(null);
        setConfirmacao(null);
        setCpf('');
        if (falha.response?.data?.resultado === 'negado') setResultado('negado');
      }
    } finally {
      if (!controle.signal.aborted) setOcupado(false);
      pedido.current = null;
    }
  }

  function iniciar() {
    setResultado('');
    executar('/desafio',() => ({
      quadro:quadroDoVideo(video.current), ...(aluno != null && { aluno_id:aluno,consentimento:acordo,aviso }),
    }),setDesafio);
  }

  function verificar() {
    executar('/verificar',() => ({ quadro:quadroDoVideo(video.current),token:desafio.token }), (data) => {
      setDesafio(null);
      if (data.cadastrado) { aoConcluir(); fechar(); }
      else if (data.token) setConfirmacao(data.token);
      else setMensagem('Reconhecimento inconclusivo. Use o check-in manual.');
    });
  }

  function confirmar(evento) {
    evento.preventDefault();
    executar('/confirmar',() => ({ cpf,token:confirmacao }), () => {
      setConfirmacao(null);
      setCpf('');
      setResultado('liberado');
      aoConcluir();
    });
  }

  return <dialog ref={dialogo} className={telaCheia ? 'facial-dialogo facial-tela-cheia' : 'facial-dialogo'} onCancel={(evento) => { evento.preventDefault(); fechar(); }}
    aria-labelledby="facial-titulo">
    <header className="facial-acoes">
      <h2 id="facial-titulo"><ScanFace size={24} aria-hidden="true" /> {aluno ? 'Cadastro biométrico' : 'Check-in facial assistido'}</h2>
      {aluno == null && <button type="button" className="btn-outline" aria-pressed={telaCheia}
        onClick={() => setTelaCheia((valor) => !valor)}>
        <Expand size={18} aria-hidden="true" /> {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
      </button>}
      <button type="button" className="btn-outline" onClick={fechar}><X size={18} aria-hidden="true" /> Fechar</button>
    </header>
    <p>Centralize o rosto no guia e siga o movimento solicitado. Se a verificação falhar, use o check-in manual.</p>
    {aluno && <label className="facial-consentimento">
      <input type="checkbox" checked={acordo} disabled={camera} onChange={(evento) => setAcordo(evento.target.checked)} />
      Confirmo que o aluno recebeu o aviso de privacidade e deu consentimento específico para check-in facial. O descritor criptografado vence em 90 dias e pode ser excluído antes.
    </label>}
    {camera && <div className="facial-camera"><video ref={video} autoPlay playsInline muted aria-label="Imagem da sua câmera" />
      <span aria-hidden="true" /></div>}
    {!camera ? <button type="button" className="btn-salvar" disabled={aluno != null && !acordo} onClick={() => setCamera(true)}>
      <Camera size={19} aria-hidden="true" /> Abrir câmera
    </button> : !confirmacao && <button type="button" className="btn-salvar" disabled={ocupado} onClick={desafio ? verificar : iniciar}>
      {ocupado ? 'Verificando…' : desafio ? 'Verificar movimento' : 'Iniciar verificação'}
    </button>}
    {desafio && <p role="status">Desloque o rosto para a {desafio.direcao} da imagem, mantendo-o no guia. Depois toque em Verificar movimento.</p>}
    {confirmacao && <form onSubmit={confirmar} className="facial-confirmacao">
      <label className="campo">CPF para confirmação pela recepção
        <input type="text" inputMode="numeric" autoComplete="off" maxLength={14} value={cpf} onChange={(e) => setCpf(e.target.value)} required />
      </label>
      <button className="btn-salvar" disabled={ocupado}>Confirmar check-in</button>
    </form>}
    {mensagem && <p role="status" className="facial-mensagem">{mensagem}</p>}
    {resultado && <p role="status" className={resultado === 'liberado' ? 'facial-liberado' : 'facial-negado'}>
      {resultado === 'liberado' ? 'Acesso liberado.' : 'Acesso não liberado. Consulte a recepção.'}</p>}
  </dialog>;
}

CameraFacial.propTypes = { aluno:PropTypes.number, aviso:PropTypes.string,
  fechar:PropTypes.func.isRequired, aoConcluir:PropTypes.func.isRequired };

export default function CheckinFacial({ aluno, administrador, aoCheckin }) {
  const [dados,setDados] = useState(null);
  const [mensagem,setMensagem] = useState('');
  const [aberto,setAberto] = useState(false);
  const [ocupado,setOcupado] = useState(false);
  const [politica,setPolitica] = useState(false);
  const [recarga,setRecarga] = useState(0);
  const endereco = aluno != null ? rota+'/alunos/'+aluno : rota;

  useEffect(() => {
    const controle = new AbortController();
    api.get(endereco,{signal:controle.signal}).then(({data}) => {
      if (!controle.signal.aborted) setDados(data);
    }).catch(() => {});
    return () => controle.abort();
  },[endereco,recarga]);

  async function alterar(acao) {
    if (acao === 'excluir' && !window.confirm('Excluir o cadastro biométrico deste aluno?')) return;
    if (acao === 'desativar' && !window.confirm('Desativar a função e excluir os cadastros biométricos da academia?')) return;
    setOcupado(true);
    setMensagem('');
    try {
      if (acao === 'excluir') await api.delete(endereco);
      else await api.put(rota,{ativo:acao === 'ativar',politica_confirmada:politica});
      setRecarga((valor) => valor+1);
    } catch (falha) {
      setMensagem(erroApi(falha));
    } finally {
      setOcupado(false);
    }
  }

  if (!dados?.instalado || (!administrador && !dados.ativo)) return null;
  return <section className="form-card facial-configuracao">
    <h3><ShieldCheck size={20} aria-hidden="true" /> {aluno != null ? 'Biometria facial' : 'Check-in facial'}</h3>
    {aluno != null ? <>
      <p>{dados.cadastrado ? `Cadastro vigente até ${new Date(dados.expira_em).toLocaleDateString('pt-BR',{timeZone:'America/Fortaleza'})}.` : 'Nenhum cadastro biométrico vigente.'}</p>
      {dados.ativo && dados.pronto && <button type="button" className="btn-outline" onClick={() => setAberto(true)}>
        <Camera size={18} aria-hidden="true" /> {dados.cadastrado ? 'Atualizar biometria' : 'Cadastrar biometria'}
      </button>}
      {dados.cadastrado && <button type="button" className="btn-outline" disabled={ocupado} onClick={() => alterar('excluir')}>
        <Trash2 size={18} aria-hidden="true" /> Excluir biometria</button>}
    </> : <>
      <p>{dados.ativo ? 'Modo assistido com confirmação pela recepção.' : 'Desativado nesta academia.'} O check-in manual continua disponível.</p>
      {dados.ativo && dados.pronto && <button type="button" className="btn-salvar" onClick={() => setAberto(true)}>
        <ScanFace size={18} aria-hidden="true" /> Abrir quiosque
      </button>}
      {administrador && (dados.ativo ? <button type="button" className="btn-outline" disabled={ocupado} onClick={() => alterar('desativar')}>Desativar e excluir cadastros</button>
        : dados.pronto ? <>
          <label className="facial-consentimento"><input type="checkbox" checked={politica} onChange={(e) => setPolitica(e.target.checked)} />
            Confirmo que a academia aprovou o aviso de privacidade, a base legal e a retenção de 90 dias.</label>
          <button type="button" className="btn-outline" disabled={!politica || ocupado} onClick={() => alterar('ativar')}>Habilitar modo assistido</button>
        </> : <p>O serviço ainda não está configurado neste ambiente.</p>)}
    </>}
    {mensagem && <p role="alert">{mensagem}</p>}
    {aberto && <CameraFacial aluno={aluno} aviso={dados.aviso} fechar={() => setAberto(false)}
      aoConcluir={() => { if (aluno != null) setRecarga((valor) => valor+1); else aoCheckin?.(); }} />}
  </section>;
}

CheckinFacial.propTypes = { aluno:PropTypes.number, administrador:PropTypes.bool.isRequired, aoCheckin:PropTypes.func };
