-- 1. Adicionar KIT_RECIBO ao enum client_file_kind
ALTER TYPE client_file_kind ADD VALUE IF NOT EXISTS 'KIT_RECIBO';

-- 2. Atualizar template existente com code = 'RECIBO' e adicionar rodapé Lexos
UPDATE document_templates
SET 
  code = 'RECIBO',
  content = REPLACE(
    REPLACE(
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
    ),
    '</body>',
    '
    <div class="lexos-footer">
      Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
    </div>
  </body>'
  )
WHERE id = 'c486494e-4bad-402b-9e40-cfcaa372c3e9';

-- 3. Criar versão global (fallback) do template de Recibo
INSERT INTO document_templates (code, name, category, content, is_active, office_id)
SELECT 'RECIBO', name, category, content, true, NULL
FROM document_templates
WHERE id = 'c486494e-4bad-402b-9e40-cfcaa372c3e9'
ON CONFLICT DO NOTHING;