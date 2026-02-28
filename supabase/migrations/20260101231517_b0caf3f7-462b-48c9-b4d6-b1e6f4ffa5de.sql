-- Update PROC template header with max-height constraint
UPDATE document_templates
SET content = regexp_replace(
  content,
  '\.office-header\s*\{([^}]*)\}',
  '.office-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 25px;
      background: linear-gradient(135deg, #C9A227 0%, #E8D48A 50%, #C9A227 100%);
      border-bottom: 3px solid #8B7355;
      min-height: 100px;
      max-height: 200px;
      overflow: hidden;
    }',
  'g'
)
WHERE code IN ('PROC', 'DECL', 'CONTRATO')
  AND content LIKE '%.office-header%';