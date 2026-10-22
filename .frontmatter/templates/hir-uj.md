---
title: Új hír sablon
draft: true
---

# Új hír létrehozása (munkafolyamat)

Ez a sablon emlékeztető. **A fájl NEM kerül buildbe** — a lépéseket a valódi fájlokban kell elvégezni.

## Aktuális tanév

- Új hírt **csak az aktuális tanévben** hozunk létre – most: **2026-27**. Visszafele, előző tanévbe soha nem hozunk létre hírt!
- A Front Matter Dashboard **Data fülén csak az aktuális tanév látszik** (pl. `Hírek 2026/2027`), mert a `frontmatter.json` `frontMatter.data.files` listájában csak ez van. A régi évek YAML-jei archív állapotban vannak, külön linkről nyithatók meg, azokat soha nem szerkesztjük.
- Tanévváltást a pluginban nem kell csinálni – ha jön az új tanév, a tanévet **manuálisan** cseréled, lásd: `FRONTMATTER_HIR_MUNKAFOLYAMAT.md` → „Tanévváltás – manuális ellenőrzőlista”.

## 1. Kép feltöltése
- Fájl: `src/assets/img/hirfolyam/<nev>.jpg`
- A **Windows Fájlkezelőből húzd a képet a Media fül képeket mutató területére, húzás közben nyomva tartott Shifttel**. Várd meg a feltöltési jelzést, majd előbb az egérgombot engedd fel, és csak utána a Shiftet. Az alapértelmezett médiamappa a hirfolyam.
- Ha a kép új szerkesztőlapon nyílik meg, a VS Code fájlmegnyitója kapta meg: ismételd meg a húzást Shifttel. A sima pluszjel még nem feltöltési jelzés.
- Feltöltés után: `Ctrl+Shift+P` → **Front Matter: Refresh Front Matter Settings**. Ezt az adatűrlap kitöltése előtt végezd el.
- A képet csak egyszer töltöd fel; a Data űrlapon már a listából választod ki.

## 2. YAML bejegyzés → `src/data/news-2026-27.yml`
- **Data → Hírek 2026/2027**: töltsd ki az új bejegyzés űrlapját, majd **Add**.
- A **Hírkép** listából válaszd ki a feltöltött képet (kép nélkül: `nincs`).
- A `site` mező választja ki az iskolát: `ps` = Petőfi, `bs` = Bálint, `common` = mindkettő.
- A `site`, `align`, `imgclass` és `contentclass` legördülőket nem kell átálltogatni: ha érintetlenül hagyod őket, a mentés a séma alapértelmezését írja ki (ps, center, medium-3, medium-9). A `Hírkép` üresen hagyva a `nincs` értéket kapja.
- A `content` mező **automatikus és csak olvasható**. Az Add frissen kiszámolja a következő `newsNN` azonosítót, és elkészíti a szövegblokkot is. Várd meg a „Mentve: newsNN” visszajelzést.
- Az új hír a Data listában és a honlapon is **legfelül jelenik meg**; nem kell áthúzni.
- Az Update megtartja az azonosítót. Ha közben másik ablakban módosították a hírt, nyisd meg újra az adatforrást.
- Az automatikus kiosztás első betöltéséhez: **Developer: Reload Window**, majd nyisd meg újra a dashboardot.
- Kézi alternatíva: a YAML fájl legelején (`Ctrl+Home`) használd a `HIR - YAML bejegyzés (news-*.yml)` snippetet. Ennél te adod meg a YAML-ben és a szövegfájlban található legnagyobb sorszám + 1 azonosítót, és külön hozod létre a szövegblokkot.

## 3. Tartalom blokk → `src/content/common-news-content-2026-27.md`
- A mentési visszajelzésben kattints a **Hír szövegének megnyitása** linkre.
- Az automatikusan elkészült blokkban az `<!-- Ide írd a hír szövegét. -->` megjegyzést cseréld a hír szövegére, majd mentsd a fájlt.
- A blokk nyitó/záró sorát hagyd meg; az azonosítót nem kell újra beírni.
- Csak kézi YAML-bejegyzésnél használd a `HIR - Tartalom blokk (common-news-content-*.md)` snippetet, pontosan a YAML-ben megadott `newsNN` értékkel.

## 4. Ellenőrzés
- `npm run ps` (Petőfi) és/vagy `npm run bs` (Bálint) → böngészőben ellenőrzés.
