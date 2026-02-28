-- Atualiza a Cláusula Quarta do template CONTRATO para usar as novas descrições automáticas
UPDATE document_templates
SET content = REPLACE(
  content,
  '<div class="clausula">
  <p class="clausula-titulo">Cláusula Quarta – Dos Honorários</p>
  <div class="honorarios-highlight">
    <p class="clausula-texto">{{honorarios_descricao_completa}}</p>
    {{#if parcelas_datas_vencimento}}
    <p class="clausula-texto" style="margin-top: 10px;"><strong>Datas de vencimento:</strong> {{parcelas_datas_vencimento}}</p>
    {{/if}}
  </div>
</div>',
  '<div class="clausula">
  <p class="clausula-titulo">Cláusula Quarta – Dos Honorários</p>
  <div class="honorarios-highlight">
    <p class="clausula-texto">
      A título de honorários advocatícios, o CONTRATANTE pagará ao CONTRATADO o valor de <strong>{{honorarios_descricao_completa}}</strong>, {{forma_pagamento_descricao}}.
    </p>
    {{#if parcelas_datas_vencimento}}
    <p class="clausula-texto" style="margin-top: 10px;"><strong>Cronograma de pagamento:</strong> {{parcelas_datas_vencimento}}</p>
    {{/if}}
    {{#if metodo_pagamento_descricao}}
    <p class="clausula-texto" style="margin-top: 10px;">{{metodo_pagamento_descricao}}.</p>
    {{/if}}
    {{#if percentual_exito_clausula}}
    <p class="clausula-texto" style="margin-top: 10px;">{{percentual_exito_clausula}}.</p>
    {{/if}}
  </div>
</div>'
)
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';