-- Reafirma a lista autorizada de administradores sem duplicar registros.
insert into public.admin_emails (email)
values ('rodrigobarista.amador@gmail.com'), ('vicgarrido10@gmail.com')
on conflict (email) do nothing;
