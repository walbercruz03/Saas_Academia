const modelo = require('../models/AcademiaOperacional');

const idValido = (id) => /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2147483647;
const mensagem = {
  401: 'Sessão administrativa inválida ou expirada.',
  404: 'Academia não encontrada.',
  428: 'Confirme novamente o código do autenticador para continuar.',
  CHAVE_REUTILIZADA: 'Esta chave já foi utilizada em outra operação.',
  TRANSICAO_INCOMPATIVEL: 'A ação não corresponde à situação operacional atual.',
  ADMINISTRADOR_NECESSARIO: 'A academia precisa de um administrador ativo com senha definida.',
};

function alterar(operacao) {
  return async (req, res) => {
    const chave = req.get('Idempotency-Key');
    const dados = req.body;
    const motivo = typeof dados?.motivo === 'string' ? dados.motivo.trim() : null;
    if (!idValido(req.params.id) || !/^[a-f0-9]{32}$/.test(chave || '') ||
        !dados || Array.isArray(dados) || dados.confirmado !== true ||
        Object.keys(dados).some((campo) => !['confirmado', 'motivo'].includes(campo)) ||
        (dados.motivo !== undefined && typeof dados.motivo !== 'string') ||
        (operacao !== 'ativar' && !motivo) ||
        (motivo && (motivo.length > 500 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(motivo)))) {
      return res.status(400).json({ mensagem: 'Confirme a operação e informe um motivo válido quando exigido.' });
    }

    const { status, codigo, evento, repetido } = await modelo.alterar({
      tokenHash: req.superAdmin.tokenHash, semTotpLocal: req.superAdmin.semTotpLocal, academiaId: Number(req.params.id), operacao, motivo: motivo || null, chave,
    });
    return status === 200 ? res.json({ evento, repetido })
      : res.status(status).json({ mensagem: mensagem[codigo || status], ...(codigo && { codigo }) });
  };
}

async function historico(req, res) {
  const pagina = req.query.pagina ?? '1';
  if (!idValido(req.params.id) || typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina)) {
    return res.status(400).json({ mensagem: 'Parâmetros de consulta inválidos.' });
  }
  const numero = Number(pagina);
  const registros = await modelo.historico(Number(req.params.id), 21, (numero - 1) * 20);
  return registros ? res.json({ registros: registros.slice(0, 20), pagina: numero, temMais: registros.length > 20 })
    : res.status(404).json({ mensagem: mensagem[404] });
}

module.exports = { alterar, historico };
