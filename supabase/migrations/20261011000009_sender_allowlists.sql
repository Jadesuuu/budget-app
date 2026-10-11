-- Sender allowlists from real (redacted) samples in fixtures/. Email: sender domains (subdomains match too).
-- SMS: sender IDs as shown on the phone; "GCash" and "BPI" are assumed until seen on a real phone.
-- Apps: Android package names. Viber business chats match by chat name against sms_senders.

update public.institutions set
  email_domains = '{gcash.com}',
  sms_senders = '{GCash}',
  app_packages = '{com.globe.gcash.android}'
where slug = 'gcash' and user_id is null;

update public.institutions set
  email_domains = '{bpi.com.ph}',
  sms_senders = '{BPI}'
where slug = 'bpi' and user_id is null;

-- Atome also sends TikTok PayLater emails.
update public.institutions set email_domains = '{atome.ph}' where slug = 'atome' and user_id is null;

update public.institutions set email_domains = '{eastwestbanker.com}' where slug = 'eastwest' and user_id is null;
