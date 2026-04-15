# ARTIFACT: Plano de Restauração de Banco — Fase 1

**Projeto:** Flaito/Lexos
**Supabase Project ID:** ccvbosbjtlxewqybvwqj
**Data:** 2026-04-06
**Arquivos SQL:** `supabase/restoration/01_bloco_c_sessao.sql` → `06_bloco_f_auxiliares.sql`

---

## 1. Executive Summary

6 blocos SQL isolados, cada um com `BEGIN;`/`COMMIT;`, validação técnica e rollback.
Ordem de execução: **C → B → A → D → E → F**.
Cada bloco leva 5-30s. Se qualquer bloco falhar, **PARAR** e executar rollback.

---

## 2. Ordem Final de Execução

| # | Bloco | Arquivo | Objetos | Tempo est. |
|---|-------|---------|---------|------------|
| 1 | C — Sessão | `01_bloco_c_sessao.sql` | 2 RPCs | 10s |
| 2 | B — Convites | `02_bloco_b_convites.sql` | 2 RPCs | 10s |
| 3 | A — FSM | `03_bloco_a_fsm.sql` | 3 tabelas + 2 views + 2 RPCs | 30s |
| 4 | D — Templates | `04_bloco_d_templates.sql` | 1 view + 2 RPCs | 10s |
| 5 | E — Agenda | `05_bloco_e_agenda.sql` | 1 RPC | 5s |
| 6 | F — Auxiliares | `06_bloco_f_auxiliares.sql` | 2 tabelas | 10s |

---

## 3. Instruções de Execução

### Onde executar
1. Acesse `https://supabase.com/dashboard/project/ccvbosbjtlxewqybvwqj`
2. Clique em **SQL Editor** no menu lateral
3. Clique em **New query**
4. Cole o conteúdo do bloco correspondente
5. Clique em **Run** (ou Ctrl+Enter)

### Regra de ouro
- Execute **UM bloco por vez**
- Valide antes de avançar
- Se falhar → rollback → pare → registre o erro

---

## 4. Bloco C — Sessão

### SQL
Abrir: `supabase/restoration/01_bloco_c_sessao.sql`

### Validação técnica
```sql
SELECT * FROM lexos_healthcheck_session();
-- Esperado: 0 ou 1 linha com (office_id, user_id, role)

SELECT ensure_personal_office();
-- Esperado: 1 uuid
```

### Validação funcional
- Fazer login no app (`/login`)
- Acessar `/dashboard` — não deve crashar
- Acessar `/meu-escritorio` — deve carregar sem erro

### Critério "pode seguir"
- `lexos_healthcheck_session()` retorna sem erro
- `ensure_personal_office()` retorna uuid
- Dashboard carrega sem erro no console do browser

---

## 5. Bloco B — Convites

### SQL
Abrir: `supabase/restoration/02_bloco_b_convites.sql`

### Validação técnica
```sql
SELECT * FROM get_office_invite_public('token-teste');
-- Esperado: 0 linhas (token inexistente)

SELECT accept_office_invite('token-teste');
-- Esperado: {"success": false, "error": "Convite inválido ou expirado"}
```

### Validação funcional
- Acessar `/signup` — deve carregar sem erro
- Acessar `/convite/abc123` — deve mostrar "convite inválido" (não crashar)

### Critério "pode seguir"
- Ambas as RPCs executam sem erro de sintaxe
- Página de signup carrega

---

## 6. Bloco A — FSM

### SQL
Abrir: `supabase/restoration/03_bloco_a_fsm.sql`

### Validação técnica
```sql
-- Deve retornar 9 estados
SELECT code, name FROM lexos_case_states ORDER BY sort_order;

-- Deve estar vazio
SELECT COUNT(*) FROM lexos_case_state_history;
SELECT COUNT(*) FROM lexos_case_notifications;

-- Views devem existir
SELECT * FROM vw_case_current_state LIMIT 1;
SELECT * FROM vw_case_state_timeline LIMIT 1;

-- RPC deve retornar estados não-terminais
SELECT * FROM lexos_next_states_for_case('00000000-0000-0000-0000-000000000000');
```

### Validação funcional
- Acessar `/cases` — lista de casos deve carregar
- Acessar `/dashboard` — kanban/tabela de casos sem crash
- O estado dos casos pode aparecer como "sem estado" (normal — sem histórico)

### Critério "pode seguir"
- 9 estados seed existem
- Views retornam sem erro (mesmo sem dados)
- RPC `lexos_next_states_for_case` retorna lista de estados
- Página de cases carrega

---

## 7. Bloco D — Templates / Documentos

### SQL
Abrir: `supabase/restoration/04_bloco_d_templates.sql`

### Validação técnica
```sql
SELECT * FROM vw_client_signatures LIMIT 1;
-- Esperado: 0 ou mais linhas
```

### Validação funcional
- Acessar `/documents` — deve carregar sem erro
- Acessar `/clientes` — deve carregar sem erro

### Critério "pode seguir"
- View `vw_client_signatures` existe e consulta sem erro
- Página de documents carrega

---

## 8. Bloco E — Agenda

### SQL
Abrir: `supabase/restoration/05_bloco_e_agenda.sql`

### Validação técnica
```sql
SELECT get_agenda_month_bundle('00000000-0000-0000-0000-000000000000', 2026, 4);
-- Esperado: {"events": [], "year": 2026, "month": 4}
```

### Validação funcional
- Acessar `/agenda` — deve carregar sem erro

### Critério "pode seguir"
- RPC retorna jsonb válido
- Página de agenda carrega

---

## 9. Bloco F — Auxiliares

### SQL
Abrir: `supabase/restoration/06_bloco_f_auxiliares.sql`

### Validação técnica
```sql
SELECT COUNT(*) FROM delegacias;
SELECT COUNT(*) FROM assistant_suggestions;
-- Esperado: 0 para ambas
```

### Validação funcional
- O app não deve crashar em nenhuma tela
- Lookups de delegacia (se usados) não causam erro 404

### Critério "pode seguir"
- Ambas as tabelas existem
- `tsc --noEmit` passa sem erros

---

## 10. Rollback por Bloco

Cada arquivo SQL contém o rollback comentado no final. Para executar:
1. Descomentar as linhas `DROP ...`
2. Executar no SQL Editor

| Bloco | Rollback |
|-------|----------|
| C | `DROP FUNCTION lexos_healthcheck_session(); DROP FUNCTION ensure_personal_office();` |
| B | `DROP FUNCTION get_office_invite_public(text); DROP FUNCTION accept_office_invite(text);` |
| A | DROP na ordem inversa: functions → views → tables (cascade) |
| D | `DROP FUNCTION hard_delete_client; DROP FUNCTION render_template_preview; DROP VIEW vw_client_signatures;` |
| E | `DROP FUNCTION get_agenda_month_bundle;` |
| F | `DROP TABLE assistant_suggestions; DROP TABLE delegacias;` |

---

## 11. Protocolo de Parada

**SE** qualquer bloco retornar erro de execução:
1. **NÃO** avançar para o próximo bloco
2. Executar o rollback do bloco atual (linhas comentadas no final do arquivo)
3. Copiar a mensagem de erro exata
4. Registrar: bloco, erro, hipótese de causa
5. Aguardar correção antes de retomar

**Erros esperados (não bloqueantes):**
- `relation "public.cases" does not exist` → FK falhou → verificar se tabela `cases` existe
- `permission denied` → RLS bloqueando → verificar se usuário tem permissão
- `function already exists` → já criado → ignorar (é idempotente com `OR REPLACE`)

**Erros bloqueantes:**
- Qualquer erro de sintaxe SQL
- Falha de conexão com o banco
- Timeout > 30s

---

## 12. Checklist Final

Após executar todos os 6 blocos:

- [ ] Bloco C: `lexos_healthcheck_session()` funciona
- [ ] Bloco C: `ensure_personal_office()` funciona
- [ ] Bloco B: `get_office_invite_public()` funciona
- [ ] Bloco B: `accept_office_invite()` funciona
- [ ] Bloco A: 9 estados seed existem
- [ ] Bloco A: `vw_case_current_state` funciona
- [ ] Bloco A: `vw_case_state_timeline` funciona
- [ ] Bloco A: `lexos_next_states_for_case()` funciona
- [ ] Bloco A: `lexos_transition_case_state()` existe
- [ ] Bloco D: `vw_client_signatures` funciona
- [ ] Bloco D: `render_template_preview()` funciona
- [ ] Bloco D: `hard_delete_client()` funciona
- [ ] Bloco E: `get_agenda_month_bundle()` funciona
- [ ] Bloco F: tabela `delegacias` existe
- [ ] Bloco F: tabela `assistant_suggestions` existe
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] /cases carrega
- [ ] /clientes carrega
- [ ] /documents carrega
- [ ] /agenda carrega
- [ ] /signup carrega
- [ ] `npx tsc --noEmit` passa

---

## 13. Pós-Execução

Após todos os blocos aplicados com sucesso:

1. **Regenerar tipos TypeScript:**
   ```bash
   npx supabase gen types typescript --project-id ccvbosbjtlxewqybvwqj --schema public > src/integrations/supabase/types.ts
   ```

2. **Verificar compilação:**
   ```bash
   npx tsc --noEmit
   ```

3. **Remover `as any` do caseState.ts** (agora os tipos estarão corretos)

4. **Commit das mudanças**
