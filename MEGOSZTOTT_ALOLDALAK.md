# Megosztott aloldalak – egy helyen szerkeszthetők, két menüpontban jelennek meg

## Mi ez?

Azok az aloldalak, amelyek két fő menüpontban is szerepelnek (pl. Közzétételi lista + saját menüje), **csak egy helyen, a `megosztott/` mappában léteznek** (`src/pages/bs/megosztott/` és `src/pages/ps/megosztott/`). A menüsorban mindkét fő menüpontban megjelennek, és **csak az a menü nyílik ki / lesz aktív, amelyikből az oldalra kattintottak**.

## Hogyan működik?

- **Egy hely:** minden megosztott aloldal egyetlen fájlból áll (pl. `bs/megosztott/szmsz.html`), URL-je: `/megosztott/szmsz`.
- **Központi definíció:** `src/data/pages/99_megosztott_aloldalak.yml` – cím (`title`), oldalnév (`page`), URL (`url` + `folder: megosztott`), opcionálisan `hamarosan` kapcsoló (iskolánként: `bs` / `ps`) és tartalmi adatok (pl. az étkezési díjak).
- **Menü-adatfájlokban** (`02b/02p_bemutatkozas`, `03_etkezesi_informaciok`, `04b/04p_kozzeteteli_lista`, `05_beiratkozastol_foto_archivumig.yml`) az aloldal helyén helyőrző áll, a menü azonosítójával:

  ```yaml
  - shared: szmsz
    menu: kozzeteli_lista
  ```

- **Helperek:**
  - `megosztottAloldalak` – a `shared:` helyőrzőket oldja fel a központi definícióra (`menu-item.html`: `{{#each (megosztottAloldalak items)}}`); a linkhez `?m=<főmenü>` query paramétert fűz; rekurzív, a `breadcrumbs.js` is használja.
  - `ifpageInMenu` – az aktív menüpont jelölése (`menu-item.html`: `{{#ifpageInMenu page menu}}current is-active{{/ifpageInMenu}}`).
  - `megosztottTartalom` – a központi táblában lévő tartalmi adatokat (pl. étkezési díjak) teszi a partial contextuséba.
  - `hamarosan` – a kapcsoló az oldal front matteréből ÉS a központi táblából is jöhet (`page` név alapján, iskolánként).
- **Aktív menü (JS):** az `app.js` `fixSharedMenuActive()` függvénye a `?m=` paraméter alapján az adott menüre teszi az aktív jelölést, a másikról leveszi. `?m=` nélküli (közvetlen) látogatáskor az oldal front matterében lévő `menu:` (kanonikus) menü aktív.

## Érintett aloldalak (mind: `megosztott/` mappában)

| Aloldal | Menüpontok | Fájl |
|---|---|---|
| Étkezési térítési díjak | étkezési infók + közzétételi lista | `megosztott/etkezes_teritesi_dijak.html` |
| Pedagógiai program | bemutatkozás + közzétételi lista | `megosztott/ped_program.html` |
| SZMSZ | bemutatkozás + közzétételi lista | `megosztott/szmsz.html` |
| Házirend | bemutatkozás + közzétételi lista | `megosztott/hazirend.html` |
| Egyéni fejlesztés | tanórán kívüli + közzétételi lista | `megosztott/egyeni_fejlesztes.html` |
| Szakkörök, tehetséggondozás | tanórán kívüli + közzétételi lista | `megosztott/szakkorok.html` |
| Szaktárgyi korrepetálások | tanórán kívüli + közzétételi lista | `megosztott/szaktargyi_korrepetalasok.html` |

Korábbi duplikátumok (menümappákban lévő másolatok, `bemutatk_*`, `kozzetetel_*`, `tan_kiv_fogl_*` nevek) törölve; a bs szakkörök táblázat tartalma a `src/content/bs-szakkorok.md` fájlból jön (`mdFile`).

## Hol szerkeszd a tartalmat?

- **SZMSZ / Házirend / Pedagógiai program:** a `common-pdf-*` partialok (PDF url-ek).
- **Szakkörök (bs):** `src/content/bs-szakkorok.md`; **(ps):** `src/data/ps/szakkorok.yml` (adatvezérelt táblázat).
- **Egyéni fejlesztés / Szaktárgyi korrepetálások:** `src/data/bs|ps/<dataKey>.yml` (adatvezérelt táblázatok).
- **Étkezési térítési díjak:** a `99_megosztott_aloldalak.yml` `etkezes_teritesi_dijak` bejegyzésében (dátum + árak).
- **„Hamarosan" kapcsoló** (megosztott oldalaknál): a `99_megosztott_aloldalak.yml` `hamarosan: { bs: ..., ps: ... }` mezőjében.

## Megjegyzések

- Breadcrumb a megosztott oldalakon a kanonikus menü útvonalát mutatja (`menuFile` front matter alapján) — a `?m=` paramétert nem követi.
- A régi URL-ek (`/kozzeteli_lista/szmsz`, `/bemutatkozas/szmsz` stb.) megszűntek – ha kell, .htaccess redirect tehető rájuk.
- `submenus.html` és az `arch/` menü-partialok régi neveket tartalmaznak, de dead code (nem épülnek be).

## Kapcsolódó változás: „Hamarosan" kapcsoló

`src/helpers/hamarosan.js` – az oldal front matterében `hamarosan: true/false` kapcsolóval a `{{#hamarosan}} … {{/hamarosan}}` blokkban lévő valódi tartalom helyett a „Hamarosan…" felirat (a `common-hamarosan` partialból) jeleníthető meg. Megosztott oldalaknál a kapcsoló a központi táblából jön (iskolánként is megadható).
