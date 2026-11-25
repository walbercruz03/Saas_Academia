const { validarDataYMD } = require('../utils/datasFortaleza');

function matriculasImpedidas(obrigacoes, hoje, toleranciaDias) {
  const impedidas = new Set();
  const pagasOuAmbiguas = new Set();
  const chaveVencimento = (item) => `${item.matricula_id}:${item.data_vencimento}`;

  for (const item of obrigacoes) {
    if (item.status !== 'cancelado' && (item.status === 'pago' || item.data_pagamento != null)) {
      pagasOuAmbiguas.add(chaveVencimento(item));
    }
  }
  for (const item of obrigacoes) {
    if (!['pendente', 'vencido'].includes(item.status) || !Number.isFinite(item.valor) || item.valor <= 0 ||
        !validarDataYMD(item.data_vencimento) || pagasOuAmbiguas.has(chaveVencimento(item))) continue;
    const diasDesdeVencimento = (Date.parse(hoje) - Date.parse(item.data_vencimento)) / 86400000;
    if (diasDesdeVencimento > toleranciaDias) impedidas.add(item.matricula_id);
  }
  return impedidas;
}

module.exports = { matriculasImpedidas };
