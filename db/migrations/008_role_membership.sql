-- 008_role_membership.sql — let the migration/app role SET ROLE to the
-- consent-bound test roles. Needed on Supabase, where postgres is not a
-- superuser; local superusers already bypass this. Idempotent grants.
do $$ begin
  execute format('grant jisr_app to %I', current_user);
  execute format('grant jisr_employer to %I', current_user);
end $$;