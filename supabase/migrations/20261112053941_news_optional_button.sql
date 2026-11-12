alter table public.news
  add column button_label text,
  add column button_url text;

alter table public.news add constraint news_button_valid check (
  (button_label is null and button_url is null)
  or (
    button_label is not null and button_url is not null
    and length(btrim(button_label)) between 1 and 80
    and length(button_url) between 1 and 2048
    and button_url !~ '[[:space:]]'
    and position(chr(92) in button_url) = 0
    and (button_url ~ '^/[^/]' or button_url = '/' or button_url ~* '^https?://[^/@[:space:]]+([/:?#]|$)')
  )
);
comment on column public.news.button_label is 'Optional action button label, paired with button_url.';
comment on column public.news.button_url is 'Optional HTTP(S) URL or root-relative path. Existing news RLS applies.';

update public.news set button_label='Hallenplätze suchen', button_url='https://www.tennis-tsvfeldkirchen.de/hallenplaetze/' where slug='hallenplaetze-in-der-naehe';
update public.news set button_label='Zur Forderungspyramide', button_url='/forderungspyramide/' where slug='forderungspyramide-sommer-2027';
