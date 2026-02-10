# Frontmatter Rendezés - Dokumentáció

## Áttekintés

Ez a megoldás automatikusan rendezi a HTML fájlok tetején található frontmatter mezőket a mentés pillanatában.

## Hogyan működik?

### 1. Sort-fm.js Script

A projekt gyökerében található `sort-fm.js` script felelős a frontmatter rendezéséért.

**Rendezési logika:**

- Először a megadott fix sorrendben (`PREFERRED_ORDER`)
- Utána a többi mező ABC sorrendben

**Jelenlegi fix sorrend:**

1. `layout`
2. `title`
3. `page`
4. `dataFile`
5. `dataKey`

**Egyéb mezők** (mint `schoolKey`, `tableColumns`, stb.) ABC sorrendben kerülnek a fix mezők után.

### 2. Run on Save Konfiguráció

A `.vscode/settings.json` fájlban található beállítás aktiválja a scriptet mentéskor:

```json
"emeraldwalk.runonsave": {
    "commands": [
        {
            "match": "src[\\\\/]pages[\\\\/].*\\.html$",
            "cmd": "node sort-fm.js \"${file}\""
        }
    ]
}
```

**Működés:**

- Amikor a `src/pages/` mappában (vagy almappákban) lévő HTML fájlt mentesz
- Automatikusan lefut a `sort-fm.js` script az adott fájlra
- A frontmatter rendezve lesz

## Példa

### Előtte:

```yaml
---
title: Egyéni fejlesztés
page: egyeni_fejlesztes
schoolKey: ps
dataKey: egyeni_fejlesztes
tableColumns: 3
layout: default
---
```

### Utána (mentés után automatikusan):

```yaml
---
layout: default
title: Egyéni fejlesztés
page: egyeni_fejlesztes
dataKey: egyeni_fejlesztes
schoolKey: ps
tableColumns: 3
---
```

## Manuális használat

Ha az összes fájlt egyszerre szeretnéd rendezni (paraméter nélkül):

```bash
node sort-fm.js
```

Vagy egy konkrét fájlra:

```bash
node sort-fm.js "src/pages/ps/kozzeteteli_lista/egyeni_fejlesztes.html"
```

## Testreszabás

A `sort-fm.js` fájl elején módosíthatod a fix sorrendet:

```javascript
const PREFERRED_ORDER = ['layout', 'title', 'page', 'dataFile', 'dataKey']
```

## Követelmények

- **Run on Save** VS Code plugin telepítve
- Node.js és a szükséges npm csomagok (`js-yaml`, `yaml-front-matter`, `glob`)
