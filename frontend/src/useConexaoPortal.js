import { useEffect, useState } from 'react';
import { eventoFalhaPortal } from './apiPortalAluno';

export function useConexaoPortal() {
  const [online,setOnline] = useState(() => navigator.onLine);
  const [falha,setFalha] = useState(false);
  const [tentativa,setTentativa] = useState(0);

  useEffect(() => {
    function reconectado() {
      setOnline(true);
      setFalha(false);
      setTentativa((valor) => valor+1);
    }
    const desconectado = () => setOnline(false);
    const indisponivel = () => setFalha(true);
    window.addEventListener('online',reconectado);
    window.addEventListener('offline',desconectado);
    window.addEventListener(eventoFalhaPortal,indisponivel);
    return () => {
      window.removeEventListener('online',reconectado);
      window.removeEventListener('offline',desconectado);
      window.removeEventListener(eventoFalhaPortal,indisponivel);
    };
  },[]);

  return {
    indisponivel:!online || falha, tentativa,
    tentar:() => {
      setOnline(navigator.onLine);
      setFalha(false);
      setTentativa((valor) => valor+1);
    },
  };
}
