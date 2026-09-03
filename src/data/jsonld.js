/**
 * Safe JSON-LD serialization for `set:html` script payloads (#22).
 *
 * Astro's `set:html` writes the string verbatim inside
 * `<script type="application/ld+json">`, and `JSON.stringify` does not escape the
 * less-than character. Every value serialized through here is repository-owned static
 * text today, so there is no present exploit path - but the sink would carry a
 * script-closing sequence the moment a data source changed, and nothing at the call site
 * would notice. Escaping `<` as a Unicode escape closes the sink itself.
 *
 * `\u003c` is a JSON escape for the same character, so a JSON parser decodes it back and
 * the structured data is unchanged: no copy changes, no rendered text changes.
 *
 * `>` and `&` are deliberately not escaped. Only `</script` can terminate the element, so
 * `<` is the character that matters; a script element's content is not HTML-entity
 * decoded, so escaping `&` would add noise without adding safety.
 */
export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
