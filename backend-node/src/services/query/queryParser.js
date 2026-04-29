/**
 * Parses a natural language query to determine search intent.
 */
export function parseQueryIntent(query) {
  const normalized = query.toLowerCase();

  const intent = {
    original: query,
    hasKeywordSearch: true, // Always default to ES
    hasGraphSearch: false,
    hasSemanticSearch: true, // Always default to Chroma
    hasStructuredFilter: false,
    entities: [],
    filters: {}
  };

  // 1. Detect Graph Intent (Relationships)
  if (normalized.includes('between') || normalized.includes('connected') || normalized.includes('related to')) {
    intent.hasGraphSearch = true;
  }

  // 2. Detect Structured Filters (dates, types)
  if (normalized.includes('message') || normalized.includes('chat') || normalized.includes('call')) {
    intent.hasStructuredFilter = true;
    intent.filters.type = normalized.includes('call') ? 'call' : 'message';
  }

  // 3. Extract potential phone numbers (simple regex)
  const phoneMatch = normalized.match(/\+?[0-9]{10,15}/g);
  if (phoneMatch) {
    intent.entities.push(...phoneMatch);
    intent.hasGraphSearch = true;
  }

  return intent;
}
