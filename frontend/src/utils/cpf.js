export function formatarCpf(valor) {
  return valor.replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function validarCpf(valor) {
  const cpf = valor.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  function digito(tamanho) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, numero, indice) =>
      total + Number(numero) * (tamanho + 1 - indice), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
