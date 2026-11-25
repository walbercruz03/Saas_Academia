export const moedaComercial = (valor) => valor == null ? '—' :
  (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
