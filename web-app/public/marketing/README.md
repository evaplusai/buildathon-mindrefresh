# Marketing Image Assets

Provenance: Designer hand-off, sourced from `docs/03_designs/MindRefreshStudio v2.html`.

These files were moved (not copied) from `docs/03_designs/images/` to this directory
per ADR-014. Vite serves `public/` at the root path; use `<img src="/marketing/<filename>">`.

## Files

| File | Dimensions (px) | Intended use |
|---|---|---|
| `room-notices-v4.png` | 554 × 836 | Hero section — room/sensor ambient shot (right column) |
| `01-late-night-clean.png` | 1200 × 1500 | Hero slideshow — slide 1 "Late night" |
| `02-the-shift-clean.png` | 1200 × 1500 | Hero slideshow — slide 2 "The shift" |
| `03-recovery-mode-clean.png` | 1200 × 1500 | Hero slideshow — slide 3 "Recovery mode" |

## Notes

- File names are preserved verbatim so a future designer re-export can replace files in-place without code edits.
- No image optimisation pipeline (sharp/WebP/AVIF) for V1. See ADR-014 for the amendment trigger.
- `docs/03_designs/MindRefreshStudio v2.html` references these images at relative path `images/...`; those references are intentionally left unedited (the design HTML is a reference artefact, not a running page). A note in `docs/03_designs/README.md` records this.
