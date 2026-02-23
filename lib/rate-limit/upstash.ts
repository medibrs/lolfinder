import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis instance
const redis = Redis.fromEnv();

// Create a sliding window ratelimiter (5 requests per 1 minute)
export const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "lolfinder_ratelimit",
});
