-- Chart stars and mastery are updated in parallel by the application. Keep
-- each field monotone and independent so concurrent requests cannot erase the
-- other field's evidence.

create or replace function public.set_chart_best(p_chart_id text, p_stars integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_stars < 0 or p_stars > 3 then
    raise exception 'Stars must be between 0 and 3';
  end if;

  insert into public.chart_progress (user_id, chart_id, best_stars, mastery_star)
  values (auth.uid(), p_chart_id, p_stars, false)
  on conflict (user_id, chart_id) do update
  set best_stars = greatest(public.chart_progress.best_stars, excluded.best_stars);
end;
$$;

create or replace function public.set_chart_mastery(p_chart_id text, p_mastery_star boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.chart_progress (user_id, chart_id, best_stars, mastery_star)
  values (auth.uid(), p_chart_id, 0, p_mastery_star)
  on conflict (user_id, chart_id) do update
  set mastery_star = public.chart_progress.mastery_star or excluded.mastery_star;
end;
$$;

revoke all on function public.set_chart_best(text, integer) from public;
revoke all on function public.set_chart_mastery(text, boolean) from public;
grant execute on function public.set_chart_best(text, integer) to authenticated;
grant execute on function public.set_chart_mastery(text, boolean) to authenticated;
