-- Sender name confirmed on a real phone (2026-10-12): TikTok PayLater texts come from "TikTok".
-- No reader yet, so these land as failed with their text kept, ready for a parser to be written against them.

update public.institutions set sms_senders = '{TikTok}' where slug = 'tiktok-shop' and user_id is null;
