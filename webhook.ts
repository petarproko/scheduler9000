interface WebhookSubscriber {
  url: string;
}

export const webHookSubscribers: WebhookSubscriber[] = [];

export const dispatchWebhooks = async (event: string, data: unknown): Promise<void> => {
  const body = JSON.stringify({ event, data, sent_at: new Date().toISOString() });

  webHookSubscribers.forEach(async (sub) => {
    try {
      await fetch(sub.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (err) {
      console.error(`Webhook delivery to ${sub.url} failed:`, err);
    }
  });
};
