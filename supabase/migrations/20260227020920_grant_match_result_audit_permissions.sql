-- Fix permission denied error when updating matches
GRANT ALL ON TABLE public.match_result_audit TO service_role;
GRANT ALL ON TABLE public.match_result_audit TO postgres;
GRANT ALL ON TABLE public.match_result_audit TO authenticated;
GRANT ALL ON TABLE public.match_result_audit TO anon;
