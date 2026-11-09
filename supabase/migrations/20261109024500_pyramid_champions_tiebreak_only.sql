-- The deciding third set is always a Champions-Tie-Break: first to at least
-- ten points with a two-point margin.
create or replace function private.pyramid_valid_winning_score(p_score text) returns boolean
 language plpgsql immutable set search_path = '' as $$
declare v_set text; v_parts text[]; v_a integer; v_b integer;
        v_count integer:=0; v_wins_a integer:=0; v_wins_b integer:=0;
begin
 if p_score is null or p_score !~ '^[0-9]{1,2}:[0-9]{1,2}(, ?[0-9]{1,2}:[0-9]{1,2}){1,2}$' then return false; end if;
 for v_set in select regexp_split_to_table(p_score, ',\s*') loop
   v_count:=v_count+1; v_parts:=string_to_array(v_set,':');
   v_a:=v_parts[1]::integer; v_b:=v_parts[2]::integer;
   if v_count<=2 then
     if not ((greatest(v_a,v_b)=6 and least(v_a,v_b)<=4)
       or (greatest(v_a,v_b)=7 and least(v_a,v_b) in (5,6))) then return false; end if;
   elsif greatest(v_a,v_b)<10 or abs(v_a-v_b)<2 then return false;
   end if;
   if v_a>v_b then v_wins_a:=v_wins_a+1; else v_wins_b:=v_wins_b+1; end if;
 end loop;
 return (v_count=2 and v_wins_a=2 and v_wins_b=0)
    or (v_count=3 and v_wins_a=2 and v_wins_b=1);
end;
$$;
revoke all on function private.pyramid_valid_winning_score(text) from public,anon,authenticated;
