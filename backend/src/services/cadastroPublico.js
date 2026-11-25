const { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');
const { consulta, transacao } = require('../models/SuperAdmin');
const comercial = require('../models/ComercialWcFit');
const documentos = require('./documentosLegais');
const enviarEmail = require('./emailTransacional');
const { senhaValida, MENSAGEM_SENHA } = require('./politicaSenha');

const tipos = ['mei', 'empresa', 'pessoa_fisica'];
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const indisponivel = () => erro(503, 'Cadastro público temporariamente indisponível.');

function urlPolitica(valor) {
  if (!valor) return null;
  const url = new URL(valor);
  if (url.protocol !== 'https:' || url.username || url.password) throw indisponivel();
  return url.href;
}

async function configuracao() {
  const { CADASTRO_PUBLICO_ATIVO, CADASTRO_EMAIL_API_KEY, CADASTRO_EMAIL_REMETENTE, CADASTRO_TOKEN_CHAVE, CADASTRO_EMAIL_DESTINO_TESTE } = process.env;
  if (CADASTRO_PUBLICO_ATIVO !== 'true' || !CADASTRO_EMAIL_API_KEY || !CADASTRO_EMAIL_REMETENTE ||
      !/^[a-f0-9]{64}$/i.test(CADASTRO_TOKEN_CHAVE || '') || new Set(CADASTRO_TOKEN_CHAVE.toLowerCase()).size < 12) {
    throw indisponivel();
  }
  const destinoTeste = CADASTRO_EMAIL_DESTINO_TESTE ? emailValido(CADASTRO_EMAIL_DESTINO_TESTE) : null;
  if (CADASTRO_EMAIL_REMETENTE === 'onboarding@resend.dev' && !destinoTeste) throw indisponivel();
  const aprovados = documentos.aprovados();
  if (process.env.LEGAL_DOCUMENTOS_EXIGIDOS === 'true' && !aprovados) throw indisponivel();
  const termos = aprovados?.termos_url ?? urlPolitica(process.env.CADASTRO_TERMOS_URL);
  const privacidade = aprovados?.privacidade_url ?? urlPolitica(process.env.CADASTRO_PRIVACIDADE_URL);
  const { rows: [schema] } = await consulta("SELECT to_regclass('public.cadastro_publico_verificacoes') IS NOT NULL AS pronto");
  if (!schema.pronto) throw indisponivel();
  const autogestao = (await consulta("SELECT to_regclass('public.wcfit_autogestao') IS NOT NULL AS pronta")).rows[0].pronta;
  const preco = await comercial.disponivel() ? await comercial.precoAtual() : null;
  return { apiKey: CADASTRO_EMAIL_API_KEY, remetente: CADASTRO_EMAIL_REMETENTE,
    chave: Buffer.from(CADASTRO_TOKEN_CHAVE, 'hex'), termos, privacidade,
    mensalidade: preco?.valor_centavos ?? 7999, autogestao, destinoTeste };
}

function emailValido(valor) {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)) {
    throw erro(400, 'Informe um e-mail válido.');
  }
  return email;
}

function texto(valor, limite, rotulo, obrigatorio = true) {
  const limpo = typeof valor === 'string' ? valor.trim().normalize('NFC') : '';
  if ((obrigatorio && !limpo) || limpo.length > limite || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(limpo)) {
    throw erro(400, `Confira o campo ${rotulo}.`);
  }
  return limpo;
}

function telefone(valor, rotulo) {
  const raw = texto(valor, 24, rotulo);
  const numero = raw.replace(/[() .+-]/g, '');
  if (!/^(?:55)?[1-9][0-9]{9,10}$/.test(numero)) throw erro(400, `Confira o campo ${rotulo}.`);
  return numero.length <= 11 ? '55' + numero : numero;
}

function validarDestino(email, config) {
  if (config.destinoTeste && email !== config.destinoTeste) throw erro(403,'Cadastro restrito ao destinatário de homologação.');
}

function validarPerfilAcademia(corpo) {
  const cep = texto(corpo.cep, 9, 'CEP').replace('-', '');
  const uf = texto(corpo.uf, 2, 'UF').toUpperCase();
  if (!/^\d{8}$/.test(cep) || !ufs.includes(uf)) throw erro(400, 'Confira o CEP e a UF.');
  const cadastro = {
    cep, uf,
    fantasia: texto(corpo.nome_fantasia, 160, 'nome fantasia'),
    comercial: telefone(corpo.whatsapp_comercial, 'WhatsApp comercial'),
    logradouro: texto(corpo.logradouro, 160, 'logradouro'),
    numero: texto(corpo.numero, 20, 'número'),
    complemento: texto(corpo.complemento, 100, 'complemento', false),
    bairro: texto(corpo.bairro, 100, 'bairro'),
    cidade: texto(corpo.cidade, 100, 'cidade'),
  };
  const normalizar = (valor) => valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  cadastro.unidade = JSON.stringify([cep, uf, cadastro.cidade, cadastro.logradouro,
    cadastro.numero.replace(/^0+(?=\d)/, ''), cadastro.complemento].map(normalizar));
  return cadastro;
}

function validarDadosAcademia(corpo) {
  const { tipo } = corpo;
  if (!tipos.includes(tipo)) throw erro(400, 'Selecione um tipo de cadastro válido.');
  const documento = normalizarDocumento(corpo.documento, tipo);
  if (!documento) throw erro(400, tipo === 'pessoa_fisica' ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.');
  return {
    ...validarPerfilAcademia(corpo),
    tipo, documento, email: emailValido(corpo.email),
    razao: tipo === 'pessoa_fisica' ? null : texto(corpo.razao_social, 160, 'razão social'),
    responsavel: texto(corpo.responsavel_nome, 160, 'nome do responsável'),
    whatsapp: telefone(corpo.responsavel_whatsapp, 'WhatsApp do responsável'),
  };
}

function validarCadastro(corpo, config) {
  const cadastro = validarDadosAcademia(corpo);
  validarDestino(cadastro.email, config);
  if (!senhaValida(corpo.senha)) throw erro(400, MENSAGEM_SENHA);
  if ((config.termos && (corpo.aceite_termos !== true || corpo.termos_url !== config.termos)) ||
      (config.privacidade && (corpo.aceite_privacidade !== true || corpo.privacidade_url !== config.privacidade))) {
    throw erro(400, 'Confira e aceite os documentos apresentados antes de continuar.');
  }
  if (config.autogestao && corpo.aceite_comercial !== true) throw erro(400,'Confirme as condições comerciais.');
  return { ...cadastro, senha: corpo.senha, mensalidade: corpo.mensalidade_centavos };
}

const hash = (valor) => createHash('sha256').update(valor).digest();
const hmac = (chave, ...partes) => createHmac('sha256', chave).update(JSON.stringify(partes)).digest();
const invalido = () => erro(422, 'Código inválido, expirado ou já utilizado.');

async function solicitarCodigo(email, config) {
  validarDestino(email, config);
  const desafio = randomBytes(32).toString('base64url');
  const codigo = String(randomInt(1000000)).padStart(6, '0');
  const emailHmac = hmac(config.chave, 'email', email);
  const desafioHash = hash(desafio);
  await transacao(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wcfit:cadastro-publico:envio'))");
    await client.query("DELETE FROM cadastro_publico_verificacoes WHERE criado_em < clock_timestamp() - interval '1 hour'");
    const { rows: [limite] } = await client.query(`
      SELECT count(*)::int AS total, coalesce(bool_or(email_hmac = $1
        AND criado_em > clock_timestamp() - interval '1 minute'), false) AS recente
      FROM cadastro_publico_verificacoes`, [emailHmac]);
    if (limite.recente || limite.total >= 60) throw erro(429, 'Aguarde antes de solicitar outro código.');
    await client.query(`
      INSERT INTO cadastro_publico_verificacoes (email_hmac, desafio_hash, codigo_hmac, criado_em, expira_em)
      VALUES ($1, $2, $3, clock_timestamp(), clock_timestamp() + interval '15 minutes')
      ON CONFLICT (email_hmac) DO UPDATE SET desafio_hash = EXCLUDED.desafio_hash,
        codigo_hmac = EXCLUDED.codigo_hmac, criado_em = EXCLUDED.criado_em, expira_em = EXCLUDED.expira_em,
        tentativas = 0, consumido_em = NULL`, [emailHmac, desafioHash, hmac(config.chave, 'codigo', email, desafio, codigo)]);
  });

  try {
    await enviarEmail({ ...config, email, assunto: 'Código de verificação do WC Fit',
      texto: `Seu código do WC Fit é ${codigo}. Ele expira em 15 minutos. Se não solicitou o cadastro, ignore esta mensagem.` });
  } catch {
    // Um envio que falhou permanece sujeito ao limite, mas seu código é invalidado.
    await consulta(`UPDATE cadastro_publico_verificacoes SET consumido_em = clock_timestamp()
      WHERE email_hmac = $1 AND desafio_hash = $2`, [emailHmac, desafioHash]);
    throw indisponivel();
  }
  return desafio;
}

async function concluirCadastro(dados, desafio, codigo, config) {
  if (typeof desafio !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(desafio) ||
      typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) throw invalido();
  const emailHmac = hmac(config.chave, 'email', dados.email);
  const resultado = await transacao(async (client) => {
    const { rows: [verificacao] } = await client.query(`
      SELECT codigo_hmac FROM cadastro_publico_verificacoes
      WHERE email_hmac = $1 AND desafio_hash = $2 AND consumido_em IS NULL
        AND expira_em > clock_timestamp() AND tentativas < 5 FOR UPDATE`, [emailHmac, hash(desafio)]);
    if (!verificacao) return false;
    if (!timingSafeEqual(verificacao.codigo_hmac, hmac(config.chave, 'codigo', dados.email, desafio, codigo))) {
      await client.query('UPDATE cadastro_publico_verificacoes SET tentativas = tentativas + 1 WHERE email_hmac = $1', [emailHmac]);
      return false;
    }

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    // Usa o mesmo bloqueio do aceite de convite para respeitar os e-mails legados.
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const conta = await client.query('SELECT 1 FROM usuarios WHERE lower(email_ou_matricula) = $1 LIMIT 1', [dados.email]);
    const legado = await client.query(`
      SELECT 1 FROM academias WHERE documento_cadastro IS NULL AND cnpj IS NOT NULL
        AND regexp_replace(upper(cnpj), '[./ -]', '', 'g') = $1 LIMIT 1`, [dados.documento]);
    if (conta.rowCount || legado.rowCount) throw erro(409, 'Não foi possível concluir o cadastro. Entre em contato com o suporte.');

    const preco = await comercial.disponivel(client) ? await comercial.precoAtual(client) : null;
    if (preco && dados.mensalidade !== preco.valor_centavos) {
      throw erro(409, 'O preço do plano mudou. Atualize a página e confira a nova oferta.');
    }
    const mensalidade = preco?.valor_centavos ?? config.mensalidade;
    const { rows: [academia] } = await client.query(`
      INSERT INTO academias (nome, nome_fantasia, tipo_cadastro, documento_cadastro, unidade_cadastro,
        razao_social, telefone, endereco, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf,
        ativo, email, email_responsavel_verificado_em, termos_aceitos_url, privacidade_aceita_url,
        teste_gratuito_iniciado_em, teste_gratuito_termina_em, mensalidade_centavos)
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,$15,now(),$16,$17,now(),now()+interval '720 hours',$18)
      RETURNING id,(teste_gratuito_iniciado_em AT TIME ZONE 'America/Fortaleza')::date::text AS inicio_teste`,
    [dados.fantasia, dados.tipo, dados.documento, dados.unidade, dados.razao, dados.comercial,
      `${dados.logradouro}, ${dados.numero} - ${dados.bairro}, ${dados.cidade}/${dados.uf}`,
      dados.cep, dados.logradouro, dados.numero, dados.complemento || null, dados.bairro, dados.cidade,
      dados.uf, dados.email, config.termos, config.privacidade, mensalidade]);
    if (preco) await comercial.iniciarAssinatura(client, academia.id, preco, academia.inicio_teste);
    const { rows:[usuario] } = await client.query(`
      INSERT INTO usuarios (nome,email_ou_matricula,senha_hash,telefone,cargo,academia_id)
      VALUES ($1,$2,$3,$4,'admin',$5) RETURNING id`, [dados.responsavel, dados.email, senhaHash, dados.whatsapp, academia.id]);
    if (config.autogestao && preco) await client.query(`
      INSERT INTO wcfit_autogestao(academia_id,consentido_em,consentido_por,preco_centavos)
      VALUES($1,clock_timestamp(),$2,$3)`, [academia.id,usuario.id,mensalidade]);
    const consumo = await client.query(`
      UPDATE cadastro_publico_verificacoes SET consumido_em = clock_timestamp()
      WHERE email_hmac = $1 AND expira_em > clock_timestamp()`, [emailHmac]);
    if (!consumo.rowCount) throw invalido();
    return true;
  });
  if (!resultado) throw invalido();
}

module.exports = { configuracao, emailValido, validarCadastro, validarDadosAcademia, validarPerfilAcademia, solicitarCodigo, concluirCadastro, tipos, ufs };
