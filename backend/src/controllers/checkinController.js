const { getDataHojeFortaleza } = require('../utils/datasFortaleza');
const { situacaoEfetiva } = require('../services/vigenciaMatricula');
const { extrairCpfCompleto, mascararCpf } = require('../utils/documentosBrasileiros');
const Checkin = require('../models/Checkin');
const Aluno = require('../models/Aluno');
const Financeiro = require('../models/Financeiro');
const { matriculasImpedidas } = require('../services/inadimplenciaCheckin');
const { confirmacaoFacial } = require('../services/checkinFacial');
const db = require('../config/database');
const idempotencia = require('../services/operacaoIdempotente');

const consultar = (metodo, parametros, executor) => new Promise((resolve, reject) => {
  metodo(...parametros, (erro, dados) => erro ? reject(erro) : resolve(dados), executor);
});

const politicaIndisponivel = (res) => res.status(503).json({ mensagem: 'Configuração de inadimplência indisponível neste banco.' });

const checkinController = {
  async buscarPolitica(req, res) {
    try {
      const politica = await consultar(Checkin.buscarPolitica, [req.usuario.academia_id]);
      if (politica?.bloqueio == null) return politicaIndisponivel(res);
      return res.set('Cache-Control', 'no-store').json(politica);
    } catch {
      return politicaIndisponivel(res);
    }
  },

  async salvarPolitica(req, res) {
    const { bloqueio, tolerancia_dias } = req.body || {};
    if (typeof bloqueio !== 'boolean' || !Number.isInteger(tolerancia_dias) ||
        tolerancia_dias < 0 || tolerancia_dias > 2147483647) {
      return res.status(400).json({ mensagem: 'Informe um bloqueio válido e dias de tolerância inteiros e não negativos.' });
    }
    if (db.isSqlite) return politicaIndisponivel(res);
    try {
      const politica = await consultar(Checkin.salvarPolitica, [req.usuario.academia_id, bloqueio, tolerancia_dias]);
      if (!politica) return res.status(403).json({ mensagem: 'Sessão sem acesso à academia.' });
      return res.json(politica);
    } catch {
      return politicaIndisponivel(res);
    }
  },

  listar(req, res) {
    const { academia_id } = req.usuario;
    const { pagina } = req.query;
    if (pagina !== undefined && (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina))) {
      return res.status(400).json({ mensagem: 'Página inválida.' });
    }

    Checkin.listar({ academia_id, pagina: pagina === undefined ? undefined : Number(pagina) }, (err, checkins) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar check-ins.' });
      const mascarar = (registro) => ({ ...registro, aluno_cpf: mascararCpf(registro.aluno_cpf) });
      res.json(Array.isArray(checkins)
        ? checkins.map(mascarar)
        : { ...checkins, registros: checkins.registros.map(mascarar) });
    });
  },

  buscarAluno(req, res) {
    const cpf = req.method === 'POST' ? req.body?.cpf : req.query.cpf;
    const digitos = extrairCpfCompleto(cpf);
    if (!digitos) return res.status(400).json({ mensagem: 'Informe o CPF completo.' });
    Aluno.buscarPorCpf(digitos, req.usuario.academia_id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
      res.set('Cache-Control', 'no-store').json({ ...aluno, cpf: mascararCpf(aluno.cpf) });
    });
  },

  async realizarCheckin(req, res) {
    const { aluno_id, status = 'presente', observacoes } = req.body || {};
    const { academia_id } = req.usuario;
    const gravar = async (executor) => {
      if (!aluno_id) throw idempotencia.erroOperacao(400, 'Aluno é obrigatório.');
      if (!['presente', 'ausente'].includes(status)) {
        throw idempotencia.erroOperacao(400, 'Situação de check-in inválida.');
      }
      const aluno = await consultar(Aluno.findById, [aluno_id, academia_id], executor);
      if (!aluno) throw idempotencia.erroOperacao(404, 'Aluno não encontrado.');
      if (!['ativo', 'inadimplente'].includes(aluno.status)) {
        throw idempotencia.erroOperacao(409, 'O cadastro do aluno está inativo para check-in.');
      }
      const matriculas = await consultar(Checkin.buscarMatriculas, [aluno_id, academia_id], executor);
      const agora = new Date();
      const hoje = getDataHojeFortaleza(agora);
      const vigentes = matriculas.filter((item) => situacaoEfetiva(item, hoje) === 'vigente');
      if (!vigentes.length) throw idempotencia.erroOperacao(409, 'O aluno não possui matrícula vigente para check-in.');

      const politica = await consultar(Checkin.buscarPolitica, [academia_id], executor);
      let matricula = vigentes[0];
      if (politica?.bloqueio) {
        const obrigacoes = await consultar(Financeiro.listarMensalidadesParaCheckin, [aluno_id, academia_id], executor);
        const impedidas = matriculasImpedidas(obrigacoes, hoje, politica.tolerancia_dias);
        matricula = vigentes.find((item) => !impedidas.has(item.id));
        if (!matricula) {
          throw idempotencia.erroOperacao(409, 'Check-in indisponível. Consulte a recepção.', 'CHECKIN_PENDENCIA_FINANCEIRA');
        }
      }

      if (req[confirmacaoFacial]) {
        // Essas verificações são exclusivas do quiosque e usam a transação idempotente já aberta.
        await consultar(executor.get.bind(executor),
          ['SELECT pg_advisory_xact_lock(hashtextextended(?,0))', [`facial:${academia_id}:${aluno_id}`]]);
        const habilitado = await consultar(executor.get.bind(executor),
          ['SELECT checkin_facial_ativo FROM academias WHERE id = ? FOR SHARE', [academia_id]]);
        const biometria = await consultar(executor.get.bind(executor), [`
          SELECT 1 FROM aluno_biometrias_faciais WHERE academia_id=? AND aluno_id=? AND expira_em>now() FOR SHARE
        `,[academia_id,aluno_id]]);
        if (!habilitado?.checkin_facial_ativo || !biometria) throw idempotencia.erroOperacao(409,'Confirmação indisponível.');
        const anterior = await consultar(executor.get.bind(executor), [`
          SELECT 1 FROM checkins WHERE academia_id=? AND aluno_id=? AND status='presente'
            AND data_checkin >= now()-interval '60 seconds' LIMIT 1
        `,[academia_id,aluno_id]]);
        if (anterior) throw idempotencia.erroOperacao(409,'Já existe um check-in recente.');
      }

      const registro = await consultar(Checkin.create, [{ aluno_id, status, observacoes, academia_id, matricula }], executor);
      if (!registro.changes) {
        throw idempotencia.erroOperacao(409, 'A elegibilidade mudou. Consulte o aluno novamente.');
      }
      return { id: registro.lastID, aluno_id, aluno_nome: aluno.nome, status, data_checkin: agora.toISOString() };
    };

    try {
      const mensagem = 'Check-in realizado com sucesso.';
      if (req.get('Idempotency-Key') !== undefined) {
        const resultado = await idempotencia.executar(req, 'registrar_checkin',
          [idempotencia.canonizarId(aluno_id), status, observacoes ?? null], gravar);
        return res.set('Idempotency-Replayed', String(resultado.repetido)).status(resultado.status)
          .json({ mensagem, checkin: resultado.recibo });
      }
      return res.status(201).json({ mensagem, checkin: await gravar() });
    } catch (erro) {
      return idempotencia.responder(res, erro, 'Erro ao registrar check-in.');
    }
  },
};

module.exports = checkinController;
