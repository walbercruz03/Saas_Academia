const logotipo = require('./LogotipoAcademia');
const { consulta } = require('./SuperAdmin');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');

async function consultar(academiaId) {
  const logotipoDisponivel = await logotipo.disponivel();
  const { rows: [dados] } = await consulta(`
    SELECT coalesce(nullif(btrim(a.nome_fantasia), ''), a.nome) AS nome,
      coalesce(a.teste_gratuito_termina_em > now(), false) AS mostrar_boas_vindas,
      greatest(0, coalesce(s.fim_teste,
        (a.teste_gratuito_termina_em AT TIME ZONE 'America/Fortaleza')::date) - $2::date) AS dias_gratuitos,
      coalesce(s.fim_teste, (a.teste_gratuito_termina_em AT TIME ZONE 'America/Fortaleza')::date) IS NOT NULL AS tem_teste,
      coalesce(nullif(btrim(a.nome_fantasia), ''), nullif(btrim(a.nome), '')) IS NOT NULL
        AND nullif(btrim(a.telefone), '') IS NOT NULL
        AND (nullif(btrim(a.endereco), '') IS NOT NULL OR (
          nullif(btrim(a.logradouro), '') IS NOT NULL AND nullif(btrim(a.numero_endereco), '') IS NOT NULL
          AND nullif(btrim(a.cidade), '') IS NOT NULL AND nullif(btrim(a.uf), '') IS NOT NULL
          AND nullif(btrim(a.cep), '') IS NOT NULL AND nullif(btrim(a.bairro), '') IS NOT NULL
        )) AS perfil,
      ${logotipoDisponivel ? 'EXISTS (SELECT 1 FROM academia_logotipos l WHERE l.academia_id = a.id)' : 'false'} AS logotipo,
      EXISTS (SELECT 1 FROM planos p WHERE p.academia_id = a.id) AS plano,
      EXISTS (SELECT 1 FROM usuarios u WHERE u.academia_id = a.id AND u.cargo = 'professor') AS professor,
      EXISTS (SELECT 1 FROM alunos al WHERE al.academia_id = a.id) AS aluno,
      EXISTS (SELECT 1 FROM matriculas m JOIN alunos al ON al.id = m.aluno_id AND al.academia_id = a.id
        JOIN planos p ON p.id = m.plano_id AND p.academia_id = a.id WHERE m.academia_id = a.id) AS matricula,
      EXISTS (SELECT 1 FROM treinos t JOIN alunos al ON al.id = t.aluno_id AND al.academia_id = a.id
        WHERE t.academia_id = a.id OR t.academia_id IS NULL) AS treino,
      EXISTS (SELECT 1 FROM usuarios u JOIN professor_permissoes p ON p.usuario_id = u.id AND p.academia_id = a.id
        WHERE u.academia_id = a.id AND u.cargo = 'professor') AS permissoes,
      g.cancelado_em IS NULL AND g.cancelamento_solicitado_em IS NULL AND EXISTS (
        SELECT 1 FROM wcfit_asaas_sandbox_operacoes o
        WHERE o.academia_id = a.id AND o.estado = 'vinculada' AND o.externo_id IS NOT NULL
          AND (o.tipo = 'assinatura' OR (
            o.tipo = 'cliente' AND g.meio = 'PIX' AND g.autorizado_em IS NOT NULL
            AND s.fim_teste > $2::date AND o.namespace = $3
          ))
      ) AS assinatura
    FROM academias a
    LEFT JOIN wcfit_assinaturas s ON s.academia_id = a.id
    LEFT JOIN wcfit_autogestao g ON g.academia_id = a.id
    WHERE a.id = $1
  `, [academiaId, getDataHojeFortaleza(), process.env.ASAAS_SANDBOX_NAMESPACE || null]);
  if (!dados) return null;
  const { nome, mostrar_boas_vindas, dias_gratuitos, tem_teste, ...etapas } = dados;
  return {
    nome, mostrar_boas_vindas,
    dias_gratuitos: tem_teste ? dias_gratuitos : null,
    sandbox: process.env.ASAAS_SANDBOX_ATIVO === 'true',
    logotipo_disponivel: logotipoDisponivel,
    etapas,
  };
}

module.exports = { consultar };
