import { useState } from 'react';
import api from './api';
import { useAuth } from './contexts/AuthContext';

function ler(escopo) {
  try {
    return JSON.parse(sessionStorage.getItem(escopo));
  } catch {
    return null;
  }
}

export default function useOperacaoPendente(tipo, endpoint) {
  const { usuario } = useAuth();
  const escopo = `wcfit:reenvio:${usuario?.academia_id}:${usuario?.id}:${tipo}`;
  const [, atualizar] = useState(null);

  const salvar = (operacao) => {
    if (operacao) sessionStorage.setItem(escopo, JSON.stringify(operacao));
    else sessionStorage.removeItem(escopo);
    atualizar(operacao);
  };

  const enviar = async (dados) => {
    let operacao = ler(escopo);
    if (operacao?.legado) {
      throw new Error('Confira o histórico e encerre a pendência antes de registrar novamente.');
    }
    if (operacao && dados) {
      throw new Error('Confirme o resultado do envio anterior antes de iniciar outra operação.');
    }
    if (!operacao) {
      if (!dados || !usuario?.academia_id || !usuario?.id) throw new Error('Operação pendente indisponível.');
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const chave = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      operacao = { chave, dados };
      salvar(operacao);
    }

    try {
      try {
        await api.post(endpoint, operacao.dados, { headers: { 'Idempotency-Key': operacao.chave } });
      } catch (erro) {
        if (erro.response?.status !== 501 || erro.response.data?.codigo !== 'IDEMPOTENCIA_SQLITE') throw erro;
        operacao = { ...operacao, legado: true };
        salvar(operacao);
        await api.post(endpoint, operacao.dados);
      }
    } catch (erro) {
      const status = erro.response?.status;
      const conflito = erro.response?.data?.codigo === 'IDEMPOTENCIA_CONFLITO';
      if ([400, 404, 409, 422].includes(status) && !conflito) {
        salvar(null);
        throw erro;
      }
      if (operacao.legado) throw new Error('Envio sem confirmação. Confira o histórico antes de encerrar a pendência.');
      if (!status || status >= 500) {
        throw new Error('Envio sem confirmação. Use Reenviar pendência para recuperar o mesmo resultado.');
      }
      throw erro;
    }
    salvar(null);
  };

  const encerrarLegado = () => {
    if (ler(escopo)?.legado && window.confirm('Você já conferiu se a operação aparece no histórico?')) salvar(null);
  };

  return { pendente: ler(escopo), enviar, encerrarLegado };
}
