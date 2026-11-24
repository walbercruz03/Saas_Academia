import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treino.css';
import '../styles/treinamento.css';

const criarItemFicha = (ordem = 1, base = {}) => ({
  exercicio_id: base.exercicio_id ? String(base.exercicio_id) : '',
  nome: base.nome || '',
  ordem,
  series: base.series || '3',
  repeticoes: base.repeticoes || '12',
  carga: base.carga || '',
  descanso: base.descanso || '60s',
  observacao: base.observacao || '',
});

const estadoInicialExercicios = [criarItemFicha(1)];

export default function Treinos() {
  const [treinos, setTreinos] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [bibliotecaExercicios, setBibliotecaExercicios] = useState([]);
  const [modelosTreino, setModelosTreino] = useState([]);

  const [alunoId, setAlunoId] = useState('');
  const [divisao, setDivisao] = useState('Treino A (Superior)');
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('');
  const [buscaExercicio, setBuscaExercicio] = useState('');
  const [exercicios, setExercicios] = useState(estadoInicialExercicios);

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resAlunos, resTreinos, resExercicios, resModelos] = await Promise.all([
        api.get('/alunos').catch(() => ({ data: [] })),
        api.get('/treinos').catch(() => ({ data: [] })),
        api.get('/exercicios', { params: { apenas_ativos: 1 } }).catch(() => ({ data: [] })),
        api.get('/modelos-treino').catch(() => ({ data: [] })),
      ]);

      const listaAlunos = Array.isArray(resAlunos.data)
        ? resAlunos.data
        : resAlunos.data?.alunos || [];
      const listaTreinos = Array.isArray(resTreinos.data)
        ? resTreinos.data
        : resTreinos.data?.treinos || [];
      const listaExercicios = Array.isArray(resExercicios.data)
        ? resExercicios.data
        : resExercicios.data?.exercicios || [];
      const listaModelos = Array.isArray(resModelos.data)
        ? resModelos.data
        : resModelos.data?.modelos || [];

      setAlunos(listaAlunos);
      setTreinos(listaTreinos);
      setBibliotecaExercicios(listaExercicios);
      setModelosTreino(listaModelos);
    } catch (err) {
      console.error(err);
      setErro('Erro ao carregar dados do servidor.');
    }
  };

  const exerciciosFiltradosBiblioteca = useMemo(() => {
    const termo = buscaExercicio.trim().toLowerCase();
    if (!termo) return bibliotecaExercicios;
    return bibliotecaExercicios.filter((ex) => {
      const nome = String(ex.nome || '').toLowerCase();
      const equip = String(ex.equipamento || '').toLowerCase();
      const dif = String(ex.dificuldade || '').toLowerCase();
      return nome.includes(termo) || equip.includes(termo) || dif.includes(termo);
    });
  }, [bibliotecaExercicios, buscaExercicio]);

  const reordenarLista = (lista) =>
    lista.map((item, idx) => ({
      ...item,
      ordem: idx + 1,
    }));

  const adicionarLinhaExercicio = (exercicioCatalogo = null) => {
    setExercicios((prev) =>
      reordenarLista([
        ...prev,
        criarItemFicha(prev.length + 1, {
          exercicio_id: exercicioCatalogo ? exercicioCatalogo.id : '',
          nome: exercicioCatalogo ? exercicioCatalogo.nome : '',
        }),
      ])
    );
  };

  const selecionarExercicioDaBiblioteca = (index, novoExercicioId) => {
    const encontrado = bibliotecaExercicios.find(
      (item) => String(item.id) === String(novoExercicioId)
    );

    setExercicios((prev) => {
      const proximos = [...prev];
      const atual = proximos[index] || criarItemFicha(index + 1);
      proximos[index] = {
        ...atual,
        exercicio_id: novoExercicioId,
        nome: encontrado ? encontrado.nome : atual.nome,
      };
      return reordenarLista(proximos);
    });
  };

  const atualizarExercicio = (index, campo, valor) => {
    setExercicios((prev) => {
      const proximos = [...prev];
      proximos[index] = { ...proximos[index], [campo]: valor };
      return proximos;
    });
  };

  const moverExercicio = (index, direcao) => {
    const destino = index + direcao;
    setExercicios((prev) => {
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [removido] = copia.splice(index, 1);
      copia.splice(destino, 0, removido);
      return reordenarLista(copia);
    });
  };

  const removerLinhaExercicio = (index) => {
    setExercicios((prev) => {
      if (prev.length <= 1) return prev;
      return reordenarLista(prev.filter((_, i) => i !== index));
    });
  };

  const aplicarModeloTreino = (modeloId) => {
    setModeloSelecionadoId(modeloId);
    if (!modeloId) return;

    const modelo = modelosTreino.find((m) => String(m.id) === String(modeloId));
    if (!modelo) return;

    if (modelo.divisao) {
      setDivisao(modelo.divisao);
    }

    const itensModelo = Array.isArray(modelo.exercicios) ? modelo.exercicios : [];
    if (itensModelo.length > 0) {
      setExercicios(
        reordenarLista(
          itensModelo.map((ex, idx) =>
            criarItemFicha(idx + 1, {
              exercicio_id: ex.exercicio_id,
              nome: ex.nome,
              series: ex.series,
              repeticoes: ex.repeticoes,
              carga: ex.carga,
              descanso: ex.descanso,
              observacao: ex.observacao,
            })
          )
        )
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!alunoId) {
      setErro('Selecione um aluno para vincular o treino.');
      return;
    }

    const exerciciosNormalizados = reordenarLista(exercicios)
      .filter((item) => String(item.nome || '').trim() !== '')
      .map((item) => ({
        exercicio_id: item.exercicio_id ? Number(item.exercicio_id) : null,
        nome: String(item.nome).trim(),
        ordem: item.ordem,
        series: String(item.series || '').trim(),
        repeticoes: String(item.repeticoes || '').trim(),
        carga: String(item.carga || '').trim(),
        descanso: String(item.descanso || '').trim(),
        observacao: String(item.observacao || '').trim(),
      }));

    if (exerciciosNormalizados.length === 0) {
      setErro('Adicione ao menos um exercício na ficha de treino.');
      return;
    }

    setCarregando(true);
    try {
      await api.post('/treinos', {
        aluno_id: alunoId,
        divisao,
        exercicios: exerciciosNormalizados,
      });

      setSucesso('Ficha de treino cadastrada com sucesso!');
      setAlunoId('');
      setDivisao('Treino A (Superior)');
      setModeloSelecionadoId('');
      setExercicios([criarItemFicha(1)]);
      carregarDados();
    } catch {
      setErro('Erro ao salvar ficha de treino no servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const excluirTreino = async (id) => {
    if (!confirm('Deseja realmente excluir esta ficha de treino?')) return;
    try {
      await api.delete(`/treinos/${id}`);
      setSucesso('Treino excluído com sucesso.');
      carregarDados();
    } catch {
      setErro('Erro ao excluir treino.');
    }
  };

  const buscarAlunoPorTreino = (treino) => {
    const alvo = treino.aluno_id ?? treino.alunoId;
    return alunos.find((a) => String(a.id) === String(alvo));
  };

  const normalizarListaExerciciosTreino = (rawExercicios) => {
    if (Array.isArray(rawExercicios)) return rawExercicios;
    if (typeof rawExercicios === 'string') {
      try {
        const parsed = JSON.parse(rawExercicios);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const gerarLinkWhatsApp = (treino) => {
    const alunoObj = buscarAlunoPorTreino(treino);
    const nomeAluno = alunoObj ? alunoObj.nome || alunoObj.name : 'Aluno';
    const telefone = alunoObj ? (alunoObj.telefone || '').replace(/\D/g, '') : '';
    const listaEx = normalizarListaExerciciosTreino(treino.exercicios);

    let mensagem = `💪 *Wc Fit - Prescrição de Treino*\n`;
    mensagem += `Olá, *${nomeAluno}*! Segue a sua nova ficha de treino:\n\n`;
    mensagem += `📌 *Divisão:* ${treino.divisao}\n\n`;

    listaEx.forEach((ex, idx) => {
      mensagem += `*${idx + 1}. ${ex.nome}*\n`;
      if (ex.series || ex.repeticoes) {
        mensagem += `   • Séries: ${ex.series || '-'} | Repetições: ${ex.repeticoes || '-'}\n`;
      }
      if (ex.carga) mensagem += `   • Carga: ${ex.carga}\n`;
      if (ex.descanso) mensagem += `   • Descanso: ${ex.descanso}\n`;
      if (ex.observacao) mensagem += `   • Obs: ${ex.observacao}\n`;
      mensagem += `\n`;
    });

    mensagem += `Bora focar nos resultados! 🚀`;

    return `https://api.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(mensagem)}`;
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Treinos dos Alunos</h2>
          <p>Prescrição, montagem com biblioteca de exercícios e envio de fichas para alunos</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      <div className="form-card">
        <h3>Nova Ficha de Treino</h3>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="campo">
            <label>Selecione o Aluno</label>
            <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} required>
              <option value="">-- Escolha um aluno --</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome || a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>Divisão / Nome do Treino</label>
            <input
              type="text"
              value={divisao}
              onChange={(e) => setDivisao(e.target.value)}
              placeholder="Ex: Treino A - Membros Superiores"
              required
            />
          </div>

          {modelosTreino.length > 0 && (
            <div className="campo campo-full">
              <label>Carregar a partir de Modelo de Treino (opcional)</label>
              <select
                value={modeloSelecionadoId}
                onChange={(e) => aplicarModeloTreino(e.target.value)}
              >
                <option value="">-- Começar ficha manual ou escolher modelo --</option>
                {modelosTreino.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.divisao || 'Treino A'} • {(m.exercicios || []).length} exercícios)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="campo-full treinamento-biblioteca-box">
            <div className="treinamento-biblioteca-topo">
              <strong>Biblioteca de Exercícios ({bibliotecaExercicios.length})</strong>
              <input
                type="text"
                value={buscaExercicio}
                onChange={(e) => setBuscaExercicio(e.target.value)}
                placeholder="Filtrar biblioteca por nome, equipamento ou nível..."
                className="treinamento-biblioteca-busca"
              />
            </div>

            {exerciciosFiltradosBiblioteca.length === 0 ? (
              <p>
                Nenhum exercício na biblioteca para o filtro atual. Você também pode selecionar no campo de cada linha ou digitar manualmente.
              </p>
            ) : (
              <div className="treinamento-chips-wrap">
                {exerciciosFiltradosBiblioteca.slice(0, 12).map((itemBib) => (
                  <button
                    key={itemBib.id}
                    type="button"
                    onClick={() => adicionarLinhaExercicio(itemBib)}
                    className="treinamento-chip treinamento-chip--ativo-azul"
                  >
                    + {itemBib.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="exercicios-container">
            <h4>Exercícios da Ficha (Ordenação, Séries, Repetições, Carga, Descanso e Observações)</h4>

            {exercicios.map((ex, index) => (
              <div key={index} className="treinamento-item-box">
                <div className="treinamento-item-topo">
                  <strong>Exercício #{index + 1}</strong>

                  <div className="treinamento-acoes-linha">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moverExercicio(index, -1)}
                      title="Mover para cima"
                      className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === exercicios.length - 1}
                      onClick={() => moverExercicio(index, 1)}
                      title="Mover para baixo"
                      className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                    >
                      ↓
                    </button>
                    {exercicios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerLinhaExercicio(index)}
                        className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>

                <div className="exercicio-row">
                  <select
                    value={ex.exercicio_id}
                    onChange={(e) => selecionarExercicioDaBiblioteca(index, e.target.value)}
                    aria-label="Selecionar exercício da biblioteca"
                  >
                    <option value="">-- Biblioteca de exercícios --</option>
                    {bibliotecaExercicios.map((itemBib) => (
                      <option key={itemBib.id} value={itemBib.id}>
                        {itemBib.nome} {itemBib.equipamento ? `(${itemBib.equipamento})` : ''}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Nome do Exercício"
                    value={ex.nome}
                    onChange={(e) => atualizarExercicio(index, 'nome', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Séries"
                    value={ex.series}
                    onChange={(e) => atualizarExercicio(index, 'series', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Repetições"
                    value={ex.repeticoes}
                    onChange={(e) => atualizarExercicio(index, 'repeticoes', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Carga"
                    value={ex.carga}
                    onChange={(e) => atualizarExercicio(index, 'carga', e.target.value)}
                  />
                </div>

                <div className="treinamento-item-campos">
                  <input
                    type="text"
                    placeholder="Descanso (ex: 60s, 1min30)"
                    value={ex.descanso}
                    onChange={(e) => atualizarExercicio(index, 'descanso', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Observações (cadência, execução, ajuste...)"
                    value={ex.observacao}
                    onChange={(e) => atualizarExercicio(index, 'observacao', e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => adicionarLinhaExercicio(null)}
              className="treinamento-btn treinamento-btn--primario"
            >
              + Adicionar Exercício
            </button>
          </div>

          <div className="campo-full">
            <button
              type="submit"
              disabled={carregando}
              className="treinamento-btn treinamento-btn--escuro"
            >
              {carregando ? 'Salvando...' : 'Salvar Ficha de Treino'}
            </button>
          </div>
        </form>
      </div>

      <h3>Treinos Cadastrados</h3>

      {treinos.length === 0 ? (
        <div>Nenhum treino cadastrado.</div>
      ) : (
        <div className="treinos-grid">
          {treinos.map((t) => {
            const alunoObj = buscarAlunoPorTreino(t);
            const listaEx = normalizarListaExerciciosTreino(t.exercicios);

            return (
              <div key={t.id} className="form-card treino-card">
                <div>
                  <h4>{t.divisao}</h4>
                  <p>
                    <strong>Aluno:</strong> {alunoObj ? alunoObj.nome || alunoObj.name : 'Desconhecido'}
                  </p>

                  <div className="treino-exercicios-lista">
                    {listaEx.map((ex, i) => (
                      <div key={i} className="treinamento-preview-item">
                        <div>
                          <strong>
                            {i + 1}. {ex.nome}
                          </strong>
                          {(ex.series || ex.repeticoes) && (
                            <>
                              {' '}
                              — {ex.series || '-'}x{ex.repeticoes || '-'}
                            </>
                          )}
                          {ex.carga ? ` (${ex.carga})` : ''}
                          {ex.descanso ? ` • Desc: ${ex.descanso}` : ''}
                        </div>
                       {ex.observacao && <div>Obs: {ex.observacao}</div>}                      </div>
                    ))}
                  </div>
                </div>

                <div className="treino-acoes">
                  {alunoObj && (
                    <Link
                      to={`/alunos/${alunoObj.id}`}
                      className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                      title="Ver ficha completa, modelos e histórico do aluno"
                    >
                      📋 Ver Ficha & Modelos
                    </Link>
                  )}
                  <a
                    href={gerarLinkWhatsApp(t)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-whatsapp"
                  >
                    💬 Enviar WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => excluirTreino(t.id)}
                    className="btn-excluir-treino"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}