# Megosztott aloldalak – egy tartalom, két menüpont, két URL

## Mi ez?

Azok az aloldalak, amelyek két fő menüpontban is szerepelnek (pl. Közzétételi lista + saját menüje), mostantól **egy helyen szerkeszthetők**: mindkét fő menühöz külön oldal-példány van, de **azonos fájlnevvel** (így az URL-ben csak a főmenü/mappa tér el: `/bemutatkozas/szmsz` és `/kozzeteli_lista/szmsz`), és a tartalom ugyanabból a közös forrásból jön. A menüben **csak az a fő menüpont nyílik ki és lesz aktív, amelyikből az oldalt megnyitották**.

## Hogyan működik?

- **Azonos fájlnevek:** minden megosztott aloldalból két példány van (pl. `bemutatkozas/szmsz.html` + `kozzeteli_lista/szmsz.html`); a front matterben a `menu: <főmenü-mappa>` dönti el, melyik menü aktív az adott URL-en.
- **Központi definíció:** `src/data/pages/99_megosztott_aloldalak.yml` – cím (`title`), oldalnév (`page`), link (`url` + `folder`), opcionálisan `hamarosan` kapcsoló (iskolánként: `bs` / `ps`) és tartalmi adatok (pl. az étkezési díjak).
- **Menü-adatfájlokban** (`02b/02p_bemutatkozas`, `03_etkezesi_informaciok`, `04b/04p_kozzeteteli_lista`, `05_beiratkozastol_foto_archivumig.yml`) az aloldal helyén helyőrző áll, az adott menü mappájával:
  ```yaml
  - shared: szmsz
    folder: kozzeteli_lista
  ```
- **Helperek:**
  - `megosztottAloldalak` – a `shared:` helyőrzőket oldja fel a központi definícióra (`menu-item.html`: `{{#each (megosztottAloldalak items)}}`); rekurzív, a `breadcrumbs.js` is használja.
  - `ifpageInMenu` – az aktív menüpont jelölése (`menu-item.html`: `{{#ifpageInMenu page folder}}current is-active{{/ifpageInMenu}}`): csak az a menü aktív, amelyiknek a mappájában járnk (`menu:` front matter alapján).
  - `megosztottTartalom` – a központi táblában lévő tartalmi adatokat (pl. étkezési díjak) teszi a partial contextuséba.
  - `hamarosan` – a kapcsoló az oldal front matteréből ÉS a központi táblából is jöhet (`page` név alapján, iskolánként) – így a megosztott oldalak kapcsolója egy helyen kapcsolható.

## Érintett aloldalak (azonos fájlnevek mindkét mappában)

| Aloldal | Menüpontok | Oldalfájlok (azonos névvel) |
|---|---|---|
| Étkezési térítési díjak | étkezési infók + közzétételi lista | `etkezesi_informaciok/etkezes_teritesi_dijak.html` + `kozzeteli_lista/etkezes_teritesi_dijak.html` |
| Pedagógiai program | bemutatkozás + közzétételi lista | `bemutatkozas/ped_program.html` + `kozzeteli_lista/ped_program.html` |
| SZMSZ | bemutatkozás + közzétételi lista | `bemutatkozas/szmsz.html` + `kozzeteli_lista/szmsz.html` |
| Házirend | bemutatkozás + közzétételi lista | `bemutatkozas/hazirend.html` + `kozzeteli_lista/hazirend.html` |
| Egyéni fejlesztés | tanórán kívüli + közzétételi lista | `tanoran_kivuli_foglalkozasok/egyeni_fejlesztes.html` + `kozzeteli_lista/egyeni_fejlesztes.html` |
| Szakkörök, tehetséggondozás | tanórán kívüli + közzétételi lista | `tanoran_kivuli_foglalkozasok/szakkorok.html` + `kozzeteli_lista/szakkorok.html` |
| Szaktárgyi korrepetálások | tanórán kívüli + közzétételi lista | `tanoran_kivuli_foglalkozasok/szaktargyi_korrepetalasok.html` + `kozzeteli_lista/szaktargyi_korrepetalasok.html` |

Korábbi, eltérő nevű duplikátumok (`bemutatk_*`, `kozzetetel_*`, `tan_kiv_fogl_*`) törölve; a bs szakkörök táblázat tartalma a `src/content/bs-szakkorok.md` fájlból jön (`mdFile`).

## Hol szerkeszd a tartalmat?

- **SZMSZ / Házirend / Pedagógiai program:** a `common-pdf-*` partialok (PDF url-ek).
- **Szakkörök (bs):** `src/content/bs-szakkorok.md`; **(ps):** `src/data/ps/szakkorok.yml` (adatvezérelt táblázat).
- **Egyéni fejlesztés / Szaktárgyi korrepetálások:** `src/data/bs|ps/<dataKey>.yml` (adatvezérelt táblázatok).
- **Étkezési térítési díjak:** a `99_megosztott_aloldalak.yml` `etkezes_teritesi_dijak` bejegyzésében (dátum + árak).
- **„Hamarosan" kapcsoló** (megosztott oldalaknál): a `99_megosztott_aloldalak.yml` `hamarosan: { bs: ..., ps: ... }` mezőjében.

## Megjegyzések

- Breadcrumb mindkét oldalon a **saját menü** útvonalát mutatja (`menuFile` front matter alapján).
- A régi `kozzetel_*`, `bemutatk_*`, `tan_kiv_fogl_*` URL-ek megszűntek – ha kell, .htaccess redirect tehető rájuk.
- `submenus.html` és az `arch/` menü-partialok régi neveket tartalmaznak, de dead code (nem épülnek be).

## Kapcsolódó változás: „Hamarosan" kapcsoló

`src/helpers/hamarosan.js` – az oldal front matterében `hamarosan: true/false` kapcsolóval a `{{#hamarosan}} … {{/hamarosan}}` blokkban lévő valódi tartalom helyett a „Hamarosan…" felirat (a `common-hamarosan` partialból) jeleníthető meg. Megosztott oldalaknál a kapcsoló a központi táblából jön (iskolánként is megadható).

