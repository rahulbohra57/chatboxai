/**
 * Strips HTML tags and normalizes whitespace from user-provided message body.
 * Used before inserting messages into the database.
 */
export function sanitizeMessage(body: string): string {
  return body
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim()
}
