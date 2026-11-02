-- Store live regular-set tiebreak points independently from games result_text.
-- Keys '1' and '2' store [TSV points, opponent points], e.g. {"1":[8,6]}.
-- Existing match_encounters RLS and private.can_tick_match() remain unchanged.
-- Old historical 7:6 results need no backfill; points are unknown until entered.
alter table public.match_encounters
  add column if not exists tiebreak_points jsonb not null default '{}'::jsonb;

comment on column public.match_encounters.tiebreak_points is
  'Optional tie-break point scores for regular sets 1/2 (TSV : opponent), JSON arrays keyed 1/2. Not the third-set match tiebreak.';

alter table public.match_encounters
  add constraint match_encounters_tiebreak_points_object
  check (jsonb_typeof(tiebreak_points) = 'object'
    and (tiebreak_points - '1' - '2') = '{}'::jsonb);
