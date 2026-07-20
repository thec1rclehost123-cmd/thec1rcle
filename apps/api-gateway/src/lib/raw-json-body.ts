export function parseRawJsonBody(body: Buffer): { rawBody: string; parsedBody: unknown } {
  const rawBody = body.toString('utf8');
  return {
    rawBody,
    parsedBody: rawBody.trim() === '' ? {} : JSON.parse(rawBody),
  };
}
