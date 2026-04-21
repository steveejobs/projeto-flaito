# IMPLEMENTATION PLAN: Document Template Engine

**Status**: Planning Phase (Pending Approval)  
**Objective**: Build a robust, version-controlled, and variable-driven Document Template Engine tailored for Legal and Medical workflows.

This plan integrates the 10 mandatory additions required for a professional-grade document automation experience.

---

## 1. Template Versioning and Rollback (State Machine)
Templates will not be simple mutable rows. They will follow an immutable versioning pattern to ensure historical generated documents always reflect the exact template structure used at the time of generation.

**Schema Additions (`document_templates` & `template_versions`):**
- `id` (UUID)
- `office_id` (UUID, null for system-wide)
- `current_version` (Integer)
- `published_at` (Timestamptz)
- `status` (Enum: 'draft', 'published', 'archived')
- `change_history` (JSONB - commit log of changes)

*Note:* Every time a generated document is created, it will store the `template_version` explicitly.

## 2. Canonical Variable Syntax
To prevent parsing nightmares and UI confusion, the platform will enforce **one consistent placeholder model**:
- **Format**: `{{variable_key}}` (e.g., `{{client.full_name}}`, `{{case.cnj_number}}`, `{{office.name}}`).
- We will strictly reject mixed formats like `{var}` or `[var]`. The parser will be regex-locked to `\{\{([a-zA-Z0-9_.]+)\}\}`.

## 3. Expanded Variable Metadata Model
Variables will be strongly typed entities, allowing the UI to render dynamic forms (auto-filling what it knows, prompting the user for the rest).

**Schema Additions (`template_variables`):**
- `key`: (String) e.g., `client.cpf`
- `label`: (String) e.g., "CPF do Cliente"
- `type`: (Enum: 'text', 'date', 'currency', 'long_text', 'boolean')
- `source_type`: (Enum: 'system', 'custom')
- `required`: (Boolean)
- `default_value`: (String/Null)
- `vertical`: (Enum: 'LEGAL', 'MEDICAL', 'BOTH')
- `category`: (String) e.g., 'Dados Pessoais', 'Processo'
- `help_text`: (String) e.g., "Formato: 000.000.000-00"
- `is_active`: (Boolean)

## 4. Office-Side Customization (In-Product UI)
The `DocumentTypes` / `Modelos` UI will be transformed into a full **Template Studio**.

**Required UI Features:**
- **Editor**: WYSIWYG editor (Rich Text) with in-product template creation/editing.
- **Variable Picker**: A sidebar or slash-command dropdown to easily inject variables (`{{...}}`) into the text.
- **Custom Variables**: Ability for offices to create bespoke variables (e.g., `{{custom.medical_history}}`).
- **Actions**: Duplicate existing template, Activate/Deactivate.
- **Live Preview**: Real-time rendering of the template with mock/sandbox data.

## 5. Output Standards & Aesthetics
Generated documents must look like they came from a premium law firm or high-end clinic.

**Output Capabilities:**
- **Preview HTML**: Safe, sanitized on-screen rendering.
- **Institutional Branding**: Support for dynamic injection of `{{office.header}}`, `{{office.footer}}`, and `{{office.signature}}`.
- **Print-Ready Layout**: CSS `@media print` rules for perfect A4 pagination, margins, and page breaks.
- **Export**: PDF export (via `window.print` or server-side headless browser) and DOCX export (via `docxtemplater` or similar library).

## 6. Generated Document Metadata Tracking
Documents are not just static text; they are auditable assets.

**Schema Additions (`generated_documents`):**
- `template_id` (UUID)
- `template_version` (Integer)
- `office_id` (UUID)
- `user_id` (UUID - creator)
- `client_id` (UUID - linked entity)
- `case_id` / `patient_id` (UUID - linked entity)
- `vertical` (Enum: 'LEGAL', 'MEDICAL')
- `used_variables` (JSONB - snapshot of the exact values injected at generation time)
- `generation_mode` (Enum: 'system', 'manual', 'ai-assisted')

## 7. Permissions & Governance Rules
Strict RBAC (Role-Based Access Control) will be enforced at the database (RLS) and UI levels:
- **OWNER / ADMIN**: Can create, edit, publish, override system templates, and deactivate templates. Can create custom variables.
- **MEMBER**: Can view published templates, fill variables, and generate documents. Cannot edit the base template structure.
- **System Templates**: Cannot be overwritten. Editing a system template automatically creates an "Office Override" clone.

## 8. Professional Starter Catalog (Seed)
The system will not start empty. We will seed a robust, professional catalog via `supabase/seed.sql` or a migration.

**Legal Starter Pack:**
- Procuração Ad Judicia (Completa)
- Contrato de Honorários Advocatícios
- Declaração de Hipossuficiência
- Notificação Extrajudicial Padrão

**Medical Starter Pack:**
- Termo de Consentimento Livre e Esclarecido (TCLE)
- Atestado Médico Padrão
- Receituário Simples
- Receituário Controle Especial

## 9. Roadmap for Advanced Features (Blocks & Logic)
To maintain velocity, advanced logic will be phased. The UI will mark these features explicitly to set user expectations.

**Phase 1 (Current Scope):**
- Flat variable replacement (`{{var}}`).
- Versioning, Export, and RBAC.

**Phase 2 (Mandatory Next Step - Marked in UI):**
- **Conditional Blocks**: `{{#if client.is_married}} ... {{/if}}`.
- **Loops/Lists**: `{{#each cases}} ... {{/each}}`.
- **Calculations**: Date math, currency spelling (e.g., "mil reais").

## 10. Comprehensive Validation Plan
Validation will not just test if `{{name}}` turns into "John". It will test operational readiness.

**Validation Scenarios:**
1. **The Versioning Test**: Edit a published template. Generate a document. Verify the old generated document still shows version 1, and the new one shows version 2.
2. **The Override Test**: Take the system "Procuração", edit it as an Office Admin. Verify other offices still see the default, and this office sees their custom version.
3. **The Audit Test**: Generate a contract. Inspect the `used_variables` JSONB payload in the database to ensure the exact state of the client at that moment was captured.
4. **The Real-World Output Test**: Export a generated document to PDF. Verify A4 margins, office header/footer presence, and professional typography.
5. **The Governance Test**: Attempt to edit a template while logged in as a `MEMBER`. The UI must block the action, and the backend RLS must reject the API call.

---
**END OF PLAN**