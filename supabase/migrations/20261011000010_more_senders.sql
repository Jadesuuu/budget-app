-- Sender names confirmed on a real phone (2026-10-11).
-- SMS: "GCash", "BPI", "EASTWEST" (SOA reminders only). Atome texts from rotating numbers, which can't be
-- trusted as a sender, so Atome is allowed via its Viber business chat instead.
-- Viber business chats (matched by chat name against sms_senders): "Atome", "SLoan", "EastWest"; these send
-- loan and credit card due reminders.

update public.institutions set sms_senders = '{EASTWEST}' where slug = 'eastwest' and user_id is null;
update public.institutions set sms_senders = '{Atome}' where slug = 'atome' and user_id is null;

insert into public.institutions (user_id, slug, name, kind, sms_senders)
values (null, 'sloan', 'Shopee SLoan', 'other', '{SLoan}');
