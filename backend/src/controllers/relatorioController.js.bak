const service = require('../services/relatorioService');
const { gerarPDF } = require('../utils/pdfGenerator');

const obterRelatorio = async (req, res) => {
  try {
    const tipo = req.query.tipo || 'geral';
    const periodo = req.query.periodo || 'hoje';
    const dataInicio = req.query.dataInicio;
    const dataFim = req.query.dataFim;

    const dados = await service.obterDadosRelatorio({
      tipo,
      periodo,
      dataInicio,
      dataFim,
    });

    return res.json({
      sucesso: true,
      success: true,
      usuario: req.usuario,
      dados,
    });
  } catch (err) {
    console.error('Erro ao obter relatório:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
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
    const tipo = req.query.tipo || 'geral';
    const periodo = req.query.periodo || 'hoje';
    const dataInicio = req.query.dataInicio;
    const dataFim = req.query.dataFim;

    const dados = await service.obterDadosRelatorio({
      tipo,
      periodo,
      dataInicio,
      dataFim,
    });

    return gerarPDF(
      {
        ...dados,
        geradoEm: new Date().toISOString(),
        usuario: req.usuario,
      },
      res
    );
  } catch (err) {
    console.error('Erro ao gerar PDF do relatório:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
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