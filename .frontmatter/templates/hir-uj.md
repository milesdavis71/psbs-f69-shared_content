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
- Tipp: a Front Matter Media Menedzserből feltölthető (Media fül → Hírképek).

## 2. YAML bejegyzés → `src/data/news-2026-27.yml`
- **Data → Hírek 2026/2027**: töltsd ki az új bejegyzés űrlapját, majd **Add**.
- A `site` mező választja ki az iskolát: `ps` = Petőfi, `bs` = Bálint, `common` = mindkettő.
- Az új hírt mentés után **húzd a lista LEGELEJÉRE**. Az Add alapból a lista végére teszi.
- Alternatíva: a YAML fájl legelején (`Ctrl+Home`) használd a `HIR - YAML bejegyzés (news-*.yml)` snippetet. A fájl közvetlen lista, nincs `2026-27:` gyűjtőkulcs.
- A `content` kulcs a **következő szabad** `newsNN` legyen (a legmagasabb meglévő + 1)!
- Az adatűrlap csak a hírlista bejegyzését menti; a hírszöveghez a következő lépést is végezd el.

## 3. Tartalom blokk → `src/content/common-news-content-2026-27.md`
- A blokk a fájl **VÉGÉRE** kerül.
- Használd a snippetet: `HIR - Tartalom blokk (common-news-content-*.md)`.
- Az `ifequal` kulcs **ugyanaz** a `newsNN`, amit a YAML-ben használtál!

## 4. Ellenőrzés
- `npm run ps` (Petőfi) és/vagy `npm run bs` (Bálint) → böngészőben ellenőrzés.
