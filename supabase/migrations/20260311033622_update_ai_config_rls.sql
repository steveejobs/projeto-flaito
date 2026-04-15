-- Atualizar políticas de acesso da tabela ai_config para permitir membros

DROP POLICY IF EXISTS "usuários podem criar/atualizar config de sua clínica" ON ai_config;

CREATE POLICY "usuários podem criar/atualizar config de sua clínica"
    ON ai_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM office_members
            WHERE office_members.office_id = ai_config.office_id
            AND office_members.user_id = auth.uid()
        )
    );
