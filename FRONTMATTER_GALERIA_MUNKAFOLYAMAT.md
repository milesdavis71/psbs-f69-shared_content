# Galéria esemény létrehozása Front Matterrel

A galériák egyetlen iskolai főoldalon, a `/galeriak` címen jelennek meg. Az események tanév szerinti szekciókba rendezve, automatikusan kerülnek fel; nincs külön éves galéria grid oldal, és a menüben sincs évenkénti almenüpont.

## Kapcsolódó fájlok

| Fájl | Szerep |
|------|--------|
| `frontmatter.json` | A „Galéria események” Data adatforrás és az űrlap sémája |
| `frontmatter.config.cjs` | A feldolgozott galériamappák felkínálása és a parancsok regisztrálása |
| `.frontmatter/ui/gallery-form.mjs` | Mappa kiválasztása, automatikus kitöltés és mentés a dashboardról |
| `.frontmatter/lib/gallery-store.cjs` | Registry, eseményoldal és fő galériaoldal írása |
| `.frontmatter/lib/gallery-commands.cjs` | VS Code parancsok és a dashboard-save fallback figyelése |
| `src/data/gallery_events.yml` | Az összes galéria esemény közös listája |
| `src/helpers/gallery*.js` | Grid, évszekciók, képszám és menü aktív állapot |
| `src/pages/{ps,bs}/galeriak.html` | Az iskola fő galériaoldala |
| `src/pages/{ps,bs}/galeriak/{year}/{slug}.html` | Egy esemény aloldala |
| `src/assets/img/{ps,bs}/galeriak/{year}/{slug}/` | `full/` és `thumb/` képek |

## Képek előkészítése

1. Töltsd le a képeket az iskola Facebook-oldaláról egy ideiglenes mappába.
2. Nézd át őket, és a borítónak szánt kép legyen `01.jpg` (vagy `01.jpeg`, `01.png`).
3. Futtasd a `resizer.py` programot. A kimenet:
   - `full/NN_full.jpg` – nagy kép
   - `thumb/NN_thumb.jpg` – 265 px széles borító
   - `original/` – az eredeti képek (alapértelmezésben megőrizve)
4. A kész mappát másold ide:
   `src/assets/img/{ps|bs}/galeriak/{tanév}/{slug}/`
   Példa: `src/assets/img/ps/galeriak/2026-27/2026_09_10_100_eves_az_iskola/`

A mappa neve egyben a `slug` és az esemény URL-je is lesz. A név elején legyen `ÉÉÉÉ_HH_NN` dátum.

> Régi galériáknál előfordulhat, hogy az oldal slugja és a képmappa neve eltér (pl. rövidítés, eltérő nagybetű, vagy a képek a másik iskola mappájában vannak). A `resolveGalleryAsset` helper ezeket feloldja, ezért a régi URL-ek változatlanok maradhatnak.

## Az új galéria felvétele (Data fül)

### Az űrlap mezői, sorrendben

Az **Iskola** és a **Tanév** választó az űrlap elején, külön sorban jelenik meg (a
Uniforms technikai mezői rejtve vannak), így biztosan át lehet váltani rajtuk.

| Mező | Kitölthető? | Leírás |
|------|-------------|---------|
| **Iskola** | ✅ választható | `ps` (Petőfi, alapértelmezett) vagy `bs` (Bálint) |
| **Tanév** | ✅ választható | A kiválasztott iskola galériamappáinak évneveiből olvasódik (pl. `2026-27`, `2025-26`) |
| **Feldolgozott galériamappa** | ✅ választható | Csak a kiválasztott iskola és tanév galériái láthatók |
| **A galéria címe** | ✅ kötelező | Automatikusan a mappanévből jön, de átírható |
| **Dátum** | ✅ opcionális | Automatikusan a mappanév dátumából jön (`2026. 09. 10.`) |
| **Képek alt szövege** | ✅ opcionális | A képek alt szövege; üresen a cím |
| **Mappa / slug** | 🔒 automatikus | A képmappa neve |

A **cím** automatikusan kitöltött értéke jelölve van: ha kézzel átírod, a rendszer
nem írja felül, ha viszont új mappát választasz, az automatikus cím frissül.
Iskolaváltáskor a mappanévből származó automatikus cím törlődik, a kézzel írt cím
viszont megmarad.

### Lépésről lépésre

1. VS Code → `Ctrl+Shift+P` → **Front Matter: Open dashboard** (vagy a Front Matter ikon).
2. A dashboard **Data** fülén válaszd ki a **Galéria események (ps/bs)** adatforrást.
3. Nyomj az **Add** gombot.
4. Az űrlap tetején lévő **Iskola** legördülőn válaszd ki, hogy **ps** vagy **bs** legyen
   (alapértelmezetten `ps`).
5. A **Tanév** legördülő automatikusan betöltődik a kiválasztott iskola
   galériamappáinak évneveiből (legfrissebb elöl): pl. ps esetén
   `2026-27`, `2025-26`, `2024-25`, `2023-24`, `2022-23`; bs esetén
   `2026-27`, `2025-26`, `2024-25`, `2023-24`.
   A lista a mappák `iskola/tanév/slug` elnevezéséből számolódik ki, így
   mindig pontosan a lemezen lévő tanévek jelennek meg.
6. A **Feldolgozott galériamappa** listája automatikusan a kiválasztott iskolára
   **és tanévre** szűkül:
   - `ps` + `2026-27` esetén csak a `ps/2026-27/...` mappák láthatók,
   - `bs` + `2025-26` esetén csak a `bs/2025-26/...` mappák láthatók.
   Iskolaváltáskor a korábban kiválasztott mappa és az automatikus mezők törlődnek,
   és a tanév-lista is a új iskolához igazodik.
7. Válaszd ki a mappát. A listában emberi olvasatú név látszik
   (pl. `2026–2027 – Tanévnyitó`), de a mentéshez a mappa teljes útvonala kerül.
   A **Mappa / slug** és a **Dátum** mező automatikusan kitöltődik.
8. Ellenőrizd a **címet**, és írd be a **Dátumot** (ha eltér a mappanév dátumától).
9. Nyomj az **Add/Update** gombot. A rendszer létrehozza:
   - az esemény oldalát (`src/pages/{school}/galeriak/{year}/{slug}.html`),
   - szükség esetén az iskola `/galeriak` főoldalát,
   - a bejegyzést a `src/data/gallery_events.yml` fájlban.
10. Az új esemény a következő build után automatikusan megjelenik a fő galériaoldalon, a megfelelő tanév tabjában.

Meglévő bejegyzés szerkesztésekor a cím, dátum és alt módosítható; a mappa/slug nem változik. Ha a mappa már szerepel a listában, a mentés frissíti a meglévő bejegyzést, nem hoz létre duplikátumot.

### A bal oldali galérialista

A Data fül bal oldali oszlopában a galéria eseményei (a `Cím` mezővel) jelennek meg. A rendszer ezt a listát szűri:

- **a kiválasztott iskola és az aktuális tanév bejegyzései látszanak**, a lista elején (alapértelmezetten a `ps` iskola és a legfrissebb, `2026-27` tanév),
- **a többi bejegyzés elrejtve marad** (a régi tanévek és a másik iskola galériái),
- az iskolaváltáskor (a **Petőfi** ⇄ **Bálint** legördülő) a lista **azonnal újraszűrődik**,
- a **„Képlista frissítése”** gomb szintén újraszűri a bal oldali listát,
- a ps az alapértelmezett iskola.

A szűrés közvetlenül a dashboard listájában történik, ezért a `src/data/gallery_events.yml` fájl sem a tartalmát, sem a sorrendjét nem változtatja meg. A bejegyzéseket a `psbs.gallery.entries` VS Code parancs szolgáltatja (a `gallery_events.yml` fájlból).

### A „Képlista frissítése” gomb

Az űrlap alatt található gomb **a lemezről újratölti** a galériamappák listáját, iskolánként csoportosítva.

Mivel a `Front Matter: Refresh Front Matter Settings` parancs csak a háttérben frissíti a sémát, a **már megnyitott** űrlap listája változatlan marad – ezért a gomb a gyors és biztos megoldás:

1. Futtasd a `resizer.py` programot, és másold be a feldolgozott mappát az `assets/img` alá.
2. A Data űrlapon nyomd meg a **„Képlista frissítése”** gombot.
3. Az új mappa azonnal megjelenik a megfelelő iskola listájában.

A gomb ezen felül **elvégzi a hiányzó galériaoldalak és registrybejegyzések létrehozását** is: minden feldolgozott képmappához, ami még nincs bejegyzve, létrehozza az eseményoldalt (`src/pages/{iskola}/galeriak/{tanév}/{slug}.html`) és a `gallery_events.yml` bejegyzését. Az űrlap alatt listázza, mit hozott létre.

Ha az űrlap mégsem reagál, zárd be az adatforrást, válaszd ki újra, vagy indítsd újra a VS Code-ot (`Developer: Reload Window`).

Ugyanez a szinkronizálás elérhető parancssorból is:

```bash
npm run gallery:sync
```

## Hogyan épül fel a főoldal?

A főoldal eseményeit három forrás egyesíti (`src/lib/gallery.js` → `loadEvents`):

1. **A feldolgozott képmappák** (`src/assets/img/{ps,bs}/galeriak/{tanév}/{slug}/`) – ezek jelzik a legfrissebb tanéveket, ezért **egy új tanév első galériája azonnal megjelenik**, akár registrybejegyzés nélkül.
2. **A registry** (`src/data/gallery_events.yml`) – a szerkesztett cím, dátum és alt innen származik.
3. **Az eseményoldalak frontmatterje** (`src/pages/{iskola}/galeriak/{tanév}/{slug}.html`) – a kézzel szerkesztett példány nyer a mappanévből generált címmel szemben.

A mappa útvonala (`iskola/tanév/slug`) **kanonikus**: ha a registry bejegyzés `school` vagy `year` mezője eltér a mappa előtagjától, a mappa nyer. Ugyanígy a **feldolgozott képmappa helye dönti el, melyik iskolához tartozik az esemény**, akkor is, ha az oldalfájl a másik iskola mappájában maradt.

- `gallerySections('ps')` tanév szerint csoportosít.
- A főoldal tetején **Foundation vízszintes tab rendszer** látszik (`ul.tabs` + `tabs-content`).
- A bal első tab az aktuális (legfrissebb) tanév, és ez aktiválódik alapból.
- Minden tab panelen az adott tanév esemény galéria gridje látszik.
- A tabváltás a Foundation saját logikájával történik: az aktív státusz mindig a kiválasztott évre vált, az URL hash is frissül (`#year-2025-26`).
- Mobilon a tab-sáv vízszintesen görgethető, az aktív tab automatikusan középre ugrik.
- A kártyák borítója mindig `thumb/01_thumb.jpg`; a link `/galeriak/{year}/{slug}`.
- A képszámot a `galleryCount` helper a `full/` mappa alapján számolja, ezért a `count` mező nem avul el.

## Menü

A `src/data/pages/07p_galeriak.yml` és `07b_galeriak.yml` már csak a „Fotó archívumok” főpontot tartalmazza. Az éves almenük megszűntek. A főpont a `/galeriak` oldalra mutat, és minden galériaoldalon aktív állapotba kerül.

A régi éves oldalak (`/galeriak/2025-26`, stb.) megmaradnak működő archive-ként, de a menüből már nem linkeljük őket.

## Tanévváltás

Nincs teendő a `frontmatter.json`-ban. Az új tanév akkor jelenik meg a főoldal felső (bal felső) tabjaként, amikor az első feldolgozott galéria bekerül a `src/assets/img/{iskola}/galeriak/{új-tanév}/...` mappába:

- a **főoldali tab** a képmappák alapján már a következő builden megjelenik,
- a **kártya és az eseményoldal** létrehozásához nyomd meg a **„Képlista frissítése”** gombot (vagy futtasd az `npm run gallery:sync` parancsot).

A tanévet a mappa neve és a dátum határozza meg.

## Hibaelhárítás

- **Az új tanév nem jelent meg a főoldalon:** a képmappának a feldolgozott formában kell lennie (`thumb/01_thumb.jpg` a mappában), a `src/assets/img/{iskola}/galeriak/{tanév}/` útvonalon. Utána futtasd a buildet; a kártyához és az eseményoldalhoz nyomd meg a **„Képlista frissítése”** gombot.
- **A mappa nem látszik a listában:** ellenőrizd, hogy létezik `thumb/01_thumb.jpg` a mappában, majd nyomd meg a **„Képlista frissítése”** gombot az űrlap alatt.
- **A mappa a másik iskola listájában keresendő:** a `folder` értéke mindig `iskola/tanév/slug` alakú; a szűrés a `ps/` és `bs/` előtagon alapul.
- **A bejegyzés a rossz iskolánál jelenik meg:** a mappa útvonala kanonikus, a rendszer a `folder` előtagjából újra megállapítja az iskolát. A kézzel beírt `school` mező ellentmondását a `npm run gallery:fix-registry` parancs rendezi.
- **A mentés nem indult el:** nézd meg, hogy a Front Matter dashboard üzenethídja elérhető-e; szükség esetén **Developer: Reload Window**.
- **A régi galériaoldal nem frissült:** a régi éves oldalak statikus archive-ok; az új események a fő `/galeriak` oldalon jelennek meg.
- **Hiányzó kép:** a grid „Nincs borítókép” jelzést mutat; ellenőrizd a `thumb/01_thumb.jpg` fájlt.

## Egykori migráció

A régi `src/data/gal_picts_*.yml` fájlok megmaradnak történeti adatként, de az új grid már nem olvassa őket. A `gallery_events.yml` az egyetlen aktív lista.

A `scripts/migrate_gallery_events.cjs` a meglévő eseményoldalak frontmatteréből építette fel a `src/data/gallery_events.yml` fájlt. Újrafuttatható, de felülírja a registry-t; normál használatban nem kell futtatni.

A `scripts/fix_gallery_titles.cjs` a régi `gal_picts_*.yml` címekből pótolja a `Cím` helyőrzőket az eseményoldalakon és a registryben. Egyszeri javításra való.

A `scripts/fix_gallery_registry.cjs` rendrakja a `gallery_events.yml` listát: a mappa útvonala kanonikus, az üres és a duplikált bejegyzések eltűnnek, a címek pedig az eseményoldalak frontmatterjéből frissülnek. Egyszeri javításra való.

A `scripts/sync_gallery_pages.cjs` (`npm run gallery:sync`) a feldolgozott képmappákból létrehozza a hiányzó eseményoldalakat és registrybejegyzéseket. Ez a „Képlista frissítése” gomb parancssori változata.
