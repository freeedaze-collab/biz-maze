-- 1) profiles のカラム一覧（region が無いかを確認）
select attname as column_name, atttypid::regtype as data_type
from pg_attribute
where attrelid = 'public.profiles'::regclass
  and attnum > 0 and not attisdropped
order by attnum;

-- 2) profiles にぶら下がるトリガ一覧
select t.tgname as trigger_name,
       t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
where t.tgrelid = 'public.profiles'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 3) トリガで呼ばれる関数の本体（region を参照していないかチェック）
--   ※ 関数名は上の結果の "EXECUTE FUNCTION schema.fn(...)" から拾ってください
--   まずは "profiles" を参照する関数候補を一括でサーチ
select n.nspname as schema,
       p.proname as function_name,
       pg_get_functiondef(p.oid) as function_ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where pg_get_functiondef(p.oid) ilike '%profiles%'
   or pg_get_functiondef(p.oid) ilike '% NEW.%'
   or pg_get_functiondef(p.oid) ilike '%region%';

-- 4) 生成列/DEFAULT に 'region' を参照していないか（計算列の有無）
select c.relname as table_name, a.attname as column_name, d.adsrc as default_expr
from pg_attrdef d
join pg_class c on c.oid = d.adrelid
join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
where c.relname = 'profiles'
  and d.adsrc ilike '%region%';

-- 5) ビュー/ルールで region を参照していないか（念のため）
select viewname, definition
from pg_views
where schemaname='public' and definition ilike '%region%'
order by viewname;
