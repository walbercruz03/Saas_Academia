const lado = 64;
const bytes = lado * lado;
const versao = 'lbp-espacial-v1';

function analisar(frame) {
  if (!Buffer.isBuffer(frame) || frame.length !== bytes) return null;
  let soma = 0;
  let quadrados = 0;
  let peso = 0;
  let centro = 0;
  for (let y = 8; y < 56; y++) {
    for (let x = 8; x < 56; x++) {
      const i = y * lado + x;
      const valor = frame[i];
      soma += valor;
      quadrados += valor * valor;
      const gradiente = Math.abs(frame[i+1] - frame[i-1]) + Math.abs(frame[i+lado] - frame[i-lado]);
      peso += gradiente;
      centro += x * gradiente;
    }
  }
  const media = soma / 2304;
  const contraste = Math.sqrt(Math.max(0,quadrados / 2304 - media * media));
  if (media < 35 || media > 220 || contraste < 16 || peso < 6500) return null;

  // Histograma regional de padrões binários locais resumidos pela contagem de vizinhos.
  const vetor = new Float32Array(4 * 4 * 9);
  for (let y = 8; y < 56; y++) {
    for (let x = 8; x < 56; x++) {
      const i = y * lado + x;
      const valor = frame[i];
      const vizinhos = (frame[i-65] >= valor) + (frame[i-64] >= valor) + (frame[i-63] >= valor) +
        (frame[i-1] >= valor) + (frame[i+1] >= valor) + (frame[i+63] >= valor) +
        (frame[i+64] >= valor) + (frame[i+65] >= valor);
      const bloco = Math.floor((y-8)/12)*4 + Math.floor((x-8)/12);
      vetor[bloco*9 + vizinhos]++;
    }
  }
  let norma = 0;
  for (let i = 0; i < vetor.length; i++) {
    vetor[i] = Math.sqrt(vetor[i]);
    norma += vetor[i] ** 2;
  }
  for (let i = 0; i < vetor.length; i++) vetor[i] /= Math.sqrt(norma);
  return { vetor,centro:centro/peso };
}

function similaridade(a,b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

// Heurística de movimento para assistência. A aprovação automática permanece interditada.
function movimento(baseline,atual,direcao) {
  const deslocamento = (atual.centro - baseline.centro) * (direcao === 'direita' ? 1 : -1);
  return deslocamento >= 3 && deslocamento <= 19 &&
    similaridade(baseline.vetor,atual.vetor) >= 0.35 &&
    similaridade(baseline.vetor,atual.vetor) < 0.9999;
}

module.exports = { analisar,similaridade,movimento,bytes,versao };
