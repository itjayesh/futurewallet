-- Settings: the user's language, and a safe way for a signed-in user to delete their own account.

alter table public.profiles
  add column if not exists language text not null default 'en'
  check (language in ('en', 'hinglish', 'hi'));

-- Deleting an auth user needs elevated rights, so this runs as the function owner
-- but can only ever remove the caller's own row. Every table cascades from auth.users.
create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
