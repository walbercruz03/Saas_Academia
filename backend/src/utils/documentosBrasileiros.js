const cpfFormato = /^(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$/;
const cnpjFormato = /^(?:[A-Z0-9]{12}[0-9]{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-[0-9]{2})$/i;

function normalizarDocumento(valor, tipo) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  const pessoaFisica = tipo === 'pessoa_fisica';
  const formato = pessoaFisica ? cpfFormato : cnpjFormato;
  if (!formato.test(texto)) return null;

  const documento = texto.toUpperCase().replace(/[./-]/g, '');
  if (/^(.)\1+$/.test(documento)) return null;
  const base = documento.slice(0, -2);
  const digito = (parte) => {
    const soma = [...parte].reverse().reduce((total, caractere, indice) => {
      const peso = pessoaFisica ? 2 + indice : 2 + (indice % 8);
      return total + (caractere.charCodeAt(0) - 48) * peso;
    }, 0);
    const resto = soma % 11;
    return resto < 2 ? '0' : String(11 - resto);
  };

  const primeiro = digito(base);
  return documento.endsWith(primeiro + digito(base + primeiro)) ? documento : null;
}

module.exports = { normalizarDocumento };
