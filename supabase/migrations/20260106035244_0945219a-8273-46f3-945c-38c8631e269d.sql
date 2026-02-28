-- Adicionar CSS do rodapé Lexos aos templates globais
UPDATE document_templates
SET content = REPLACE(
  content,
  '</style>',
  '
    /* Rodapé Lexos - não editável */
    .lexos-footer {
      text-align: center;
      font-size: 8pt;
      color: #888;
      padding: 15px 0;
      border-top: 1px solid #e5e5e5;
      margin-top: 30px;
    }
    @media print {
      .lexos-footer {
        position: fixed;
        bottom: 5mm;
        left: 20mm;
        right: 20mm;
      }
    }
  </style>'
)
WHERE office_id IS NULL
AND code IN ('PROC', 'DECL', 'CONTRATO')
AND content NOT LIKE '%lexos-footer%';

-- Adicionar o footer HTML antes do </body> nos templates globais
UPDATE document_templates
SET content = REPLACE(
  content,
  '</body>',
  '
    <div class="lexos-footer">
      Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
    </div>
  </body>'
)
WHERE office_id IS NULL
AND code IN ('PROC', 'DECL', 'CONTRATO')
AND content NOT LIKE '%lexos-footer%';