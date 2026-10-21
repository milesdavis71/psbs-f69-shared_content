---
title: Új hír sablon
draft: true
---

# Új hír létrehozása (munkafolyamat)

Ez a sablon emlékeztető. **A fájl NEM kerül buildbe** — a lépéseket a valódi fájlokban kell elvégezni.

## 1. Kép feltöltése
- Fájl: `src/assets/img/hirfolyam/<nev>.jpg`
- Tipp: a Front Matter Media Menedzserből feltölthető (Media fül → Hírképek).

## 2. YAML bejegyzés → `src/data/news-2026-27.yml`
- A tanévi kulcs (`2026-27:`) alatti lista **LEGELEJÉRE** szúrjuk be (legfelül = legfrissebb hír).
- Használd a Front Matter snippetet: `HIR - YAML bejegyzés (news-*.yml)`.
- A `content` kulcs a **következő szabad** `newsNN` legyen (a legmagasabb meglévő + 1)!

## 3. Tartalom blokk → `src/content/common-news-content-2026-27.md`
- A blokk a fájl **VÉGÉRE** kerül.
- Használd a snippetet: `HIR - Tartalom blokk (common-news-content-*.md)`.
- Az `ifequal` kulcs **ugyanaz** a `newsNN`, amit a YAML-ben használtál!

## 4. Ellenőrzés
- `npm run ps` (Petőfi) és/vagy `npm run bs` (Bálint) → böngészőben ellenőrzés.
