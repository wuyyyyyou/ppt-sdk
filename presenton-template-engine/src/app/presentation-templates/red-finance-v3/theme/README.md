# red-finance-v3 theme tokens

`token.default.json` is the template default theme. Workspace forks initialize `token.json` from it, and rendering reads `token.json` first with fallback to `token.default.json`.

## Color tokens

- `canvas`: full slide background.
- `surface`: primary content surface.
- `panel`: elevated panel background.
- `card`: repeated card background.
- `textPrimary`: main body and heading text.
- `textSecondary`: secondary text on normal surfaces.
- `textMuted`: labels, captions, and less prominent copy.
- `textSubtle`: axes, footers, and low-emphasis metadata.
- `textInverse`: text on light or accent-filled elements when needed.
- `accent`: primary emphasis color.
- `accentText`: text on `accent`.
- `accentStrong`: stronger accent for bars, rules, and active states.
- `accentSoft`: soft accent fill for highlighted cards or icon wells.
- `accentTint`: low-contrast accent background.
- `accentBorder`: accent border and separators.
- `accentMutedText`: readable text on accent-tinted backgrounds.
- `stroke`: standard borders and chart grid lines.
- `strokeSoft`: softer separators and inactive tracks.
- `axis`: chart axes.
- `iconMuted`: inactive or secondary icon strokes.
- `rowAccent`: table or matrix row highlight.
- `chart1` through `chart6`: default chart series colors.

## Shadow tokens

- `card`: shadow for normal cards.
- `panel`: shadow for larger panels.
- `accent`: shadow for accent-filled highlights.
