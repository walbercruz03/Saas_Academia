const service = require('../services/relatorioService');
const { gerarPDF } = require('../utils/pdfGenerator');
const logFalha = require('../utils/logFalha');

const parametros = (req) => ({
  tipo: req.query.tipo || 'geral',
  periodo: req.query.periodo || 'hoje',
  dataInicio: req.query.dataInicio,
  dataFim: req.query.dataFim,
  academiaId: req.usuario?.academia_id,
});

function dadosProfessor(dados, regras) {
  const { acesso } = require('../services/permissoesProfessor');
  const { resumoFinanceiro, resumoAlunos, resumoFrequencia, resumoMatriculas, resumoPlanos, ...operacional } = dados;
  const { valorContratadoPeriodo, lista, ...matriculas } = resumoMatriculas;
  return { ...operacional,
    ...(acesso(regras,'alunos','visualizar') && { resumoAlunos }),
    ...(acesso(regras,'checkin','visualizar') && { resumoFrequencia }),
    ...(acesso(regras,'matriculas','visualizar') && { resumoMatriculas: { ...matriculas,
      lista: lista.map(({ valor_pago, plano_preco, ...matricula }) => matricula) } }),
    ...(acesso(regras,'planos','visualizar') && { resumoPlanos: { ...resumoPlanos,
      porPlano: resumoPlanos.porPlano.map(({ preco, valorContratadoPlano, ...plano }) => plano) } }),
  };
}

const obterRelatorio = async (req, res) => {
  try {
    if (req.usuario.cargo === 'professor' && req.query.tipo === 'financeiro') {
      return res.status(403).json({ mensagem: 'Acesso ao financeiro reservado ao administrador.' });
    }
    const dados = await service.obterDadosRelatorio(parametros(req));

    res.set('Cache-Control', 'no-store');
    return res.json({
      sucesso: true,
      success: true,
      usuario: req.usuario,
      dados: req.usuario.cargo === 'professor' ? dadosProfessor(dados,req.permissoesProfessor) : dados,
    });
  } catch (err) {
    const status = [400, 403].includes(err.statusCode) ? err.statusCode : 500;
    if (status === 500) logFalha('Falha ao obter relatório', err);
    return res.status(status).json({
      sucesso: false,
      mensagem: status === 500 ? 'Erro ao obter dados do relatório.' : err.message,
    });
  }
};

const resumoDashboard = async (req, res) => {
  try {
    const resumo = await service.obterResumoDashboard(req.usuario.academia_id);
    if (req.usuario.cargo === 'professor') {
      const { acesso } = require('../services/permissoesProfessor');
      delete resumo.valor_contratado;
      if (!acesso(req.permissoesProfessor,'alunos','visualizar')) delete resumo.total_alunos;
      if (!acesso(req.permissoesProfessor,'planos','visualizar')) delete resumo.total_planos;
      if (!acesso(req.permissoesProfessor,'matriculas','visualizar')) delete resumo.situacoes;
    }
    return res.set('Cache-Control', 'no-store').json(resumo);
  } catch (erro) {
    logFalha('Falha ao obter resumo do painel', erro);
    return res.status(500).json({ mensagem: 'Erro ao carregar estatísticas.' });
  }
};

const obterRelatorioHoje = async (req, res) => {
  req.query.periodo = 'hoje';
  return obterRelatorio(req, res);
};

const gerarPDFRelatorio = async (req, res) => {
  try {
    const dados = await service.obterDadosRelatorio(parametros(req));

    res.set('Cache-Control', 'no-store');
    return gerarPDF({
      ...dados,
      geradoEm: new Date().toISOString(),
      usuario: req.usuario,
    }, res);
  } catch (err) {
    const status = [400, 403].includes(err.statusCode) ? err.statusCode : 500;
    if (status === 500) logFalha('Falha ao gerar PDF do relatório', err);
    if (res.headersSent) return res.destroy();
    return res.status(status).json({
      sucesso: false,
      mensagem: status === 500 ? 'Erro ao gerar relatório PDF.' : err.message,
    });
  }
};

const gerarPDFHoje = async (req, res) => {
  req.query.periodo = 'hoje';
  return gerarPDFRelatorio(req, res);
};

module.exports = {
  obterRelatorio,
  resumoDashboard,
  obterRelatorioHoje,
  gerarPDFRelatorio,
  gerarPDFHoje,
};
