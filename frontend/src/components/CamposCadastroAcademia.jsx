import { useEffect, useId, useRef, useState } from 'react';
import { MINIMO_SENHA } from '../politicaSenha';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const camposAcademia = [
  ['nome_fantasia', 'Nome fantasia', 160],
  ['razao_social', 'Razão social', 160],
  ['whatsapp_comercial', 'WhatsApp comercial', 24, 'tel'],
];
const camposEndereco = [
  ['cep', 'CEP', 9],
  ['logradouro', 'Logradouro', 160],
  ['numero', 'Número', 20],
  ['complemento', 'Complemento', 100],
  ['bairro', 'Bairro', 100],
  ['cidade', 'Cidade', 100],
];
const camposResponsavel = [
  ['responsavel_nome', 'Nome completo', 160],
  ['email', 'E-mail', 254, 'email'],
  ['responsavel_whatsapp', 'WhatsApp', 24, 'tel'],
];
const digitos = (valor) => (valor || '').replace(/\D/g, '');

export function useConsultaCep(dados, setDados, cepInicial = '') {
  const [avisoCep, setAvisoCep] = useState('');
  const dadosAtuais = useRef(dados);
  dadosAtuais.current = dados;
  const cep = digitos(dados.cep);
  useEffect(() => {
    setAvisoCep('');
    if (cep.length !== 8 || cep === cepInicial) return;
    const consulta = new AbortController();
    const enderecoAnterior = dadosAtuais.current;
    const timeout = setTimeout(() => consulta.abort('tempo'), 5000);
    fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: consulta.signal, referrerPolicy: 'no-referrer' })
      .then((resposta) => {
        if (!resposta.ok) throw new Error();
        return resposta.json();
      })
      .then((endereco) => {
        if (endereco.erro) throw new Error();
        setDados((atual) => {
          if (digitos(atual.cep) !== cep) return atual;
          const preenchido = { ...atual };
          for (const [campo, valor] of Object.entries({
            logradouro: endereco.logradouro, bairro: endereco.bairro, cidade: endereco.localidade, uf: endereco.uf,
          })) {
            if (valor && atual[campo] === enderecoAnterior[campo]) preenchido[campo] = valor;
          }
          return preenchido;
        });
      })
      .catch(() => {
        if (!consulta.signal.aborted || consulta.signal.reason === 'tempo') {
          setAvisoCep('Consulta de CEP indisponível. Preencha o endereço manualmente.');
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      consulta.abort();
    };
  }, [cep, cepInicial, setDados]);

  return avisoCep;
}

export default function CamposCadastroAcademia({ dados, setDados, etapa, avisoCep, comSenha = false }) {
  const prefixo = useId();
  const campo = ([nome, rotulo, maxLength, type = 'text'], requerido = true) => (
    <div className="campo" key={nome}>
      <label htmlFor={prefixo + nome}>{rotulo}</label>
      <input id={prefixo + nome} name={nome} type={type} value={dados[nome] || ''} maxLength={maxLength}
        onChange={(e) => setDados((atual) => ({ ...atual, [nome]: e.target.value }))}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        minLength={type === 'password' ? MINIMO_SENHA : undefined} required={requerido} />
    </div>
  );

  return <>
    {(etapa === undefined || etapa === 0) && <>
      {campo(camposAcademia[0])}
      <div className="campo">
        <label htmlFor={prefixo + 'tipo'}>Tipo de cadastro</label>
        <select id={prefixo + 'tipo'} value={dados.tipo} onChange={(e) => setDados((atual) => ({ ...atual, tipo: e.target.value, documento: '', razao_social: '' }))}>
          <option value="mei">MEI</option>
          <option value="empresa">Empresa</option>
          <option value="pessoa_fisica">Pessoa física/autônomo</option>
        </select>
      </div>
      {campo(['documento', dados.tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ', 18])}
      {dados.tipo !== 'pessoa_fisica' && campo(camposAcademia[1])}
      {campo(camposAcademia[2])}
    </>}
    {(etapa === undefined || etapa === 1) && <>
      {camposEndereco.map((item) => campo(item, item[0] !== 'complemento'))}
      <div className="campo">
        <label htmlFor={prefixo + 'uf'}>UF</label>
        <select id={prefixo + 'uf'} required value={dados.uf || ''} onChange={(e) => setDados((atual) => ({ ...atual, uf: e.target.value }))}>
          <option value="">Selecione</option>
          {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>
      {avisoCep && <p role="status">{avisoCep}</p>}
    </>}
    {(etapa === undefined || etapa === 2) && <>
      {camposResponsavel.map((item) => campo(item))}
      {comSenha && campo(['senha', 'Senha', 72, 'password'])}
      {comSenha && campo(['confirmacao', 'Confirme a senha', 72, 'password'])}
    </>}
  </>;
}
