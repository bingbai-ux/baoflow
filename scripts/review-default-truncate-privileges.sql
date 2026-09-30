-- PER-ACTION SECURITY APPROVAL REQUIRED. Not an automatically applied migration.
-- Run with an existing authorized owner/operator able to alter BOTH creator ACLs.
-- Do not grant membership, create credentials, or change service_role to run this.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '10s';
alter default privileges for role postgres in schema public
 revoke truncate on tables from public,anon,authenticated;
alter default privileges for role supabase_admin in schema public
 revoke truncate on tables from public,anon,authenticated;
-- Review result. This proposal always rolls back; commit needs separate approved execution.
select r.rolname as creator, x.grantee::regrole as grantee, x.privilege_type
from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
join pg_namespace n on n.oid=d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) x
where n.nspname='public' and d.defaclobjtype='r' and r.rolname in ('postgres','supabase_admin')
 and x.privilege_type='TRUNCATE' and (x.grantee=0 or x.grantee in ('anon'::regrole,'authenticated'::regrole));
rollback;
