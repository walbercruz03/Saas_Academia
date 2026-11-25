const modelo = require('../models/GestaoAdministradores');
const { origemConvite } = require('./superAdminConviteController');
const enviarEmail = require('../services/emailTransacional');
const { emailValido } = require('../services/cadastroPublico');
const { senhaValida,MENSAGEM_SENHA } = require('../services/politicaSenha');
const idValido = x=>typeof x==='string'&&/^[1-9]\d{0,9}$/.test(x)&&Number(x)<=2147483647;
const erro = (res,status,mensagem)=>res.status(status).json({mensagem});
const somente = (dados,...campos)=>dados&&typeof dados==='object'&&!Array.isArray(dados)&&
  Object.keys(dados).every(campo=>campos.includes(campo));
const frase = (valor,max)=>typeof valor==='string'&&valor.trim()&&valor.trim().length<=max&&
  !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(valor)?valor.trim():null;
const executar = handler=>async(req,res)=>{
  try { return await handler(req,res); } catch (falha) {
    if ([400,401,404,409,428,503].includes(falha.status)) return erro(res,falha.status,falha.message);
    if (falha.code==='23505') return erro(res,409,'A operação conflita com um cadastro existente.');
    return erro(res,503,'Não foi possível concluir a operação.');
  }
};

const detalhes=executar(async(req,res)=>{
  const {pagina='1'}=req.query;
  if (!idValido(req.params.id)||!idValido(pagina)||Number(pagina)>999999) return erro(res,400,'Parâmetros inválidos.');
  return res.json(await modelo.detalhes(Number(req.params.id),Number(pagina)));
});

const operar=acao=>executar(async(req,res)=>{
  const dados=req.body;
  const campos=acao==='editar'?['nome','telefone']:acao==='email'?['email']:acao==='revogar'?['sessao']:[];
  if (!idValido(req.params.id)||!somente(dados,'confirmar',...campos)||dados.confirmar!==true) {
    return erro(res,400,'Confirme a operação e confira os dados.');
  }
  const id=Number(req.params.id), sessao=req.superAdmin;
  if (acao==='email'||acao==='senha') {
    const origem=origemConvite(), apiKey=process.env.GESTAO_EMAIL_API_KEY, remetente=process.env.GESTAO_EMAIL_REMETENTE;
    if (!origem||!apiKey||!remetente) return erro(res,503,'O envio seguro de e-mail ainda não está configurado.');
    const pedido=await modelo.solicitarVerificacao(sessao,id,acao,acao==='email'?emailValido(dados.email):null);
    const link=`${origem}/confirmar-conta?tipo=${acao}#${pedido.codigo}`;
    try {
      await enviarEmail({apiKey,remetente,email:pedido.destino,assunto:'Confirme a operação da sua conta WC Fit',
        texto:`Use o link em até 30 minutos: ${link}. Se não reconhece a solicitação, ignore esta mensagem.`});
    } catch {
      await modelo.cancelarVerificacao(pedido.codigo);
      return erro(res,503,'Não foi possível enviar o e-mail. Tente novamente mais tarde.');
    }
    return res.status(202).end();
  }
  if (acao === 'excluir-definitivamente') {
    await modelo.excluirDefinitivamente(sessao, id);
  } else if (acao==='editar') {
    const nome=frase(dados.nome,160), telefone=dados.telefone===''?null:frase(dados.telefone,32);
    if (!nome||(dados.telefone!==''&&!telefone)) return erro(res,400,'Confira o nome e telefone.');
    await modelo.operar(sessao,id,acao,{nome,telefone});
  } else {
    if (acao==='revogar'&&!idValido(String(dados.sessao))) return erro(res,400,'Sessão inválida.');
    await modelo.operar(sessao,id,acao,{sessao:Number(dados.sessao)});
  }
  return res.status(204).end();
});

const confirmar=executar(async(req,res)=>{
  const {codigo,tipo,senha}=req.body||{};
  if (!somente(req.body,'codigo','tipo','senha')||!['email','senha'].includes(tipo)||
    typeof codigo!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(codigo)) return erro(res,400,'Link inválido ou expirado.');
  if (tipo==='senha'&&!senhaValida(senha)) return erro(res,400,MENSAGEM_SENHA);
  if (!await modelo.confirmar(codigo,tipo,senha)) return erro(res,400,'Link inválido ou expirado.');
  return res.status(204).end();
});
module.exports = { detalhes,operar,confirmar };
