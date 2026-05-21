# Context

## Glossary

- structured JSON response: a single top-level JSON value that is meant to be consumed by `JSON.parse` without surrounding prose.
- strict JSON protocol: a model response path where the caller requires exactly one structured JSON value and treats format drift as a recoverable failure.
- repair retry: a second attempt after a structured JSON parse failure, using the invalid output as context and asking for a corrected JSON-only response.
- visual self-review: an agent review pass whose goal is to assess rendered slide quality from the screenshot, with rendered HTML available as supporting context.
- HTML fallback: a fallback review path that uses rendered HTML when direct image analysis is unavailable or inconclusive, without changing the review's visual purpose.
