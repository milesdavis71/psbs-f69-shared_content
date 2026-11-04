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

## Új esemény létrehozása

1. VS Code → `Ctrl+Shift+P` → **Front Matter: Refresh Front Matter Settings** (ha frissen másoltad be a mappát).
2. Front Matter Dashboard → **Data** → **Galéria események (ps/bs)**.
3. **Add** gomb.
4. A **Feldolgozott galériamappa** listából válaszd ki a mappát, pl.:
   `ps/2026-27/2026_09_10_100_eves_az_iskola`
5. Az iskola, tanév, slug és dátum automatikusan kitöltődik. A címet ellenőrizd/módosítsd; az alt szöveg opcionális.
6. **Add/Update** → a rendszer létrehozza:
   - az esemény oldalát,
   - szükség esetén az iskola `/galeriak` főoldalát,
   - a bejegyzést a `src/data/gallery_events.yml` fájlban.
7. Az új esemény a következő build után automatikusan megjelenik a fő galériaoldalon és a megfelelő tanév szekcióban.

Meglévő bejegyzés szerkesztésekor a cím, dátum és alt módosítható; a mappa/slug nem változik. Ha a mappa már szerepel a listában, a mentés frissíti a meglévő bejegyzést, nem hoz létre duplikátumot.

## Hogyan épül fel a főoldal?

- `gallerySections('ps')` a `gallery_events.yml` alapján tanév szerint csoportosít.
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

Nincs teendő a `frontmatter.json`-ban. Az új tanév akkor jelenik meg, amikor az első eseményt a megfelelő `src/assets/img/.../{új-tanév}/...` mappából felveszed. A tanévet a mappa neve és a dátum határozza meg.

## Hibaelhárítás

- **A mappa nem látszik a listában:** futtasd a **Refresh Front Matter Settings** parancsot, és ellenőrizd, hogy létezik `thumb/01_thumb.jpg`.
- **A mentés nem indult el:** nézd meg, hogy a Front Matter dashboard üzenethídja elérhető-e; szükség esetén **Developer: Reload Window**.
- **A régi galériaoldal nem frissült:** a régi éves oldalak statikus archive-ok; az új események a fő `/galeriak` oldalon jelennek meg.
- **Hiányzó kép:** a grid „Nincs borítókép” jelzést mutat; ellenőrizd a `thumb/01_thumb.jpg` fájlt.

## Egykori migráció

A régi `src/data/gal_picts_*.yml` fájlok megmaradnak történeti adatként, de az új grid már nem olvassa őket. A `gallery_events.yml` az egyetlen aktív lista.

A `scripts/migrate_gallery_events.cjs` a meglévő eseményoldalak frontmatteréből építette fel a `src/data/gallery_events.yml` fájlt. Újrafuttatható, de felülírja a registry-t; normál használatban nem kell futtatni.

A `scripts/fix_gallery_titles.cjs` a régi `gal_picts_*.yml` címekből pótolja a `Cím` helyőrzőket az eseményoldalakon és a registryben. Egyszeri javításra való.
