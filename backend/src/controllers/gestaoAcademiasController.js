const gestao = require('../models/GestaoAcademias');
const { validarDadosAcademia } = require('../services/cadastroPublico');
const { origemConvite } = require('./superAdminConviteController');
const { validarDataYMD } = require('../utils/datasFortaleza');

const idValido = (id) => /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2147483647;
const resposta = (res, status, mensagem) => res.status(status).json({ mensagem });
const campos = ['nome_fantasia','razao_social','tipo','documento','whatsapp_comercial','cep','logradouro',
  'numero','complemento','bairro','cidade','uf','responsavel_nome','email','responsavel_whatsapp'];

function executar(handler) {
  return async (req, res) => {
    if (req.params.id && !idValido(req.params.id)) return resposta(res, 400, 'Academia inválida.');
    try {
      return await handler(req, res, Number(req.params.id));
    } catch (falha) {
      if ([400,401,404,409,428,503].includes(falha.status)) return resposta(res, falha.status, falha.message);
      if (falha.code === '23505') return resposta(res, 409, 'Já existe cadastro com este documento e endereço.');
      if (['55P03', '40P01', '23503'].includes(falha.code)) {
        return resposta(res, 409, 'Há vínculos ou operações em andamento. A exclusão definitiva não foi realizada.');
      }
      return resposta(res, 503, 'Não foi possível concluir a operação da academia.');
    }
  };
}

const visualizar = executar(async (req, res, id) => res.json(await gestao.visualizar(req.superAdmin, id)));

const cadastrar = executar(async (req, res) => {
  const { cadastro, condicao } = req.body || {};
  const chave = req.get('Idempotency-Key');
  if (!cadastro || !condicao || !/^[a-f0-9]{32}$/.test(chave || '') ||
      Object.keys(cadastro).some((campo) => !campos.includes(campo)) ||
      !['teste','mensal','cortesia'].includes(condicao.tipo) ||
      !Number.isInteger(condicao.preco) || condicao.preco <= 0 ||
      typeof condicao.convite !== 'boolean' || typeof condicao.ativar !== 'boolean' ||
      (condicao.ativar && !condicao.convite)) return resposta(res, 400, 'Confira os dados e a condição comercial.');
  const atual = { tipo: condicao.tipo, preco: condicao.preco, convite: condicao.convite, ativar: condicao.ativar };
  if (atual.tipo === 'cortesia') {
    const motivo = typeof condicao.motivo === 'string' ? condicao.motivo.trim() : '';
    if (!motivo || motivo.length > 240 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(motivo) ||
        (condicao.ate !== null && (!validarDataYMD(condicao.ate) || condicao.ate > '9999-12-30'))) {
      return resposta(res, 400, 'Informe o motivo e o término da cortesia ou escolha cortesia permanente.');
    }
    Object.assign(atual, { motivo, ate: condicao.ate });
  }
  const origem = atual.convite && origemConvite();
  if (atual.convite && !origem) return resposta(res, 503, 'A origem de entrega do convite não está configurada.');
  const { token, repetido, ...dados } = await gestao.criar(req.superAdmin, validarDadosAcademia(cadastro), atual, chave);
  return res.status(repetido ? 200 : 201).json({ ...dados, repetido: Boolean(repetido),
    ...(token && { link: `${origem}/aceitar-convite#${token}` }) });
});

const editar = executar(async (req, res, id) => {
  const { cadastro, confirmar } = req.body || {};
  if (confirmar !== true || !cadastro || Object.keys(cadastro).some((campo) => !campos.includes(campo))) {
    return resposta(res, 400, 'Confirme a edição e confira os dados.');
  }
  await gestao.editar(req.superAdmin, id, validarDadosAcademia(cadastro));
  return res.status(204).end();
});

const excluir = (definitiva) => executar(async (req, res, id) => {
  if (req.body?.confirmar !== true) return resposta(res, 400, 'Confirme a exclusão da academia.');
  await gestao.excluir(req.superAdmin, id, definitiva);
  return res.status(204).end();
});

module.exports = { visualizar, cadastrar, editar, excluir };
