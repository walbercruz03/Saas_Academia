import { useEffect, useRef, useState } from 'react';

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
