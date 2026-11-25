export const moduloPorRota = {
  '/dashboard':'relatorios', '/alunos':'alunos', '/planos':'planos', '/matriculas':'matriculas', '/checkin':'checkin',
  '/treinos':'treinos', '/treinos/modelos':'modelos', '/treinos/exercicios':'exercicios',
  '/treinos/grupos-musculares':'catalogo', '/treinos/configuracoes':'catalogo', '/treinos/acompanhamento':'execucoes',
};

export function podeAcessar(usuario, modulo, acao = 'visualizar') {
  if (usuario?.cargo !== 'professor' || !modulo || usuario.permissoes === null) return true;
  return usuario.permissoes?.[modulo]?.includes(acao) ?? false;
}
