import PropTypes from 'prop-types';
import { duracaoTreino } from '../formatarExecucao';
export default function ResumoExecucao({ sessao, detalhado, somenteSeries = false }) {
  return <>
    {!somenteSeries && <p>{duracaoTreino(sessao.duracao_segundos)} · {sessao.exercicios_concluidos} exercícios completos · {sessao.series_concluidas} de {sessao.series_previstas} séries</p>}
    {detalhado && <ol className="resumo-execucao-lista">
      {sessao.exercicios.map((ex,indice) => {
        const series = Object.values(sessao.series).filter((serie) => serie.exercicio === indice).sort((a,b) => a.serie-b.serie);
        return <li key={indice}>
          <strong>{ex.nome}</strong>
          {series.length ? <ul>{series.map(({ serie,carga,repeticoes }) => (
            <li key={serie}>Série {serie} · {carga} kg × {repeticoes} repetições</li>
          ))}</ul> : <p>Nenhuma série registrada.</p>}
        </li>;
      })}
    </ol>}
  </>;
}

ResumoExecucao.propTypes = {
  sessao: PropTypes.shape({
    duracao_segundos: PropTypes.number.isRequired,
    exercicios_concluidos: PropTypes.number.isRequired,
    series_concluidas: PropTypes.number.isRequired,
    series_previstas: PropTypes.number.isRequired,
    exercicios: PropTypes.arrayOf(PropTypes.shape({ nome: PropTypes.string.isRequired })),
    series: PropTypes.objectOf(PropTypes.shape({
      exercicio: PropTypes.number.isRequired, serie: PropTypes.number.isRequired,
      carga: PropTypes.number.isRequired, repeticoes: PropTypes.number.isRequired,
    })),
  }).isRequired,
  detalhado: PropTypes.bool,
  somenteSeries: PropTypes.bool,
};
