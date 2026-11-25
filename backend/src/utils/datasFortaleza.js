const TIMEZONE = 'America/Fortaleza';

const formatarYMD = (ano, mes, dia) => {
  const dt = new Date(Date.UTC(ano, mes - 1, dia));

  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const getDataHojeFortaleza = (agora = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);

  const obter = (tipo) =>
    partes.find((p) => p.type === tipo)?.value;

  return `${obter('year')}-${obter('month')}-${obter('day')}`;
};

const validarDataYMD = (valor) => {
  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return false;
  }

  const [ano, mes, dia] = valor.split('-').map(Number);

  return formatarYMD(ano, mes, dia) === valor;
};

module.exports = { TIMEZONE, formatarYMD, getDataHojeFortaleza, validarDataYMD };
