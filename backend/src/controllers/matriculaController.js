function ocultarRecebimento(req, matricula) {
  if (req.usuario.cargo !== 'professor') return matricula;
  const { valor_pago, ...dados } = matricula;
  return dados;
}
const idempotencia = require('../services/operacaoIdempotente');
const { getDataHojeFortaleza, validarDataYMD } = require('../utils/datasFortaleza');
const { dataContratual, situacaoEfetiva, vigenciaRenovacao } = require('../services/vigenciaMatricula');
const db = require('../config/database');
const Aluno = require('../models/Aluno');
const Plano = require('../models/Plano');
const Matricula = require('../models/Matricula');

function validarVinculos(alunoId, planoId, academiaId, res, continuar) {
  Aluno.findById(alunoId, academiaId, (erroAluno, aluno) => {
    if (erroAluno) return res.status(500).json({ mensagem: 'Erro ao validar matrícula.' });
    if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
    Plano.findById(planoId, academiaId, (erroPlano, plano) => {
      if (erroPlano) return res.status(500).json({ mensagem: 'Erro ao validar matrícula.' });
      if (!plano) return res.status(404).json({ mensagem: 'Plano não encontrado.' });
      continuar();
    });
  });
}

const vigenciaValida = (inicio, fim) => validarDataYMD(inicio) && validarDataYMD(fim) && inicio <= fim;
const consultar = (metodo, parametros, executor) => new Promise((resolve, reject) => {
  metodo(...parametros, (erro, dados) => erro ? reject(erro) : resolve(dados), executor);
});

async function calcularRenovacao(origemId, academiaId, executor) {
  const id = idempotencia.canonizarId(origemId);
  if (typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) {
    throw idempotencia.erroOperacao(400, 'Matrícula de origem inválida.');
  }
  const origem = await consultar(Matricula.buscarOrigemRenovacao, [id, academiaId], executor);
  if (!origem) throw idempotencia.erroOperacao(404, 'Matrícula não encontrada.');
  const hoje = getDataHojeFortaleza();
  if (!['vigente', 'vencida'].includes(situacaoEfetiva(origem, hoje)) ||
      !['ativo', 'inadimplente'].includes(origem.aluno_status) || origem.plano_status !== 'ativo') {
    throw idempotencia.erroOperacao(409, 'Esta matrícula ou plano não está disponível para renovação.');
  }
  const vigencia = vigenciaRenovacao(dataContratual(origem.data_vencimento), origem.duracao_meses, hoje);
  if (!vigencia) throw idempotencia.erroOperacao(409, 'O plano não tem duração válida para renovação.');
  const outras = await consultar(Matricula.listarVigenciasParaRenovacao,
    [origem.aluno_id, academiaId, origem.id], executor);
  if (outras.some((item) => {
    const inicio = dataContratual(item.data_inicio);
    const fim = dataContratual(item.data_vencimento);
    return inicio && fim && inicio <= fim && inicio <= vigencia.data_vencimento && fim >= vigencia.data_inicio;
  })) {
    throw idempotencia.erroOperacao(409, 'Já existe uma matrícula no período da renovação.');
  }
  return {
    origem_id: origem.id,
    aluno_id: origem.aluno_id,
    plano_id: origem.plano_id,
    plano_nome: origem.plano_nome,
    duracao_meses: origem.duracao_meses,
    ...vigencia,
  };
}

function validarVigencia(dataInicio, dataVencimento, res) {
  if (!vigenciaValida(dataInicio, dataVencimento)) {
    res.status(400).json({ mensagem: 'Informe datas válidas e vencimento igual ou posterior ao início.' });
    return false;
  }
  return true;
}

const matriculaController = {
  listar(req, res) {
    const { academia_id } = req.usuario;

    Matricula.listar({ academia_id }, (err, matriculas) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar matrículas.' });
      res.json(matriculas.map((matricula) => ocultarRecebimento(req,matricula)));
    });
  },

  findById(req, res) {
    Matricula.findById(req.params.id, req.usuario.academia_id, (err, matricula) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar matrícula.' });
      if (!matricula) return res.status(404).json({ mensagem: 'Matrícula não encontrada.' });
      res.json(ocultarRecebimento(req,matricula));
    });
  },

  async create(req, res) {
    const { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago } = req.body || {};
    const dados = { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id: req.usuario.academia_id };
    const camposObrigatorios = aluno_id && plano_id && data_inicio && data_vencimento;
    const mensagemCampos = 'Aluno, plano, data de início e vencimento são obrigatórios.';
    if (req.get('Idempotency-Key') !== undefined) {
      try {
        const parametros = [idempotencia.canonizarId(aluno_id), idempotencia.canonizarId(plano_id), data_inicio, data_vencimento,
          status === undefined ? 'ativo' : status, valor_pago === undefined ? 0 : valor_pago];
        const resultado = await idempotencia.executar(req, 'criar_matricula', parametros, (executor) => {
          if (!camposObrigatorios) throw idempotencia.erroOperacao(400, mensagemCampos);
          if (!vigenciaValida(data_inicio, data_vencimento)) {
            throw idempotencia.erroOperacao(400, 'Informe datas válidas e vencimento igual ou posterior ao início.');
          }
          return new Promise((resolve, reject) => Matricula.create(dados, (erro, registro) => {
            if (erro) return reject(erro);
            if (!registro.changes) return reject(idempotencia.erroOperacao(404, 'Aluno ou plano não encontrado.'));
            resolve({ id: registro.lastID });
          }, executor));
        });
        return res.set('Idempotency-Replayed', String(resultado.repetido)).status(resultado.status)
          .json({ mensagem: 'Matrícula criada com sucesso.', matricula: resultado.recibo });
      } catch (erro) {
        return idempotencia.responder(res, erro, 'Erro ao confirmar a criação da matrícula.');
      }
    }
    if (!camposObrigatorios) return res.status(400).json({ mensagem: mensagemCampos });
    if (!validarVigencia(data_inicio, data_vencimento, res)) return;
    validarVinculos(aluno_id, plano_id, req.usuario.academia_id, res, () => {
      Matricula.create({
        aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago,
        academia_id: req.usuario.academia_id,
      }, (err, result) => {
        if (err) return res.status(500).json({ mensagem: 'Erro ao criar matrícula.' });
        if (!result.changes) return res.status(404).json({ mensagem: 'Aluno ou plano não encontrado.' });
        res.status(201).json({
          mensagem: 'Matrícula criada com sucesso.',
          matricula: { id: result.lastID, aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago },
        });
      });
    });
  },

  async previaRenovacao(req, res) {
    if (db.isSqlite) return res.status(501).json({ mensagem: 'A renovação requer PostgreSQL.' });
    try {
      return res.json(await calcularRenovacao(req.params.id, req.usuario.academia_id));
    } catch (erro) {
      return idempotencia.responder(res, erro, 'Erro ao calcular a renovação.');
    }
  },

  async renovar(req, res) {
    if (db.isSqlite) return res.status(501).json({ mensagem: 'A renovação requer PostgreSQL.' });
    const { origem_id, plano_id, duracao_meses, data_inicio, data_vencimento } = req.body || {};
    const academiaId = req.usuario.academia_id;
    try {
      const parametros = [idempotencia.canonizarId(origem_id), idempotencia.canonizarId(plano_id),
        duracao_meses, data_inicio, data_vencimento];
      const resultado = await idempotencia.executar(req, 'renovar_matricula', parametros, async (executor) => {
        const previa = await calcularRenovacao(origem_id, academiaId, executor);
        if (String(previa.plano_id) !== String(plano_id) || previa.duracao_meses !== duracao_meses ||
            previa.data_inicio !== data_inicio || previa.data_vencimento !== data_vencimento) {
          throw idempotencia.erroOperacao(409, 'A vigência ou o plano mudou. Consulte a prévia novamente.');
        }
        const registro = await consultar(Matricula.create, [{
          ...previa, academia_id: academiaId, status: 'ativo', valor_pago: 0,
        }], executor);
        if (!registro.changes) throw idempotencia.erroOperacao(409, 'Aluno ou plano indisponível para renovação.');
        return { id: registro.lastID };
      });
      return res.set('Idempotency-Replayed', String(resultado.repetido)).status(resultado.status)
        .json({ mensagem: 'Matrícula renovada com sucesso.', matricula: resultado.recibo });
    } catch (erro) {
      return idempotencia.responder(res, erro, 'Erro ao confirmar a renovação.');
    }
  },

  atualizar(req, res) {
    const { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago } = req.body;
    if (!validarVigencia(data_inicio, data_vencimento, res)) return;
    validarVinculos(aluno_id, plano_id, req.usuario.academia_id, res, () => {
      Matricula.atualizar(req.params.id, { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago },
        req.usuario.academia_id, function (err) {
          if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar matrícula.' });
          if (!this.changes) return res.status(404).json({ mensagem: 'Matrícula não encontrada.' });
          res.json({ mensagem: 'Matrícula atualizada com sucesso.' });
        });
    });
  },

  excluir(req, res) {
    Matricula.excluir(req.params.id, req.usuario.academia_id, function (err) {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir matrícula.' });
      if (!this.changes) return res.status(404).json({ mensagem: 'Registro não encontrado.' });
      res.json({ mensagem: 'Matrícula excluída com sucesso.' });
    });
  },
};

module.exports = matriculaController;
