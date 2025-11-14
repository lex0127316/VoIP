CREATE TABLE IF NOT EXISTS analytics_metrics_overview (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_calls INTEGER NOT NULL,
    concurrent_capacity INTEGER NOT NULL,
    avg_handle_time_seconds INTEGER NOT NULL,
    service_level DOUBLE PRECISION NOT NULL,
    abandoned_rate DOUBLE PRECISION NOT NULL
);

INSERT INTO analytics_metrics_overview (
    captured_at,
    active_calls,
    concurrent_capacity,
    avg_handle_time_seconds,
    service_level,
    abandoned_rate
)
VALUES (NOW(), 12, 48, 305, 0.92, 0.04)
ON CONFLICT DO NOTHING;

