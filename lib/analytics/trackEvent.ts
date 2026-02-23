export function trackEvent(
    eventName: string,
    properties: Record<string, any> = {},
    userId?: string
) {
    // In a real production app, this would send data to Mixpanel, PostHog, Amplitude, etc.
    // For now, it provides a stable wrapper for behavior logging.

    const eventPayload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        properties,
        userId: userId || 'anonymous',
    };

    // e.g. sendToMixpanel(eventPayload);

    if (process.env.NODE_ENV === 'development') {
        // console.log('[ANALYTICS] Event Tracked:', eventPayload);
    }
}
