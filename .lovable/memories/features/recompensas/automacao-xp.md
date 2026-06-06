---
name: XP Automation
description: Automated XP from ranking, squads, video destaque, late task penalties
type: feature
---
Tabelas: xp_settings (singleton), xp_monthly_processing (year/month/criterion unique), xp_task_penalties (pm_task_id+user_id unique), xp_video_destaque (year/month unique).
Funções: xp_apply_monthly_rankings (1º=100, 2º=70 XP, tiebreak: pontuação→concluídas→menos atrasos), xp_apply_squad_destaque (média por squad, 60 XP), xp_apply_video_destaque (admin escolhe pm_task, distribui 60 XP por cargo elegível), xp_apply_task_late_penalties (-10 XP por pm_task atrasada, 1x).
Cron: diário 06:00 BRT (atrasos) + dia 1 00:05 BRT (mês anterior via xp_process_previous_month).
UI: Recompensas > Administração > Automação (config + vídeo destaque + execução manual).
Tudo grava em user_xp_events com source_type='auto_*'.
