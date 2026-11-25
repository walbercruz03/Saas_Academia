const comercial = require('../models/ComercialWcFit');
const { criarApi } = require('../services/asaasSandbox');
const asaas = require('../services/asaasComercial');
const conciliacao = require('../services/asaasConciliacao');
const { validarDataYMD } = require('../utils/datasFortaleza');

const texto = (valor, limite) => typeof valor === 'string' && valor.trim() &&
  valor.trim().length <= limite && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(valor) ? valor.trim() : null;
const inteira = (valor, limite) => /^[1-9]\d{0,9}$/.test(valor) && Number(valor) <= limite;
const invalido = (res, mensagem = 'Parâmetros comerciais inválidos.') => res.status(400).json({ mensagem });

function executar(handler) {
  return async (req, res) => {
    try {
      if (!await comercial.disponivel()) return res.status(503).json({ mensagem: 'Gestão comercial indisponível neste banco.' });
      return await handler(req,res);
    } catch (erro) {
      if ([400,401,404,409,502,503].includes(erro.status)) return res.status(erro.status).json({ mensagem: erro.message });
      return res.status(503).json({ mensagem: 'Não foi possível concluir a operação comercial.' });
    }
  };
}

const listar = executar(async (req,res) => {
  const { busca = '', pagina = '1' } = req.query;
  if (typeof pagina !== 'string' || !inteira(pagina,999999) || typeof busca !== 'string' || busca.length > 160) return invalido(res);
  return res.json(await comercial.listar({ busca:busca.trim(), pagina:Number(pagina) }));
});

const detalhes = executar(async (req,res) => {
  const { pagina = '1' } = req.query;
  if (!inteira(req.params.id,2147483647) || typeof pagina !== 'string' || !inteira(pagina,999999)) return invalido(res);
  const dados = await comercial.detalhes(Number(req.params.id),Number(pagina));
  return res.json({ ...dados, asaasSandbox:await asaas.estado(Number(req.params.id)) });
});

const cobrancasSandbox = executar(async (req, res) => {
  const { pagina = '1', assinatura = '' } = req.query;
  if (!inteira(req.params.id,2147483647) || typeof pagina !== 'string' || !inteira(pagina,999999) ||
      typeof assinatura !== 'string' || (assinatura && !inteira(assinatura,2147483647))) return invalido(res);
  const id = Number(req.params.id);
  if (await asaas.disponivel()) {
    return res.json(await conciliacao.consultarCobrancas(id,Number(pagina),Number(assinatura)));
  }
  const cliente = await comercial.clienteAsaasSandbox(id);
  if (!cliente) return res.status(404).json({ mensagem: 'Academia sem cliente vinculado no Asaas Sandbox.' });
  const api = criarApi();
  const legado = await api.consultarAssinatura(id, cliente);
  if (!legado) return res.status(404).json({ mensagem: 'Assinatura Sandbox ainda indisponível.' });
  return res.json({ pagina: Number(pagina), ...await api.listarCobrancas(cliente, legado.id, (Number(pagina) - 1) * 20) });
});

const operarSandbox = (acao) => executar(async (req,res) => {
  if (!inteira(req.params.id,2147483647)) return invalido(res);
  const id = Number(req.params.id);
  const token = req.superAdmin.tokenHash;
  if (acao === 'conciliar') {
    const { pagina, assinatura } = req.body || {};
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 999999 ||
        !Number.isInteger(assinatura) || assinatura < 1 || assinatura > 2147483647) return invalido(res);
    return res.json(await conciliacao.consultarCobrancas(id,pagina,assinatura,true));
  }
  if (acao === 'cancelar') return res.json(await asaas.cancelar(token,id));
  const dados = await asaas.provisionar(token,id,acao,req.body || {});
  return res.status(dados.repetido ? 200 : 201).json(dados);
});

const alterarPreco = executar(async (req,res) => {
  const valor = req.body?.valor_centavos;
  if (!Number.isInteger(valor) || valor < 1 || valor > 2147483647) return invalido(res,'Informe um preço válido.');
  return res.json(await comercial.alterarPreco(req.superAdmin.tokenHash,valor));
});

const operar = (acao) => executar(async (req,res) => {
  if (!inteira(req.params.id,2147483647)) return invalido(res);
  const id = Number(req.params.id);
  const token = req.superAdmin.tokenHash;
  const dados = req.body || {};

  if (acao === 'iniciar') {
    await comercial.iniciar(token,id);
    return res.status(204).end();
  }
  if (acao === 'receber') {
    const chave = req.get('Idempotency-Key');
    const referencia = dados.referencia ? texto(dados.referencia,120) : null;
    if (!/^[a-f0-9]{32}$/.test(chave || '') || !validarDataYMD(dados.competencia) ||
        !validarDataYMD(dados.recebido_em) || (dados.referencia && !referencia)) return invalido(res);
    const resultado = await comercial.receber(token,id,{ competencia:dados.competencia,
      recebidoEm:dados.recebido_em,referencia,chave });
    return res.status(resultado.repetido ? 200 : 201).json(resultado);
  }

  const motivo = texto(dados.motivo,240);
  if (!motivo) return invalido(res,'Informe o motivo da cortesia.');
  if (acao === 'revogar') {
    await comercial.revogar(token,id,motivo);
  } else {
    if (dados.ate !== null && (!validarDataYMD(dados.ate) || dados.ate > '9999-12-30')) {
      return invalido(res,'Informe o fim da cortesia ou escolha permanente.');
    }
    await comercial.conceder(token,id,dados.ate,motivo);
  }
  return res.status(204).end();
});

module.exports = { listar, detalhes, cobrancasSandbox, operarSandbox, alterarPreco, operar };
