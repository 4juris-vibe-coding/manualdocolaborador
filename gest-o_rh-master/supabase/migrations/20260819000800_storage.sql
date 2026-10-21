-- Buckets de Storage: fotos de colaborador (privado, RLS por departamento)
-- e branding da empresa (público, só leitura da logo).

insert into storage.buckets (id, name, public)
values ('colaboradores', 'colaboradores', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Caminho dos objetos do bucket "colaboradores": {colaborador_id}/foto.<ext>
create policy "fotos_select" on storage.objects
  for select using (
    bucket_id = 'colaboradores' and (
      is_admin()
      or (storage.foldername(name)) [1]::uuid in (
        select id from colaboradores
        where departamento_id in (select managed_department_ids())
      )
    )
  );

create policy "fotos_write_admin" on storage.objects
  for insert with check (bucket_id = 'colaboradores' and is_admin());

create policy "fotos_update_admin" on storage.objects
  for update using (bucket_id = 'colaboradores' and is_admin());

create policy "fotos_delete_admin" on storage.objects
  for delete using (bucket_id = 'colaboradores' and is_admin());

-- Branding: bucket público (leitura via URL pública não passa por RLS);
-- só escrita precisa de policy.
create policy "branding_write_admin" on storage.objects
  for insert with check (bucket_id = 'branding' and is_admin());

create policy "branding_update_admin" on storage.objects
  for update using (bucket_id = 'branding' and is_admin());

create policy "branding_delete_admin" on storage.objects
  for delete using (bucket_id = 'branding' and is_admin());
