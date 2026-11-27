export const formatosLogotipo = ['image/png', 'image/jpeg', 'image/webp'];

const limiteOriginal = 10_000_000;
const limiteArmazenamento = 128 * 1024;
const dimensaoMaxima = 1024;
const qualidades = [0.92, 0.82, 0.72];

function codificar(canvas, formato, qualidade) {
  return new Promise((resolver) => canvas.toBlob(resolver, formato, qualidade));
}

async function carregarImagem(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    return imagem;
  } catch {
    throw new Error('Não foi possível abrir a imagem. O arquivo pode estar corrompido.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepararLogotipo(arquivo) {
  if (!formatosLogotipo.includes(arquivo.type)) {
    throw new Error('Formato inválido. Selecione uma imagem PNG, JPEG ou WebP.');
  }
  if (!arquivo.size) throw new Error('O arquivo está vazio.');
  if (arquivo.size > limiteOriginal) throw new Error('A imagem deve ter até 10 MB.');

  const imagem = await carregarImagem(arquivo);
  const { naturalWidth: largura, naturalHeight: altura } = imagem;
  const maiorLado = Math.max(largura, altura);
  const canvas = document.createElement('canvas');
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Este navegador não conseguiu processar a imagem.');

  const formato = arquivo.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let preservarPng = arquivo.type === 'image/png';
  let lado = Math.min(maiorLado, dimensaoMaxima);
  while (lado >= 1) {
    canvas.width = Math.max(1, Math.round(largura * lado / maiorLado));
    canvas.height = Math.max(1, Math.round(altura * lado / maiorLado));
    contexto.imageSmoothingQuality = 'high';
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

    if (preservarPng) {
      const png = await codificar(canvas, 'image/png');
      if (png?.size && png.size <= limiteArmazenamento) return png;
    }

    for (const qualidade of qualidades) {
      const imagemComprimida = await codificar(canvas, formato, qualidade);
      if (imagemComprimida?.size && imagemComprimida.size <= limiteArmazenamento) return imagemComprimida;
      // Navegadores sem suporte à codificação WebP retornam PNG.
      if (imagemComprimida?.type !== formato) {
        preservarPng = true;
        break;
      }
    }

    lado = Math.floor(lado * 0.75);
  }

  throw new Error('Não foi possível reduzir a imagem ao limite de 128 KiB.');
}
