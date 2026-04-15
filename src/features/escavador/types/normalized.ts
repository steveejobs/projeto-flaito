/**
 * src/features/escavador/types/normalized.ts
 * Re-exportação dos tipos de transformação para o frontend.
 */

// Nota: Em um ambiente real, poderíamos usar um symlink ou importar diretamente 
// se a estrutura de build permitir. Aqui estamos definindo para o frontend.

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
