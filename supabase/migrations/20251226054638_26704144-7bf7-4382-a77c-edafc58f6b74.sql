-- Desativar o cron de precedentes (job ID 13)
SELECT cron.unschedule(13);