# Hír létrehozása Front Matter pluginnel

Az aktuális tanév **2026-27**. A Front Matter Dashboard **Data** fülén a **Hírek 2026/2027 (aktuális tanév)** adatforrásban hozhatod létre és szerkesztheted a hírlista bejegyzéseit. A hír szövegét külön, a tanévi Markdown-fájlban kell megadni.

## Kapcsolódó fájlok

| Fájl | Szerep |
|------|--------|
| `frontmatter.json` | Adatűrlap sémája, média mappa és snippetek |
| `.frontmatter/templates/hir-uj.md` | Emlékeztető a lépésekhez |
| `src/data/news-2026-27.yml` | Hírlista: cím, iskola, kép, tartalomazonosító |
| `src/content/common-news-content-2026-27.md` | Hírszövegek: `{{#ifequal hir "newsNN"}}` blokkok |
| `src/assets/img/hirfolyam/` | Hírképek |
| `src/helpers/filterNews.js` | A megfelelő iskola híreinek kiválasztása |

## 1. Kép feltöltése

- `Ctrl+Shift+P` → `Front Matter: Open Dashboard` → **Media** fül → Hírképek (hirfolyam).
- Vagy másold a képet a `src/assets/img/hirfolyam/` mappába.
- Jegyezd meg a fájl nevét, például `ujhir.jpg`. Kép nélküli hírhez az `img` értéke `nincs`.

## 2. Új bejegyzés a Data fülön

1. Nyisd meg a **Data** fület, majd válaszd a **Hírek 2026/2027 (aktuális tanév)** adatforrást.
2. Új hírhez az üres hozzáadási űrlapot használd. Ha egy meglévő hírt választottál ki, előbb kattints az új bejegyzés hozzáadására vagy a **Cancel** gombra.
3. Töltsd ki a mezőket:

| Mező | Mit adj meg? |
|------|-------------|
| A hír címe | A megjelenő cím |
| Megjelenés (`site`) | `ps`: Petőfi / Székhely; `bs`: Bálint / Tagiskola; `common`: mindkettő |
| Képfájl (`img`) | Csak a fájlnév a hirfolyam mappából, vagy `nincs` |
| Tartalomazonosító (`content`) | A következő szabad `newsNN`, például `news07` |
| Kép igazítása | Általában `center` |
| Kép oszlopszélessége | Általában `medium-3` |
| Tartalom oszlopszélessége | Általában `medium-9` |

4. Kattints az **Add** gombra. Meglévő hír mentéséhez az **Update** gombot használd.
5. **Az új bejegyzést húzd a lista tetejére** a cím melletti mozgatófogantyúval. A Front Matter az új elemet a lista végére teszi; a honlap a YAML sorrendjét követi.

A `newsNN` a YAML-ben és a tartalomfájlban már szereplő legnagyobb szám + 1 legyen. A plugin a formátumot ellenőrzi, a szabad sorszámot nem választja ki helyetted. Ugyanezt az azonosítót kell használnod a következő lépésben is.

Az **Add** csak a hírlista bejegyzését menti. A hírszöveg létrehozásához folytasd a 3. lépéssel.

### Alternatíva: YAML snippet

Ha közvetlenül a fájlban dolgoznál:

1. Nyisd meg a `src/data/news-2026-27.yml` fájlt, és menj a legelejére (`Ctrl+Home`).
2. `Ctrl+Shift+P` → **Front Matter: Insert Snippet into your content** → **HIR - YAML bejegyzés (news-*.yml)**.
3. Töltsd ki a mezőket, majd szúrd be a bejegyzést a meglévő lista elé. Ezt a lépést ne végezd el újra, ha az adatűrlapon már hozzáadtad a hírt.

A fájl gyökerében közvetlenül lista található, **nincs `2026-27:` gyűjtőkulcs**. Példa:

```yaml
- site: ps
  title: Új hír címe
  img: ujhir.jpg
  align: center
  imgclass: medium-3
  contentclass: medium-9
  content: news07
```

A megjelenés helyét a `site` mező határozza meg. A régi bejegyzésekben megmaradt `school` és `id` mezőket nem kell kitöltened az új hírekhez. A korábbi tanévek `- ps:`, `- bs:` és `- common:` formátumát a hírszűrő továbbra is kezeli.

## 3. A hír szövege

1. Nyisd meg a `src/content/common-news-content-2026-27.md` fájlt, és menj a **végére** (`Ctrl+End`).
2. `Ctrl+Shift+P` → **Front Matter: Insert Snippet into your content** → **HIR - Tartalom blokk (common-news-content-*.md)**.
3. A `contentId` legyen az adatűrlapon megadott azonosító, például `news07`.
4. A `content` mezőbe írd a hír szövegét Markdown vagy HTML formátumban.
5. Az **Insert** gombbal szúrd be a blokkot, majd mentsd a fájlt.

Példa:

```handlebars
{{#ifequal hir "news07"}}

A hír szövege.

{{/ifequal}}
```

Táblázatos időpontlistákhoz használható a **HIR - Táblázat sor (időpontlistákhoz)** snippet is. A snippetek az aktív szerkesztő kurzorához szúrnak be; a célfájlt mindig neked kell megnyitnod.

## 4. Ellenőrzés

- `npm run ps` vagy `npm run bs`: előnézet és fájlfigyelés a kiválasztott iskolához.
- A hír a megfelelő iskola főoldalának tetején jelenjen meg; `common` esetén mindkettőn.
- Ellenőrizd a címet, a képet és a szöveget is.
- `npm run test:news`: a hírszűrés és a hírek tartalomkapcsolatainak automatikus ellenőrzése.

A **Content** fül „Create article” művelete önálló cikkfájlt készít, ezért ehhez a hírrendszerhez a **Data** űrlapot és a tartalomblokkot használd. Az emlékeztető sablon önmagában nem hoz létre hírt.

## Ha a dashboard hibaoldalon maradt

Zárd be a Front Matter Dashboard lapját, majd nyisd meg újra. Ha továbbra is a régi állapot látszik: `Ctrl+Shift+P` → **Developer: Reload Window**, majd újra **Data → Hírek 2026/2027**.

A korábbi összeomlás oka a `frontMatter.data.files` bejegyzéséből hiányzó `schema` volt. A naplóban ez jelent meg: `Cannot use 'in' operator to search for '$ref' in undefined`. A fájllistához `singleEntry: false` és az egyes hírek mezőit leíró objektumséma szükséges. Lásd a [Front Matter adatnézetének dokumentációját](https://frontmatter.codes/docs/dashboard/datafiles-view/).

## Tanévváltás és archiválás

Új hírt csak az aktuális tanévbe készítünk. A Data fülön csak ez a tanév szerepel; a korábbi évek fájljait archiválás után nem szerkesztjük.

Tanévváltáskor manuálisan:

1. Hozd létre az új `src/data/news-2027-28.yml` fájlt, kezdetben `[]` tartalommal (üres lista, tanévi gyűjtőkulcs nélkül), valamint a `src/content/common-news-content-2027-28.md` fájlt.
2. Mindkét főoldalon (`src/pages/ps/index.html`, `src/pages/bs/index.html`) frissítsd a `year`, `newsData` és `mdFile` hivatkozásokat az új tanévre.
3. A `frontmatter.json` `frontMatter.data.files` bejegyzésében cseréld az `id`, `title` és `file` értékét. A `schema`, `labelField` és `singleEntry` beállítást tartsd meg. A YAML snippet leírásában is frissítsd a célfájlt; a snippeteknek nincs automatikus célfájl-választásuk.
4. Frissítsd ezt az útmutatót és a `.frontmatter/templates/hir-uj.md` emlékeztetőt.
5. A lezárt tanév YAML- és tartalomfájlját hagyd meg. Az archív oldalakat a `src/pages/{ps|bs}/regi_hirfolyamok/` alatt készítsd el, a korábbi év mintájára.
6. Frissítsd az archív hivatkozásokat a `src/partials/common-{ps|bs}-korabbi-hirek.html` és szükség szerint a `common-regi-hirfolyamok-nav.html` fájlban.
