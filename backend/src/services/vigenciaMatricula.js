const { formatarYMD, validarDataYMD } = require('../utils/datasFortaleza');

function dataContratual(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}($|[ T])/.test(valor)) return null;
  const data = valor.slice(0, 10);
  return validarDataYMD(data) ? data : null;
}

function situacaoEfetiva(matricula, hoje) {
  if (matricula.status === 'cancelado') return 'cancelada';
  if (matricula.status === 'suspenso') return 'suspensa';
  const inicio = dataContratual(matricula.data_inicio);
  const fim = dataContratual(matricula.data_vencimento);
  if (!inicio || !fim || inicio > fim || !matricula.plano_valido || !matricula.aluno_status) return 'inconsistente';
  if (matricula.status === 'vencido' || fim < hoje) return 'vencida';
  if (matricula.status !== 'ativo') return 'inconsistente';
  if (!['ativo', 'inadimplente'].includes(matricula.aluno_status)) return 'aluno_inativo';
  return inicio > hoje ? 'futura' : 'vigente';
}

function vigenciaRenovacao(fimAnterior, meses, hoje) {
  if (!validarDataYMD(fimAnterior) || !validarDataYMD(hoje) || !Number.isInteger(meses) || meses < 1) return null;
  const somarDias = (data, dias) => {
    const [ano, mes, dia] = data.split('-').map(Number);
    return formatarYMD(ano, mes, dia + dias);
  };
  const data_inicio = fimAnterior >= hoje ? somarDias(fimAnterior, 1) : hoje;
  if (!validarDataYMD(data_inicio)) return null;
  const [ano, mes, dia] = data_inicio.split('-').map(Number);
  const aniversario = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const anoFinal = aniversario.getUTCFullYear();
  const mesFinal = aniversario.getUTCMonth() + 1;
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal, 0)).getUTCDate();
  // A vigência é inclusiva. O aniversário do plano é o primeiro dia fora dela.
  const data_vencimento = formatarYMD(anoFinal, mesFinal, Math.min(dia, ultimoDia) - 1);
  return validarDataYMD(data_vencimento) ? { data_inicio, data_vencimento } : null;
}

module.exports = { dataContratual, situacaoEfetiva, vigenciaRenovacao };
