const service = require('../services/relatorioService');
const { gerarPDF } = require('../utils/pdfGenerator');

const parametros = (req) => ({
  tipo: req.query.tipo || 'geral',
  periodo: req.query.periodo || 'hoje',
  dataInicio: req.query.dataInicio,
  dataFim: req.query.dataFim,
  academiaId: req.usuario?.academia_id,
});

const obterRelatorio = async (req, res) => {
  try {
    const dados = await service.obterDadosRelatorio(parametros(req));

    return res.json({
      sucesso: true,
      success: true,
      usuario: req.usuario,
      dados,
    });
  } catch (err) {
    console.error('Erro ao obter relatório:', err);

    return res.status(err.statusCode || 500).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao obter dados do relatório.',
    });
  }
};

const obterRelatorioHoje = async (req, res) => {
  req.query.periodo = 'hoje';
  return obterRelatorio(req, res);
};

const gerarPDFRelatorio = async (req, res) => {
  try {
    const dados = await service.obterDadosRelatorio(parametros(req));

    return gerarPDF({
      ...dados,
      geradoEm: new Date().toISOString(),
      usuario: req.usuario,
    }, res);
  } catch (err) {
    console.error('Erro ao gerar PDF do relatório:', err);

    return res.status(err.statusCode || 500).json({
      sucesso: false,
      mensagem: err.message || 'Erro ao gerar relatório PDF.',
    });
  }
};

const gerarPDFHoje = async (req, res) => {
  req.query.periodo = 'hoje';
  return gerarPDFRelatorio(req, res);
};

module.exports = {
  obterRelatorio,
  obterRelatorioHoje,
  gerarPDFRelatorio,
  gerarPDFHoje,
};
