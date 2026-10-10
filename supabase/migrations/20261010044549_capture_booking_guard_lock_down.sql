-- A trigger function must not be callable through /rest/v1/rpc
revoke execute on function public.capture_booking_guard() from public, anon, authenticated;
