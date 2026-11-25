const { createHash, createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } = require('node:crypto');
const { consulta, transacao } = require('../models/SuperAdmin');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');
const descritor = require('./descritorFacial');

const erro = (status,mensagem) => Object.assign(new Error(mensagem),{status});
const aviso = 'checkin-facial-consentimento-v1';
const confirmacaoFacial = Symbol('checkin-facial-confirmado');
const tokenValido = (valor) => typeof valor === 'string' && /^[\w-]{43}$/.test(valor);
const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const desafios = new Map();
const capturas = new Map();
const limiteGaleria = 500;
const prazo = 20_000;

function chave() {
  const valor = process.env.CHECKIN_FACIAL_CHAVE;
  if (!/^[a-f0-9]{64}$/i.test(valor || '') || new Set(valor.toLowerCase()).size < 12) {
    throw erro(503,'O processamento facial está indisponível.');
  }
  return Buffer.from(valor,'hex');
}

function material(academia) {
  return createHmac('sha256',chave()).update('wcfit-checkin-facial-v1:'+academia).digest();
}

function ciclar(mapa) {
  const agora = Date.now();
  for (const [id,item] of mapa) {
    if (item.expira <= agora) mapa.delete(id);
  }
}

const limpeza = setInterval(() => {
  ciclar(desafios);
  ciclar(capturas);
}, 5_000);
limpeza.unref();

function limparDesafios(academia,aluno) {
  for (const [id,item] of desafios) {
    if (item.academia === academia && (aluno == null || item.aluno === aluno)) desafios.delete(id);
  }
}

async function situacao(academia) {
  const { rows:[linha] } = await consulta(`
    SELECT coalesce((to_jsonb(a)->>'checkin_facial_ativo')::boolean,false) AS ativo,
      to_regclass('public.aluno_biometrias_faciais') IS NOT NULL AS instalado
    FROM academias a WHERE a.id=$1 AND a.ativo=1
  `,[academia]);
  if (!linha) throw erro(404,'Academia não encontrada.');
  if (linha.instalado) await consulta('DELETE FROM aluno_biometrias_faciais WHERE academia_id=$1 AND expira_em<=now()',[academia]);
  let pronto = false;
  try { chave(); pronto = linha.instalado; } catch { /* Configuração opcional. */ }
  return { ...linha,pronto,modo:'assistido' };
}

async function configurar(academia,ativo) {
  const atual = await situacao(academia);
  if (!atual.instalado || (ativo && !atual.pronto)) throw erro(503,'O processamento facial está indisponível.');
  await transacao(async (client) => {
    await client.query('UPDATE academias SET checkin_facial_ativo=$2 WHERE id=$1 AND ativo=1',[academia,ativo]);
    if (!ativo) await client.query('DELETE FROM aluno_biometrias_faciais WHERE academia_id=$1',[academia]);
  });
  if (!ativo) limparDesafios(academia);
  return situacao(academia);
}

function contexto(req) {
  return { academia:req.usuario.academia_id,usuario:req.usuario.id,sessao:hash(req.get('Authorization') || '') };
}

function quadro(valor,academia) {
  if (typeof valor !== 'string' || valor.length !== 5464 || !/^[A-Za-z0-9+/]+={0,2}$/.test(valor)) {
    throw erro(400,'Formato de captura inválido.');
  }
  const buffer = Buffer.from(valor,'base64');
  if (buffer.length !== descritor.bytes) throw erro(400,'Formato de captura inválido.');
  const impressao = createHmac('sha256',material(academia)).update(buffer).digest('hex');
  ciclar(capturas);
  try {
    if (capturas.has(impressao)) throw erro(409,'Esta captura já foi usada. Faça uma nova captura.');
    if (capturas.size >= 1024) throw erro(429,'Aguarde e tente novamente.');
    const resultado = descritor.analisar(buffer);
    if (!resultado) throw erro(422,'Ajuste a iluminação e centralize o rosto.');
    capturas.set(impressao,{expira:Date.now()+120000});
    return resultado;
  } finally {
    buffer.fill(0);
  }
}

async function ativo(academia) {
  const atual = await situacao(academia);
  if (!atual.ativo || !atual.pronto) throw erro(503,'Check-in facial indisponível. Use o check-in manual.');
}

async function alunoExiste(academia,aluno) {
  const { rowCount } = await consulta(`
    SELECT 1 FROM alunos WHERE academia_id=$1 AND id=$2 AND status IN ('ativo','inadimplente')
  `,[academia,aluno]);
  if (!rowCount) throw erro(404,'Aluno não encontrado ou inativo.');
}

async function iniciar(ctx,dados) {
  await ativo(ctx.academia);
  const cadastro = dados.aluno_id !== undefined;
  if (cadastro) {
    if (!Number.isSafeInteger(dados.aluno_id) || dados.aluno_id < 1 || dados.aluno_id > 2147483647 || dados.aviso !== aviso || dados.consentimento !== true) {
      throw erro(400,'Confira o aluno e o consentimento específico.');
    }
    await alunoExiste(ctx.academia,dados.aluno_id);
  }
  ciclar(desafios);
  for (const [id,item] of desafios) {
    if (item.academia === ctx.academia && item.sessao === ctx.sessao) desafios.delete(id);
  }
  if (desafios.size >= 64) throw erro(429,'Aguarde e tente novamente.');
  const amostra = quadro(dados.quadro,ctx.academia);
  if (amostra.centro < 19 || amostra.centro > 45) throw erro(422,'Centralize o rosto antes de começar.');
  const direcao = randomInt(2) ? 'direita' : 'esquerda';
  const token = randomBytes(32).toString('base64url');
  desafios.set(hash(token),{ ...ctx,amostra,direcao, aluno:cadastro ? dados.aluno_id : undefined,
    primeiro:Date.now(), expira:Date.now()+prazo, etapa:'movimento' });
  return { token,direcao };
}

function consumir(ctx,token,etapa) {
  ciclar(desafios);
  const id = tokenValido(token) ? hash(token) : '';
  const item = desafios.get(id);
  if (!item || item.academia !== ctx.academia || item.usuario !== ctx.usuario || item.sessao !== ctx.sessao || item.etapa !== etapa) {
    throw erro(409,'A verificação expirou ou já foi usada. Inicie outra tentativa.');
  }
  desafios.delete(id);
  return item;
}

function aad(academia,aluno) {
  return Buffer.from(`wcfit:${academia}:${aluno}:${descritor.versao}:v1`);
}

async function cadastrar(academia,aluno,vetor) {
  const nonce = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm',material(academia),nonce);
  cifra.setAAD(aad(academia,aluno));
  const cifrado = Buffer.concat([cifra.update(Buffer.from(vetor.buffer)),cifra.final()]);
  await transacao(async (client) => {
    const { rows:[status] } = await client.query('SELECT checkin_facial_ativo FROM academias WHERE id=$1 FOR SHARE',[academia]);
    if (!status?.checkin_facial_ativo) throw erro(503,'Check-in facial indisponível.');
    const { rowCount } = await client.query(`
      INSERT INTO aluno_biometrias_faciais(academia_id,aluno_id,descritor_versao,chave_versao,nonce,etiqueta,cifrado,aviso_versao,expira_em)
      SELECT academia_id,id,$3,'v1',$4,$5,$6,$7,clock_timestamp()+interval '90 days'
        FROM alunos WHERE academia_id=$1 AND id=$2 AND status IN ('ativo','inadimplente')
      ON CONFLICT (academia_id,aluno_id) DO UPDATE SET descritor_versao=EXCLUDED.descritor_versao,
        chave_versao=EXCLUDED.chave_versao,nonce=EXCLUDED.nonce,etiqueta=EXCLUDED.etiqueta,cifrado=EXCLUDED.cifrado,
        aviso_versao=EXCLUDED.aviso_versao,consentido_em=clock_timestamp(),expira_em=EXCLUDED.expira_em
    `,[academia,aluno,descritor.versao,nonce,cifra.getAuthTag(),cifrado,aviso]);
    if (!rowCount) throw erro(404,'Aluno não encontrado ou inativo.');
  });
}

function abrir(chaveAcademia,registro,academia) {
  const decipher = createDecipheriv('aes-256-gcm',chaveAcademia,registro.nonce);
  decipher.setAAD(aad(academia,registro.aluno_id));
  decipher.setAuthTag(registro.etiqueta);
  const dados = Buffer.concat([decipher.update(registro.cifrado),decipher.final()]);
  return dados;
}

async function reconhecer(academia,vetor) {
  const { rows } = await consulta(`
    SELECT b.aluno_id,b.nonce,b.etiqueta,b.cifrado
    FROM aluno_biometrias_faciais b JOIN alunos a ON a.id=b.aluno_id AND a.academia_id=b.academia_id
    WHERE b.academia_id=$1 AND b.expira_em>now() AND b.descritor_versao=$2 AND b.chave_versao='v1'
      AND a.status IN ('ativo','inadimplente') ORDER BY b.aluno_id LIMIT $3
  `,[academia,descritor.versao,limiteGaleria+1]);
  if (rows.length > limiteGaleria) return null;
  const materialAcademia = material(academia);
  let melhor = { valor:-1 };
  let segundo = -1;
  for (const linha of rows) {
    const dados = abrir(materialAcademia,linha,academia);
    try {
      const copia = new Float32Array(dados.buffer,dados.byteOffset,dados.length/4);
      const valor = descritor.similaridade(vetor,copia);
      if (valor > melhor.valor) {
        segundo = melhor.valor;
        melhor = { valor,aluno:linha.aluno_id };
      } else segundo = Math.max(segundo,valor);
    } finally {
      dados.fill(0);
    }
  }
  return melhor.valor >= 0.97 && melhor.valor-segundo >= 0.025 ? melhor.aluno : null;
}

async function verificar(ctx,dados) {
  await ativo(ctx.academia);
  const desafio = consumir(ctx,dados.token,'movimento');
  if (Date.now()-desafio.primeiro < 350) throw erro(422,'Faça o movimento enquanto a câmera estiver aberta.');
  const atual = quadro(dados.quadro,ctx.academia);
  if (!descritor.movimento(desafio.amostra,atual,desafio.direcao)) {
    throw erro(422,'Movimento inconclusivo. Repita a tentativa ou use o check-in manual.');
  }
  if (desafio.aluno !== undefined) {
    await cadastrar(ctx.academia,desafio.aluno,desafio.amostra.vetor);
    return { cadastrado:true };
  }
  const aluno = await reconhecer(ctx.academia,desafio.amostra.vetor);
  if (!aluno) return { resultado:'manual' };
  const token = randomBytes(32).toString('base64url');
  desafios.set(hash(token),{ ...ctx,aluno,expira:Date.now()+prazo,etapa:'confirmacao' });
  return { resultado:'confirmacao',token };
}

async function confirmar(ctx,dados) {
  await ativo(ctx.academia);
  const desafio = consumir(ctx,dados.token,'confirmacao');
  const cpf = normalizarDocumento(dados.cpf,'pessoa_fisica');
  const { rowCount } = await consulta(`
    SELECT 1 FROM alunos a JOIN aluno_biometrias_faciais b ON b.academia_id=a.academia_id AND b.aluno_id=a.id
    WHERE a.academia_id=$1 AND a.id=$2 AND b.expira_em>now() AND regexp_replace(a.cpf,'[^0-9]','','g')=$3
  `,[ctx.academia,desafio.aluno,cpf]);
  if (!rowCount) throw erro(422,'Confirmação inconclusiva. Use o check-in manual.');
  return desafio.aluno;
}

async function excluir(academia,aluno) {
  if (!(await situacao(academia)).instalado) throw erro(503,'Cadastro facial indisponível.');
  await consulta('DELETE FROM aluno_biometrias_faciais WHERE academia_id=$1 AND aluno_id=$2',[academia,aluno]);
  limparDesafios(academia,aluno);
}

async function cadastro(academia,aluno) {
  const status = await situacao(academia);
  const { rows:[linha] } = status.instalado ? await consulta(`
    SELECT expira_em FROM aluno_biometrias_faciais WHERE academia_id=$1 AND aluno_id=$2
  `,[academia,aluno]) : { rows:[] };
  return { ...status,cadastrado:Boolean(linha), expira_em:linha?.expira_em, aviso };
}

module.exports = { situacao,configurar,contexto,iniciar,verificar,confirmar,excluir,cadastro,confirmacaoFacial };
