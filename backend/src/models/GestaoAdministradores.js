const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const sessoes = require('./SessaoUsuario');
const { consulta, transacao, auditar, autorizarOperacaoRecente } = require('./SuperAdmin');
const erro = (status,mensagem) => Object.assign(new Error(mensagem),{status});

async function exigirSchema() {
  if (!await sessoes.disponivel()) throw erro(503,'O gerenciamento requer a migration 014.');
}

async function detalhes(id,pagina) {
  await exigirSchema();
  const { rows:[conta] } = await consulta(`
    SELECT id,nome,email_ou_matricula,telefone,status,academia_id,(excluido_em IS NOT NULL) AS excluido
    FROM usuarios WHERE id=$1 AND cargo='admin'`,[id]);
  if (!conta) throw erro(404,'Administrador não encontrado.');
  const offset = (pagina-1)*50;
  const [vinculos,historico] = await Promise.all([
    consulta(`SELECT id,criada_em,expira_em,revogada_em,(revogada_em IS NULL AND expira_em>clock_timestamp()) AS ativa
      FROM usuario_sessoes WHERE usuario_id=$1 ORDER BY id DESC LIMIT 51 OFFSET $2`,[id,offset]),
    consulta(`SELECT id,split_part(evento,':',1) AS acao,criado_em FROM super_admin_auditoria
      WHERE evento LIKE 'administrador_%' AND split_part(evento,':',2)=$1 ORDER BY id DESC LIMIT 51 OFFSET $2`,
    [String(id),offset]),
  ]);
  return { conta,pagina,sessoes:vinculos.rows.slice(0,50),historico:historico.rows.slice(0,50),
    temMais:vinculos.rowCount>50||historico.rowCount>50 };
}

function registrar(client,acao,conta,proprietario) {
  return auditar(`administrador_${acao}:${conta.id}:${conta.academia_id ?? 0}`,proprietario,client);
}

async function comConta({ tokenHash,semTotpLocal },id,executar,permitirExcluido = false) {
  await exigirSchema();
  return transacao(async client=>{
    const {sessao,status}=await autorizarOperacaoRecente(client,tokenHash,semTotpLocal);
    if (!sessao) throw erro(status,status===428 ? 'Confirme um novo código do autenticador para continuar.' : 'Sessão administrativa inválida ou expirada.');
    await client.query('LOCK TABLE usuarios IN ROW EXCLUSIVE MODE');
    const { rows:[vinculo] }=await client.query("SELECT academia_id FROM usuarios WHERE id=$1 AND cargo='admin'",[id]);
    if (!vinculo) throw erro(404,'Administrador não encontrado.');
    const { rows:[academia] }=await client.query('SELECT ativo FROM academias WHERE id=$1 FOR UPDATE',[vinculo.academia_id]);
    const { rows:[conta] }=await client.query(`
      SELECT id,academia_id,nome,telefone,email_ou_matricula,status,excluido_em FROM usuarios WHERE id=$1 AND cargo='admin'
      AND academia_id IS NOT DISTINCT FROM $2::integer FOR UPDATE`,[id,vinculo.academia_id]);
    if (!conta || (conta.excluido_em && !permitirExcluido)) throw erro(409,'Administrador excluído ou vínculo indisponível.');
    return executar(client,conta,academia,sessao.proprietario_id);
  });
}

async function revogarTodas(client,id) {
  await client.query('UPDATE usuario_sessoes SET revogada_em=clock_timestamp() WHERE usuario_id=$1 AND revogada_em IS NULL',[id]);
}

async function operar(token,id,acao,dados) {
  return comConta(token,id,async(client,conta,academia,autor)=>{
    if (acao==='editar') {
      if (conta.nome===dados.nome && conta.telefone===dados.telefone) return;
      await client.query('UPDATE usuarios SET nome=$2,telefone=$3 WHERE id=$1',[id,dados.nome,dados.telefone]);
    } else if (acao==='revogar') {
      const {rowCount}=await client.query(`
        UPDATE usuario_sessoes SET revogada_em=clock_timestamp()
        WHERE usuario_id=$1 AND id=$2 AND revogada_em IS NULL AND expira_em>clock_timestamp()`,[id,dados.sessao]);
      if (!rowCount) throw erro(404,'Sessão ativa não encontrada para este administrador.');
    } else if (acao==='reativar') {
      if (conta.status==='ativo') return;
      await client.query("UPDATE usuarios SET status='ativo' WHERE id=$1",[id]);
    } else {
      if (conta.status==='ativo' && academia?.ativo===1) {
        const {rowCount}=await client.query(`
          SELECT 1 FROM usuarios WHERE academia_id=$1 AND id<>$2 AND cargo='admin'
          AND status='ativo' AND excluido_em IS NULL LIMIT 1`,[conta.academia_id,id]);
        if (!rowCount) throw erro(409,'Mantenha pelo menos um administrador ativo nesta academia.');
      }
      if (acao==='desativar' && conta.status==='inativo') return;
      await client.query(`UPDATE usuarios SET status='inativo'
        ${acao==='excluir'?', excluido_em=clock_timestamp()':''} WHERE id=$1`,[id]);
      await revogarTodas(client,id);
      await client.query('UPDATE usuario_verificacoes SET encerrada_em=clock_timestamp() WHERE usuario_id=$1 AND encerrada_em IS NULL',[id]);
    }
    await registrar(client,acao,conta,autor);
  });
}

async function excluirDefinitivamente(token, id) {
  return comConta(token, id, async (client, conta, _academia, autor) => {
    if (!conta.excluido_em || conta.status !== 'inativo') {
      throw erro(409, 'Exclua logicamente a conta antes da exclusão definitiva.');
    }
    const bloqueio = (motivo) => erro(409,
      `Exclusão definitiva indisponível: ${motivo}. A conta permanece oculta da listagem principal.`);
    // A coluna legada de autoria do treino não possui chave estrangeira.
    await client.query('LOCK TABLE modelos_treino IN SHARE MODE');
    const treino = await client.query('SELECT 1 FROM modelos_treino WHERE professor_id = $1 LIMIT 1', [id]);
    if (treino.rowCount) throw bloqueio('há modelos de treino vinculados');

    // Verifica inclusive FKs que permitiriam apagar ou desvincular registros em cascata.
    const { rows: referencias } = await client.query(`
      SELECT format('SELECT 1 FROM %I.%I f JOIN public.usuarios u ON %s WHERE u.id = $1 LIMIT 1',
        n.nspname, t.relname, string_agg(format('f.%I = u.%I', f.attname, u.attname), ' AND ')) AS sql
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS k(origem, destino)
      JOIN pg_attribute f ON f.attrelid = c.conrelid AND f.attnum = k.origem
      JOIN pg_attribute u ON u.attrelid = c.confrelid AND u.attnum = k.destino
      WHERE c.contype = 'f' AND c.confrelid = 'public.usuarios'::regclass
      GROUP BY c.oid, n.nspname, t.relname
    `);
    for (const { sql } of referencias) {
      if ((await client.query(sql, [id])).rowCount) {
        throw bloqueio('há sessões, convites ou outros registros vinculados');
      }
    }
    await client.query('DELETE FROM usuarios WHERE id = $1', [id]);
    await registrar(client, 'excluir_definitivamente', conta, autor);
  }, true);
}

async function solicitarVerificacao(token,id,tipo,email) {
  return comConta(token,id,async(client,conta,_academia,autor)=>{
    if (conta.status!=='ativo') throw erro(409,'Reative o administrador antes de solicitar a verificação.');
    const destino=tipo==='email'?email:conta.email_ou_matricula;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) throw erro(400,'A conta precisa de um e-mail válido.');
    if (tipo==='email') {
      const existe=await client.query('SELECT 1 FROM usuarios WHERE lower(email_ou_matricula)=$1 LIMIT 1',[destino]);
      if (existe.rowCount) throw erro(409,'O e-mail já está em uso.');
    }
    const recent=await client.query(`
      SELECT 1 FROM usuario_verificacoes WHERE usuario_id=$1 AND tipo=$2
        AND criada_em>clock_timestamp()-interval '1 minute' LIMIT 1`,[id,tipo]);
    if (recent.rowCount) throw erro(409,'Aguarde um minuto antes de solicitar outro e-mail.');
    await client.query('UPDATE usuario_verificacoes SET encerrada_em=clock_timestamp() WHERE usuario_id=$1 AND tipo=$2 AND encerrada_em IS NULL',[id,tipo]);
    const codigo=randomBytes(32).toString('base64url');
    await client.query(`INSERT INTO usuario_verificacoes(usuario_id,tipo,email_destino,token_hash,expira_em)
      VALUES($1,$2,$3,$4,clock_timestamp()+interval '30 minutes')`,[id,tipo,destino,sessoes.resumir(codigo)]);
    await registrar(client,tipo+'_solicitado',conta,autor);
    return { codigo,destino };
  });
}

async function cancelarVerificacao(codigo) {
  await consulta('UPDATE usuario_verificacoes SET encerrada_em=clock_timestamp() WHERE token_hash=$1 AND encerrada_em IS NULL',[sessoes.resumir(codigo)]);
}

async function confirmar(codigo,tipo,senha) {
  await exigirSchema();
  return transacao(async client=>{
    if (tipo==='email') await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    else await client.query('LOCK TABLE usuarios IN ROW EXCLUSIVE MODE');
    // Mantém a ordem conta -> token de desativação, reenvio e exclusão.
    const { rows:[referencia] }=await client.query('SELECT usuario_id FROM usuario_verificacoes WHERE tipo=$1 AND token_hash=$2',
      [tipo,sessoes.resumir(codigo)]);
    if (!referencia) return false;
    const { rows:[conta] }=await client.query("SELECT id,academia_id,email_ou_matricula FROM usuarios WHERE id=$1 AND cargo='admin' AND status='ativo' AND excluido_em IS NULL FOR UPDATE",[referencia.usuario_id]);
    if (!conta) return false;
    const { rows:[pedido] }=await client.query(`UPDATE usuario_verificacoes SET encerrada_em=clock_timestamp()
      WHERE tipo=$1 AND usuario_id=$2 AND token_hash=$3 AND encerrada_em IS NULL AND expira_em>clock_timestamp()
      RETURNING email_destino`,[tipo,conta.id,sessoes.resumir(codigo)]);
    if (!pedido) return false;
    if (tipo==='email') {
      const existe=await client.query('SELECT 1 FROM usuarios WHERE lower(email_ou_matricula)=$1 LIMIT 1',[pedido.email_destino]);
      if (existe.rowCount) return false;
      await client.query('UPDATE usuarios SET email_ou_matricula=$2 WHERE id=$1',[conta.id,pedido.email_destino]);
    } else {
      if (conta.email_ou_matricula!==pedido.email_destino) return false;
      await client.query('UPDATE usuarios SET senha_hash=$2 WHERE id=$1',[conta.id,await bcrypt.hash(senha,10)]);
    }
    await revogarTodas(client,conta.id);
    await client.query('UPDATE usuario_verificacoes SET encerrada_em=clock_timestamp() WHERE usuario_id=$1 AND encerrada_em IS NULL',[conta.id]);
    await registrar(client,tipo+'_confirmado',conta,null);
    return true;
  });
}
module.exports = { detalhes,operar,excluirDefinitivamente,solicitarVerificacao,cancelarVerificacao,confirmar };
