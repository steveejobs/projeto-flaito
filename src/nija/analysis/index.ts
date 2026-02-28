// src/nija/analysis/index.ts
// Barrel export para módulo de análise NIJA

// Detectores de vícios
export {
  type DetectionResult,
  // Detectores originais (títulos executivos e bancários)
  detectNotaPromissoriaVinculada,
  detectTacIndevida,
  detectJurosCapitalizados,
  detectForoEleicaoAbusivo,
  detectPenhoraExcessiva,
  detectPrescricaoCambial,
  detectTituloSemTestemunha,
  detectTaxaJurosAbusiva,
  detectVencimentoAntecipadoAbusivo,
  detectImpenhorabilidade,
  // Novos detectores V2 (processuais)
  detectNulidadeCitacao,
  detectCerceamentoDefesa,
  detectInepciaPeticaoInicial,
  detectAusenciaFundamentacao,
  detectCDAIrregular,
  detectMultaConfiscatoria,
  detectErroCalculo,
  detectLitispendenciaCoisa,
  detectIncompetencia,
  detectSentencaExtraUltraCitra,
  type TipoTituloCambial,
} from "./defectDetectors";

// Calculador de prescrição
export {
  type TipoTitulo,
  type PrazoPrescricao,
  type StatusPrescricao,
  type AnalisePrescricao,
  PRAZOS_PRESCRICIONAIS,
  calcularPrescricao,
  inferirTipoTitulo,
  calcularPrescricaoIntercorrente,
} from "./prescricaoCalculator";

// Extrator de contratos
export {
  type DadosContratoExtraido,
  extrairDadosContrato,
  isContratoPosTAC,
  calcularExcessoExecucao,
} from "./contractExtractor";
