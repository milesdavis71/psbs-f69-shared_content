# Hír létrehozása Front Matter pluginnel (gyors munkafolyamat)

Cél: a hír-létrehozás 4 kézi fájlműveletét megtartani, de gyorsítani a VS Code Front Matter (Front Matter CMS) pluginnel. A build rendszer (Gulp + Panini) és a `filterNews` helper érintetlen marad.

## Kapcsolódó fájlok

| Fájl | Szerep |
|------|--------|
| `frontmatter.config.json` | Front Matter beállítás (média mappa, snippetek, dataFiles, template) |
| `.frontmatter/templates/hir-uj.md` | Emlékeztető sablon a lépésekhez |
| `src/data/news-2026-27.yml` | Hírlista: bejegyzések (title, school, img, content: newsNN) |
| `src/content/common-news-content-2026-27.md` | Hír szövegei: `{{#ifequal hir "newsNN"}}` blokkok |
| `src/assets/img/hirfolyam/` | Hírképek |

## A meglévő konvenciók (FONTOS, ezeket betartani)

1. **A legújabb hír a YAML lista tetejére kerül** (a tanévi kulcs alatti első elem), a tartalom blokk viszont a `common-news-content-*.md` fájl VÉGÉRE.
2. **A `newsNN` számsorozat a frissesség szerint nő** (news06 > news05 …). Új hírnál a következő szabad szám kell (a max + 1).
3. A tartalom blokk kulcsa (`ifequal hir`) és a YAML `content` mezője **egymással azonos**.
4. Képi/kicsúsztatás konvenció: `imgclass: medium-3` + `contentclass: medium-9` (vagy szélesebb tartalomnál `medium-2`/`medium-10`).

## Lépések

### 1) Kép feltöltése
A Front Matter oldalpanel **Media** fülén a "Hírképek (hirfolyam)" mappába feltölteni, vagy kézzel `src/assets/img/hirfolyam/` mappába. (Ha nagy képet teszel be, előtte/utána futtasd: `python .\resizer.py`.)

### 2) YAML bejegyzés
- Nyisd meg `src/data/news-2026-27.yml`-t (Dashboard → Data Files → "Hírek 2026/2027").
- A `2026-27:` kulcs alatti első elem elé szúrd be a bejegyzést.
- Insert Snippet parancs (`Ctrl+Shift+P` → *Front Matter: Insert Snippet*) → **"HIR - YAML bejegyzés (news-*.yml)"**.
- A megjelenő űrlapon:
  - `site`: `ps` / `bs` / `common`
  - `title`: a hír címe (a YAML-ben kettős idézőjelbe kerül)
  - `school`: Székhely / Tagiskola / Common
  - `img`: a feltöltött kép neve (pl. `ujsulinap.jpg`)
  - `imgclass`, `contentclass`: alap `medium-3` / `medium-9`
  - `content`: **newsNN** (a következő szabad szám!)

### 3) Tartalom blokk
- Nyisd meg `src/content/common-news-content-2026-27.md`-t (Dashboard → Data Files → "Hír tartalmak 2026/2027").
- A fájl VÉGÉRE szúrd be: Insert Snippet → **"HIR - Tartalom blokk (common-news-content-*.md)"**.
- TAB-bal léphetsz a mezők között:
  - `$1` → a `newsNN` kulcs
  - `$2` → a hír szövege (Markdown vagy HTML is lehet, pl. `<br>`, `<a href="{{root}}...">`)

### 4) Ellenőrzés
- `npm run ps` / `npm run bs` → build indul (és figyeli a fájlokat).
- A főoldalon a hírfolyam tetején megjelenik az új hír.

## Miért nem készít Front Matter "cikket" a plugin?

A jelenlegi hírrendszer **egy tartalmi fájlba** gyűjti a híreket (ifequal blokkokkal), nem fájlonkénti markdown rendszer. Ezért a Front Matter "Create article" helyett **snippets + templates** módszert használunk, ami betartja a meglévő rendszer konvencióit, és nem bontja meg a `filterNews` helper logikáját.

## Snippet list

| Név | Fájlba | Használat |
|-----|--------|-----------|
| `HIR - YAML bejegyzés (news-*.yml)` | `src/data/news-2026-27.yml` | Űrlapos kitöltés |
| `HIR - Tartalom blokk (common-news-content-*.md)` | `src/content/common-news-content-2026-27.md` | TAB-bal kitöltés |
| `HIR - Táblázat sor (opció a tartalom blokkba)` | tartalom blokkba | Időpontlisták |
