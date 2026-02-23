-- Drop the separate rate limiting table, it's unnecessary because 
-- our rate limiting library will scan the metrics logs!

-- API Metrics and Logging Table (For Analytics & Statistics & Rate Limits)
CREATE TABLE public.api_metrics_logs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    endpoint character varying NOT NULL,
    method character varying NOT NULL,
    status_code integer NOT NULL,
    response_time_ms integer,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_metrics_logs_pkey PRIMARY KEY (id)
);

-- Index to quickly generate statistics for endpoints AND query rate limits
CREATE INDEX idx_api_metrics_logs_stats 
ON public.api_metrics_logs(endpoint, created_at);

-- Index to quickly query rate limits by IP or User
CREATE INDEX idx_api_metrics_logs_rate_limit 
ON public.api_metrics_logs(endpoint, user_id, ip_address, created_at);
