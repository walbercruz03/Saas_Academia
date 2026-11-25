const PDFDocument = require('pdfkit');

const TIMEZONE = 'America/Fortaleza';

const TITULOS_TIPO = {
  geral: 'Relatório Geral',
  financeiro: 'Relatório Financeiro',
  alunos: 'Relatório de Alunos',
  matriculas: 'Relatório de Matrículas',
  frequencia: 'Relatório de Frequência',
  planos: 'Relatório de Planos',
};

const formatarMoedaBR = (valor) => {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarDataBR = (valor) => {
  if (!valor) return '—';
  const str = String(valor).trim();
  const matchData = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchData && !str.includes('T') && !str.includes(':')) {
    return `${matchData[3]}/${matchData[2]}/${matchData[1]}`;
  }
  const d = new Date(str.includes(' ') && !str.includes('T') ? `${str.replace(' ', 'T')}Z` : str);
  if (Number.isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

const formatarDataHoraBR = (valor) => {
  const d = valor ? new Date(valor) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
};

const formatarHoraBR = (valor) => {
  if (!valor) return '—';
  const str = String(valor).trim();
  const d = new Date(str.includes(' ') && !str.includes('T') ? `${str.replace(' ', 'T')}Z` : str);
  if (Number.isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

const mascararCPF = (cpf) => {
  if (!cpf) return 'Não informado';
  const digitos = String(cpf).replace(/\D/g, '');
  if (digitos.length < 11) return 'Não informado';
  return `***.***.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
};

const gerarPDF = (data, res) => {
  try {
    const tipo = data.tipo || 'geral';
    const tituloRelatorio = TITULOS_TIPO[tipo] || 'Relatório Gerencial';
    const dataInicioBR = formatarDataBR(data.dataInicio);
    const dataFimBR = formatarDataBR(data.dataFim);
    const intervaloTexto =
      dataInicioBR === dataFimBR ? dataInicioBR : `${dataInicioBR} até ${dataFimBR}`;
    const emissaoFormatada = formatarDataHoraBR(data.geradoEm || new Date());
    const nomeUsuario = data.usuario?.nome || 'Administrador';

    const {
      resumoAlunos = {},
      resumoMatriculas = {},
      resumoFrequencia = {},
      resumoPlanos = {},
      resumoFinanceiro = {},
    } = data;

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
    });

    const corEscura = '#0f172a';
    const corSecundaria = '#1e293b';
    const corDestaque = '#0891b2';
    const corTexto = '#334155';
    const corMuted = '#64748b';
    const corBorda = '#cbd5e1';
    const corFundo = '#f8fafc';
    const larguraUtil = doc.page.width - 80;
    const limiteInferior = doc.page.height - 62;

    const desenharCabecalho = (subtituloExtra = '') => {
      doc.rect(40, 38, larguraUtil, 54).fill(corEscura);
      doc
        .fillColor('#ffffff')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`WC FIT — ${tituloRelatorio.toUpperCase()}`, 54, 47, { width: larguraUtil - 28 });
      doc
        .fillColor('#67e8f9')
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(
          `Período: ${data.descricaoPeriodo || 'Selecionado'} (${intervaloTexto})  •  Emitido: ${emissaoFormatada}`,
          54,
          65,
          { width: larguraUtil - 28 }
        );
      doc
        .fillColor('#cbd5e1')
        .fontSize(8)
        .font('Helvetica')
        .text(`Responsável: ${nomeUsuario}${subtituloExtra ? `  |  ${subtituloExtra}` : ''}`, 54, 78, {
          width: larguraUtil - 28,
        });
      return 108;
    };

    const garantirEspaco = (yAtual, alturaNecessaria, onNovaPagina) => {
      if (yAtual + alturaNecessaria > limiteInferior) {
        doc.addPage();
        return typeof onNovaPagina === 'function' ? onNovaPagina(42) : desenharCabecalho();
      }
      return yAtual;
    };

    let y = desenharCabecalho();

    const incluirAlunos = tipo === 'geral' || tipo === 'alunos';
    const incluirMatriculas = tipo === 'geral' || tipo === 'matriculas' || tipo === 'financeiro';
    const incluirFrequencia = tipo === 'geral' || tipo === 'frequencia';
    const incluirPlanos = tipo === 'geral' || tipo === 'planos' || tipo === 'financeiro';
    const incluirFinanceiro = tipo === 'geral' || tipo === 'financeiro';

    // Resumo Executivo
    doc.fillColor(corSecundaria).fontSize(11).font('Helvetica-Bold').text('Resumo do Período', 40, y);
    y += 16;

    const resumoItens = [];
    if (incluirAlunos) {
      resumoItens.push(
        `• Alunos: ${resumoAlunos.novosNoPeriodo ?? 0} novo(s) no período | Base total: ${resumoAlunos.totalPeriodo ?? 0} (${resumoAlunos.ativos ?? 0} ativos, ${resumoAlunos.inativos ?? 0} inativos/outros).`
      );
    }
    if (incluirMatriculas) {
      resumoItens.push(
        `• Matrículas: ${resumoMatriculas.totalNoPeriodo ?? 0} iniciada(s) no período | ${resumoMatriculas.vencidasNoPeriodo ?? 0} com vencimento no período | ${resumoMatriculas.ativas ?? 0} ativas no total.`
      );
    }
    if (incluirFrequencia) {
      resumoItens.push(
        `• Frequência: ${resumoFrequencia.totalCheckins ?? 0} check-in(s) no período | ${resumoFrequencia.alunosDistinct ?? 0} aluno(s) presente(s) distinto(s).`
      );
    }
    if (incluirPlanos) {
      resumoItens.push(
        `• Planos: ${resumoPlanos.totalContratados ?? 0} contratação(ões) no período | ${resumoPlanos.totalCadastrados ?? 0} plano(s) cadastrado(s).`
      );
    }
    if (incluirFinanceiro) {
      if (resumoFinanceiro?.disponivel) {
        resumoItens.push(
          `• Financeiro: Total recebido ${formatarMoedaBR(resumoFinanceiro.totalRecebido)} (${resumoFinanceiro.confirmados ?? 0} confirmado(s), ${resumoFinanceiro.pendentes ?? 0} pendente(s)).`
        );
      } else {
        resumoItens.push(
          `• Financeiro: Valor contratado em matrículas no período: ${formatarMoedaBR(resumoFinanceiro?.valorContratadoPeriodo ?? 0)} (${resumoFinanceiro?.observacao || 'Sem tabela de pagamentos'}).`
        );
      }
    }

    resumoItens.forEach((txt) => {
      y = garantirEspaco(y, 24);
      doc.fillColor(corTexto).fontSize(9).font('Helvetica').text(txt, 40, y, {
        width: larguraUtil,
        lineGap: 2,
      });
      y = doc.y + 5;
    });

    y += 10;

    // Seção Alunos
    if (incluirAlunos) {
      const cabAlunos = (posY) => {
        doc.fillColor(corSecundaria).fontSize(10.5).font('Helvetica-Bold').text('Novos Alunos no Período', 40, posY);
        const ty = posY + 15;
        doc.rect(40, ty, larguraUtil, 20).fill(corSecundaria);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('Nome', 46, ty + 6, { width: 155 });
        doc.text('CPF', 205, ty + 6, { width: 95 });
        doc.text('Telefone', 304, ty + 6, { width: 100 });
        doc.text('Cadastro', 408, ty + 6, { width: 68 });
        doc.text('Situação', 480, ty + 6, { width: 72 });
        return ty + 22;
      };

      y = garantirEspaco(y, 50, cabAlunos);
      const listaAlunos = resumoAlunos.lista || [];
      if (listaAlunos.length > 0) {
        y = cabAlunos(y);
        listaAlunos.forEach((a, idx) => {
          y = garantirEspaco(y, 20, cabAlunos);
          if (idx % 2 === 1) doc.rect(40, y - 2, larguraUtil, 20).fill(corFundo);
          doc.fillColor(corTexto).fontSize(8).font('Helvetica');
          doc.text(a.nome || '—', 46, y + 4, { width: 155, ellipsis: true });
          doc.text(mascararCPF(a.cpf), 205, y + 4, { width: 95 });
          doc.text(a.telefone || '—', 304, y + 4, { width: 100, ellipsis: true });
          doc.text(formatarDataBR(a.criado_em), 408, y + 4, { width: 68 });
          doc.text(a.status || '—', 480, y + 4, { width: 72 });
          y += 20;
        });
      } else {
        doc.fillColor(corMuted).fontSize(9).font('Helvetica').text('Nenhum aluno novo cadastrado no período.', 40, y);
        y += 18;
      }
      y += 12;
    }

    // Seção Matrículas
    if (incluirMatriculas) {
      const cabMat = (posY) => {
        doc.fillColor(corSecundaria).fontSize(10.5).font('Helvetica-Bold').text('Matrículas no Período', 40, posY);
        const ty = posY + 15;
        doc.rect(40, ty, larguraUtil, 20).fill(corSecundaria);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('Aluno', 46, ty + 6, { width: 145 });
        doc.text('Plano', 195, ty + 6, { width: 120 });
        doc.text('Início', 319, ty + 6, { width: 65 });
        doc.text('Vencimento', 388, ty + 6, { width: 70 });
        doc.text('Valor', 462, ty + 6, { width: 52 });
        doc.text('Status', 518, ty + 6, { width: 38 });
        return ty + 22;
      };

      y = garantirEspaco(y, 50, cabMat);
      const listaMat = resumoMatriculas.lista || [];
      if (listaMat.length > 0) {
        y = cabMat(y);
        listaMat.forEach((m, idx) => {
          y = garantirEspaco(y, 20, cabMat);
          if (idx % 2 === 1) doc.rect(40, y - 2, larguraUtil, 20).fill(corFundo);
          doc.fillColor(corTexto).fontSize(8).font('Helvetica');
          doc.text(m.aluno_nome || '—', 46, y + 4, { width: 145, ellipsis: true });
          doc.text(m.plano_nome || '—', 195, y + 4, { width: 120, ellipsis: true });
          doc.text(formatarDataBR(m.data_inicio?.slice(0, 10)), 319, y + 4, { width: 65 });
          doc.text(formatarDataBR(m.data_vencimento?.slice(0, 10)), 388, y + 4, { width: 70 });
          doc.text(formatarMoedaBR(m.valor_pago), 462, y + 4, { width: 52 });
          const status = (m.situacao_efetiva || m.status || '—').replaceAll('_', ' ');
          doc.text(status, 518, y + 4, { width: 38, height: 16 });
          y += 20;
        });
      } else {
        doc.fillColor(corMuted).fontSize(9).font('Helvetica').text('Nenhuma matrícula iniciada no período.', 40, y);
        y += 18;
      }
      y += 12;
    }

    // Seção Frequência
    if (incluirFrequencia) {
      const cabFreq = (posY) => {
        doc.fillColor(corSecundaria).fontSize(10.5).font('Helvetica-Bold').text('Frequência / Check-ins no Período', 40, posY);
        const ty = posY + 15;
        doc.rect(40, ty, larguraUtil, 20).fill(corDestaque);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('Aluno', 46, ty + 6, { width: 165 });
        doc.text('Data/Hora', 215, ty + 6, { width: 95 });
        doc.text('Check-ins', 315, ty + 6, { width: 65 });
        doc.text('Observações', 385, ty + 6, { width: 170 });
        return ty + 22;
      };

      y = garantirEspaco(y, 50, cabFreq);
      const listaFreq = resumoFrequencia.lista || [];
      if (listaFreq.length > 0) {
        y = cabFreq(y);
        listaFreq.forEach((c, idx) => {
          y = garantirEspaco(y, 20, cabFreq);
          if (idx % 2 === 1) doc.rect(40, y - 2, larguraUtil, 20).fill(corFundo);
          doc.fillColor(corTexto).fontSize(8).font('Helvetica');
          doc.text(c.aluno_nome || '—', 46, y + 4, { width: 165, ellipsis: true });
          doc.text(`${formatarDataBR(c.data_checkin)} ${formatarHoraBR(c.data_checkin)}`, 215, y + 4, { width: 95 });
          doc.text(String(c.total_checkins_periodo ?? 1), 315, y + 4, { width: 65 });
          doc.text(c.observacoes || '—', 385, y + 4, { width: 170, ellipsis: true });
          y += 20;
        });
      } else {
        doc.fillColor(corMuted).fontSize(9).font('Helvetica').text('Nenhum check-in registrado no período.', 40, y);
        y += 18;
      }
      y += 12;
    }

    // Seção Planos
    if (incluirPlanos) {
      const cabPlanos = (posY) => {
        doc.fillColor(corSecundaria).fontSize(10.5).font('Helvetica-Bold').text('Planos e Contratações', 40, posY);
        const ty = posY + 15;
        doc.rect(40, ty, larguraUtil, 20).fill(corSecundaria);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('Plano', 46, ty + 6, { width: 185 });
        doc.text('Preço', 235, ty + 6, { width: 80 });
        doc.text('Contratados', 320, ty + 6, { width: 85 });
        doc.text('Valor Período', 410, ty + 6, { width: 145 });
        return ty + 22;
      };

      y = garantirEspaco(y, 50, cabPlanos);
      const listaPlanos = resumoPlanos.porPlano || [];
      if (listaPlanos.length > 0) {
        y = cabPlanos(y);
        listaPlanos.forEach((p, idx) => {
          y = garantirEspaco(y, 20, cabPlanos);
          if (idx % 2 === 1) doc.rect(40, y - 2, larguraUtil, 20).fill(corFundo);
          doc.fillColor(corTexto).fontSize(8).font('Helvetica');
          doc.text(p.nome || '—', 46, y + 4, { width: 185, ellipsis: true });
          doc.text(formatarMoedaBR(p.preco), 235, y + 4, { width: 80 });
          doc.text(String(p.contratadosNoPeriodo ?? 0), 320, y + 4, { width: 85 });
          doc.text(formatarMoedaBR(p.valorContratadoPlano ?? 0), 410, y + 4, { width: 145 });
          y += 20;
        });
      } else {
        doc.fillColor(corMuted).fontSize(9).font('Helvetica').text('Nenhum plano cadastrado.', 40, y);
        y += 18;
      }
      y += 12;
    }

    // Seção Financeiro
    if (incluirFinanceiro) {
      y = garantirEspaco(y, 70);
      doc.fillColor(corSecundaria).fontSize(10.5).font('Helvetica-Bold').text('Detalhamento Financeiro', 40, y);
      y += 16;

      if (resumoFinanceiro?.disponivel) {
        doc.fillColor(corTexto).fontSize(9).font('Helvetica');
        doc.text(`Total Efetivamente Recebido: ${formatarMoedaBR(resumoFinanceiro.totalRecebido)}`, 40, y);
        y += 14;
        doc.text(
          `Confirmados: ${resumoFinanceiro.confirmados ?? 0}  |  Pendentes: ${resumoFinanceiro.pendentes ?? 0} (${formatarMoedaBR(resumoFinanceiro.valorPendente ?? 0)})`,
          40,
          y
        );
        y += 18;
      } else {
        doc.rect(40, y, larguraUtil, 48).fillAndStroke('#fffbeb', '#f59e0b');
        doc
          .fillColor('#92400e')
          .fontSize(8.5)
          .font('Helvetica')
          .text(
            resumoFinanceiro?.observacao ||
              'Sem tabela de pagamentos independente no SQLite. Valor contratado no período: ' +
                formatarMoedaBR(resumoFinanceiro?.valorContratadoPeriodo ?? 0),
            48,
            y + 8,
            { width: larguraUtil - 16, lineGap: 2 }
          );
        y += 58;
      }
    }

    // Rodapé em todas as páginas
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const ry = doc.page.height - 30;
      doc.moveTo(40, ry - 6).lineTo(40 + larguraUtil, ry - 6).strokeColor(corBorda).stroke();
      doc
        .fillColor(corMuted)
        .fontSize(8)
        .font('Helvetica')
        .text(`Wc Fit • ${tituloRelatorio} • ${intervaloTexto}`, 40, ry, { width: larguraUtil - 90 });
      doc
        .fillColor(corMuted)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(`Página ${i + 1} de ${range.count}`, 40 + larguraUtil - 90, ry, {
          width: 90,
          align: 'right',
        });
    }

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const nomeArquivo = `relatorio-${tipo}-${data.dataInicio || 'periodo'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      return res.send(pdfBuffer);
    });

    doc.end();
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao gerar o relatório PDF.' });
  }
};

module.exports = { gerarPDF };
