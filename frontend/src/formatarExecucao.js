export function duracaoTreino(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor(segundos % 3600 / 60);
  const resto = segundos % 60;
  return horas ? `${horas}h ${minutos}min` : minutos ? `${minutos}min ${resto}s` : `${resto}s`;
}

export function dataTreino(data) {
  return new Intl.DateTimeFormat('pt-BR',{
    dateStyle:'medium', timeStyle:'short', timeZone:'America/Fortaleza',
  }).format(new Date(data));
}
