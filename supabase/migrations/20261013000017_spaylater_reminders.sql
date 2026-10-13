-- SPayLater due-date reminders (sender confirmed from a real email, 2026-10-13) come from
-- notification@mail.monee.com.ph and state only the due date, so a bill's amount can be unknown
-- until a later message or the user fills it in.

update public.institutions set email_domains = '{monee.com.ph}' where slug = 'spaylater' and user_id is null;

alter table public.statements alter column statement_balance_centavos drop not null;
