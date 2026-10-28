-- Solo LEE. Pégalo en Supabase → SQL Editor → Run. Cada fila debe decir true.
select '0008 "soy yo" (recuperar cuenta por curso + nombre)' as migracion,
       coalesce((select pg_get_functiondef(p.oid) ilike '%lower(first_name)%'
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'register_student' limit 1), false) as aplicada
union all
select '0012 divisiones largas (columnas de región)',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'region_games' and column_name = 'difficulty_min')
union all
select '0012 preguntas de dificultad 4-6 cargadas',
       exists (select 1 from public.questions where difficulty >= 4)
union all
select '0009-0011 (regiones en orden)',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'get_student_level_detail');
