-- {"Cidade, Estado": [lat, lon]} for the cities in `city`, geocoded once and reused across syncs.
alter table public.instagram_audience_snapshots add column city_geo jsonb;
