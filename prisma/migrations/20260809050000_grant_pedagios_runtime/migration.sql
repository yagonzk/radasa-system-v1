-- Replica para a tabela de pedágios as permissões DML já usadas pelo sistema.
-- Deve ser aplicada com credenciais administrativas/owner do PostgreSQL.
DO $$
DECLARE
  target_role TEXT;
BEGIN
  -- Garante acesso ao dono da tabela users (uma tabela central já utilizada pela aplicação).
  SELECT pg_get_userbyid(c.relowner)
    INTO target_role
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'users'
     AND c.relkind IN ('r', 'p')
   LIMIT 1;

  IF target_role IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedagios TO %I',
      target_role
    );
  END IF;

  -- Copia também os GRANTs explícitos existentes em public.users.
  FOR target_role IN
    SELECT DISTINCT grantee
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       AND grantee <> 'PUBLIC'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedagios TO %I',
      target_role
    );
  END LOOP;
END $$;
