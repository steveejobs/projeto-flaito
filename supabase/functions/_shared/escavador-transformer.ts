/**
 * supabase/functions/_shared/escavador-transformer.ts
 * Camada determinística de normalização de dados do Escavador.
 */

export type TokenOptimizationProfile = "MINIMAL" | "STANDARD" | "DETAILED";

export interface NormalizedEscavadorProcess {
  source: "ESCAVADOR"
  sourceVersion?: string
  externalId?: string | null

  identification: {
    numeroProcesso: string | null
    tribunal: string | null
    orgaoJulgador?: string | null
    sistema?: string | null
    classe?: string | null
    assuntoPrincipal?: string | null
    assuntos?: string[]
    vara?: string | null
    comarca?: string | null
    fase?: string | null
    status?: string | null
    valorCausa?: string | null
  }

  parties: {
    poloAtivo: Array<{
      nome: string
      documento?: string | null
      tipo?: string | null
    }>
    poloPassivo: Array<{
      nome: string
      documento?: string | null
      tipo?: string | null
    }>
    outrosEnvolvidos?: Array<{
      nome: string
      tipo?: string | null
    }>
  }

  lawyers: Array<{
    nome: string
    oab?: string | null
    uf?: string | null
    lado?: "ATIVO" | "PASSIVO" | "OUTRO" | null
  }>

  movements: Array<{
    data: string | null
    titulo?: string | null
    descricao: string
    tipo?: string | null
    relevante?: boolean
  }>

  documents?: Array<{
    id?: string | null
    titulo?: string | null
    tipo?: string | null
    data?: string | null
    publicUrl?: string | null
    hasPdf?: boolean
  }>

  summary: {
    totalMovements: number
    lastMovementDate?: string | null
    lastRelevantMovement?: string | null
    keyFacts: string[]
  }

  metadata: {
    normalizedAt: string
    tokenOptimizationProfile: TokenOptimizationProfile
  }
}

/**
 * Normaliza o payload bruto do Escavador (v2) para o formato interno enxuto.
 */
export function normalizeEscavadorProcess(raw: any): Omit<NormalizedEscavadorProcess, 'metadata'> {
  const p = raw.processo || raw;
  
  // 1. Identificação
  const identification = {
    numeroProcesso: p.numero_cnj || p.numero || null,
    tribunal: p.tribunal?.sigla || p.tribunal?.nome || p.tribunal || null,
    orgaoJulgador: p.orgao_julgador || null,
    sistema: p.sistema || null,
    classe: p.classe || null,
    assuntoPrincipal: p.assunto_principal || null,
    assuntos: Array.isArray(p.assuntos) ? p.assuntos : [],
    vara: p.vara || null,
    comarca: p.comarca || null,
    fase: p.fase || null,
    status: p.status || null,
    valorCausa: p.valor_causa ? `R$ ${p.valor_causa}` : null,
  };

  // 2. Partes e Envolvidos
  const active: any[] = [];
  const passive: any[] = [];
  const others: any[] = [];
  const lawyers: any[] = [];

  const envolvidos = p.envolvidos || [];
  envolvidos.forEach((env: any) => {
    const entry = {
      nome: env.nome,
      documento: env.cpf_cnpj || null,
      tipo: env.tipo || env.tipo_normalizado || null
    };

    const tipo = (entry.tipo || "").toUpperCase();
    
    // Heurística de Polo
    if (tipo.includes("AUTOR") || tipo.includes("REQUERENTE") || tipo.includes("ATIVO")) {
      active.push(entry);
    } else if (tipo.includes("REU") || tipo.includes("REQUERIDO") || tipo.includes("PASSIVO")) {
      passive.push(entry);
    } else if (tipo.includes("ADVOGADO")) {
      // Advogados isolados se houver
    } else {
      others.push(entry);
    }

    // Extração de Advogados vinculados às partes
    if (env.advogados && Array.isArray(env.advogados)) {
      env.advogados.forEach((adv: any) => {
        let lado: "ATIVO" | "PASSIVO" | "OUTRO" | null = "OUTRO";
        if (active.includes(entry)) lado = "ATIVO";
        if (passive.includes(entry)) lado = "PASSIVO";

        lawyers.push({
          nome: adv.nome,
          oab: adv.oab || null,
          uf: adv.uf || null,
          lado
        });
      });
    }
  });

  // 3. Movimentações
  const rawMovements = p.movimentacoes || [];
  const movements = rawMovements.map((m: any) => {
    const desc = m.texto || m.conteudo || "";
    return {
      data: m.data || null,
      titulo: m.titulo || null,
      descricao: desc,
      tipo: m.tipo || null,
      relevante: isMovementRelevant(m.titulo || "", desc)
    };
  });

  // 4. Resumo e Estatísticas
  // Ordena para garantir que o resumo tenha os dados mais recentes de fato
  const sortedMovements = [...movements].sort((a, b) => 
    new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
  );

  const relevantMovements = sortedMovements.filter((m: any) => m.relevante);
  const summary = {
    totalMovements: movements.length,
    lastMovementDate: sortedMovements[0]?.data || null,
    lastRelevantMovement: relevantMovements[0]?.titulo || null,
    keyFacts: [] // Pode ser preenchido por lógica adicional posterior
  };

  return {
    source: "ESCAVADOR",
    sourceVersion: "v2",
    externalId: p.id?.toString() || null,
    identification,
    parties: {
      poloAtivo: active,
      poloPassivo: passive,
      outrosEnvolvidos: others
    },
    lawyers: deduplicateLawyers(lawyers),
    movements,
    summary
  };
}

/**
 * Heurística para determinar se uma movimentação é juridicamente relevante.
 */
function isMovementRelevant(titulo: string, descricao: string): boolean {
  const normalize = (str: string) => 
    str.normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .toUpperCase();

  const text = normalize(`${titulo} ${descricao}`);
  const keywords = [
    "SENTENCA", "DECISAO", "LIMINAR", "ANTECIPACAO", "CONTESTACAO", 
    "RECURSO", "APELACAO", "AGRAVO", "AUDIENCIA", "DESPACHO", 
    "MANDADO", "CUMPRIMENTO", "ARQUIVAMENTO"
  ];
  
  return keywords.some(k => text.includes(k));
}

/**
 * Remove advogados duplicados (mesmo nome e OAB).
 */
function deduplicateLawyers(lawyers: any[]): any[] {
  const seen = new Set();
  return lawyers.filter(l => {
    const key = `${l.nome}-${l.oab}`.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Renderiza o processo normalizado em Markdown jurídico compacto.
 */
export function renderEscavadorProcessMarkdown(p: NormalizedEscavadorProcess): string {
  const profile = p.metadata.tokenOptimizationProfile;
  const lines: string[] = [];

  // Cabeçalho Principal (Sempre Curto)
  lines.push(`# Processo: ${p.identification.numeroProcesso || "N/A"}`);
  
  // Seção 1: Identificação
  lines.push("\n## Identificação");
  const idFields = [
    { label: "Tribunal", val: p.identification.tribunal },
    { label: "Classe", val: p.identification.classe },
    { label: "Vara", val: p.identification.vara },
    { label: "Comarca", val: p.identification.comarca },
    { label: "Assunto", val: p.identification.assuntoPrincipal },
    { label: "Valor", val: p.identification.valorCausa },
    { label: "Status", val: p.identification.status },
  ];

  idFields.forEach(f => {
    if (f.val) lines.push(`- **${f.label}:** ${f.val}`);
  });

  // Seção 2: Partes (Omitido em MINIMAL se não for essencial)
  if (profile !== "MINIMAL") {
    lines.push("\n## Partes");
    if (p.parties.poloAtivo.length > 0) {
      lines.push("### Polo Ativo");
      p.parties.poloAtivo.forEach(pt => lines.push(`- ${pt.nome}${pt.documento ? ` (${pt.documento})` : ""}`));
    }
    if (p.parties.poloPassivo.length > 0) {
      lines.push("### Polo Passivo");
      p.parties.poloPassivo.forEach(pt => lines.push(`- ${pt.nome}${pt.documento ? ` (${pt.documento})` : ""}`));
    }
  } else {
    // Em MINIMAL, apenas um resumo das partes
    const principalAtivo = p.parties.poloAtivo[0]?.nome || "Não informado";
    const principalPassivo = p.parties.poloPassivo[0]?.nome || "Não informado";
    lines.push(`- **Partes:** ${principalAtivo} × ${principalPassivo}`);
  }

  // Seção 3: Advogados (Apenas em STANDARD e DETAILED)
  if (profile !== "MINIMAL" && p.lawyers.length > 0) {
    lines.push("\n## Advogados");
    p.lawyers.forEach(l => {
      lines.push(`- ${l.nome} (OAB ${l.oab}/${l.uf}) - ${l.lado || 'OUTRO'}`);
    });
  }

  // Seção 4: Movimentações (Seleção por perfil)
  const movLimit = profile === "MINIMAL" ? 3 : profile === "STANDARD" ? 10 : 20;
  
  // Prioriza movimentos relevantes primeiro se forem muitos
  const filteredMovements = selectMovements(p.movements, movLimit);
  
  if (filteredMovements.length > 0) {
    lines.push(`\n## Movimentações (${profile})`);
    filteredMovements.forEach((m, idx) => {
      const marker = m.relevante ? "⭐ " : "";
      lines.push(`${idx + 1}. ${marker}${m.data || "N/A"} - **${m.titulo || "Sem título"}**`);
      if (profile === "DETAILED" && m.descricao) {
        // Trunca descrições gigantes no DETAILED para não explodir tokens
        const desc = m.descricao.length > 200 ? m.descricao.substring(0, 200) + "..." : m.descricao;
        lines.push(`   > ${desc.trim().replace(/\n/g, ' ')}`);
      } else if (profile !== "MINIMAL" && m.descricao && m.relevante) {
        // No STANDARD, mostra apenas se for relevante
        const desc = m.descricao.length > 100 ? m.descricao.substring(0, 100) + "..." : m.descricao;
        lines.push(`   > ${desc.trim().replace(/\n/g, ' ')}`);
      }
    });

    if (p.summary.totalMovements > movLimit) {
      lines.push(`\n*Nota: Há mais ${p.summary.totalMovements - movLimit} movimentações não exibidas neste resumo.*`);
    }
  }

  // Seção 5: Documentos (Apenas STANDARD e DETAILED)
  if (profile !== "MINIMAL" && p.documents && p.documents.length > 0) {
     lines.push("\n## Documentos Públicos");
     p.documents.forEach(doc => {
       lines.push(`- ${doc.tipo || 'DOC'} - ${doc.titulo || 'S/T'} - ${doc.data || ''}`);
     });
  }

  // Seção 6: Resumo Operacional
  lines.push("\n## Resumo Operacional");
  lines.push(`- **Total de Movimentações:** ${p.summary.totalMovements}`);
  lines.push(`- **Último Andamento:** ${p.summary.lastMovementDate || "Pendente"}`);
  if (p.summary.lastRelevantMovement) {
    lines.push(`- **Último Relevante:** ${p.summary.lastRelevantMovement}`);
  }

  return lines.join("\n").trim();
}

/**
 * Lógica inteligente de seleção de movimentos.
 */
function selectMovements(movements: any[], limit: number): any[] {
  // Ordena por data (mais recente primeiro)
  const sorted = [...movements].sort((a, b) => 
    new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
  );

  // Se temos menos que o limite, retorna todos
  if (sorted.length <= limit) return sorted;

  // Se exceder, prioriza relevantes primeiro, mas mantém ordem cronológica
  const relevant = sorted.filter(m => m.relevante);
  const others = sorted.filter(m => !m.relevante);

  // Preenche o limite com relevantes e depois outros
  const selected = [...relevant, ...others].slice(0, limit);
  
  // Reordena cronologicamente os selecionados para o Markdown (recente primeiro)
  return selected.sort((a, b) => 
    new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
  );
}
