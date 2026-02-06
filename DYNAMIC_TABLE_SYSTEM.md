# Dinamikus Táblázat Rendszer

Ez a rendszer lehetővé teszi dinamikus táblázatok létrehozását Panini és YAML adatok használatával.

## Főbb jellemzők

1. **Frontmatter alapú oszlopszám váltás**: A táblázat 2 vagy 3 oszlopos lehet a frontmatter `tableColumns` értékétől függően
2. **SchoolData helper támogatás**: Kiolvassa a frontmatterben megadott schoolData adatot (ps/bs)
3. **YAML adatforrás**: A táblázat fejléceit és adatait YAML fájlból olvassa ki
4. **Dinamikus fejlécek**: A "thead" rész oszlopneveit a YAML adatfájlból olvassa

## Fájlstruktúra

### 1. Fő partial fájl

- **Helye**: `src/partials/dynamic-table-solution.html`
- **Használat**: `{{> dynamic-table-solution}}`
- **Funkció**: Dinamikusan rendereli a táblázatot a frontmatter `tableColumns` értéke alapján

### 2. Helper fájl

- **Helye**: `src/helpers/equals.js`
- **Funkció**: Egyszerű egyenlőség ellenőrző helper a `{{#equals}}` blokkhoz

### 3. YAML adatfájl sablon

- **Helye**: `src/data/ps/dynamic_table_example.yml` (vagy `src/data/bs/`)
- **Struktúra**:

    ```yaml
    tableHeaders:
        twoColumn:
            - name: 'Oszlopnév 1'
              key: 'kulcs1'
            - name: 'Oszlopnév 2'
              key: 'kulcs2'

        threeColumn:
            - name: 'Oszlopnév 1'
              key: 'kulcs1'
            - name: 'Oszlopnév 2'
              key: 'kulcs2'
            - name: 'Oszlopnév 3'
              key: 'kulcs3'

    tableData:
        - kulcs1: 'Érték 1'
          kulcs2: 'Érték 2'
          kulcs3: 'Érték 3'
    ```

### 4. Példa oldalak

- **2 oszlopos**: `src/pages/ps/dynamic_table_example.html`
- **3 oszlopos**: `src/pages/ps/dynamic_table_example_3col.html`

## Használati útmutató

### 1. YAML fájl létrehozása

Hozz létre egy YAML fájlt a `src/data/ps/` vagy `src/data/bs/` könyvtárban a fenti struktúra szerint.

### 2. Oldal létrehozása

Hozz létre egy HTML fájlt a `src/pages/ps/` vagy `src/pages/bs/` könyvtárban:

```html
---
layout: default
title: Az oldal címe
page: egyedi_oldal_nev
schoolKey: ps # vagy bs
tableColumns: 2 # vagy 3
---

{{> breadcrumb}} {{> title}} {{> dynamic-table-solution}}
```

### 3. Frontmatter beállítások

- **schoolKey**: `ps` vagy `bs` - meghatározza, melyik iskola adatait használja
- **tableColumns**: `2` vagy `3` - meghatározza a táblázat oszlopainak számát

### 4. Partial meghívása

Az oldal törzsében használd: `{{> dynamic-table-solution}}`

## Működési elv

1. A partial a `{{#schoolData schoolKey "fajl_nev"}}` helper segítségével betölti a YAML adatokat
2. Ellenőrzi a frontmatter `tableColumns` értékét
3. Ha `tableColumns` értéke 2:
    - A `tableHeaders.twoColumn` fejléceket használja
    - A `tableData` adatokból csak az első két mezőt jeleníti meg
4. Ha `tableColumns` értéke 3:
    - A `tableHeaders.threeColumn` fejléceket használja
    - A `tableData` adatokból mindhárom mezőt jeleníti meg
5. Ha nincs `tableColumns` érték megadva, alapértelmezettként 2 oszlopot jelenít meg
6. Hibás érték esetén hibaüzenetet jelenít meg

## Példa YAML struktúra

```yaml
# src/data/ps/sajat_tablazat.yml
tableHeaders:
    twoColumn:
        - name: 'Tanár neve'
          key: 'name'
        - name: 'Tantárgy'
          key: 'subject'

    threeColumn:
        - name: 'Tanár neve'
          key: 'name'
        - name: 'Tantárgy'
          key: 'subject'
        - name: 'Terem'
          key: 'room'

tableData:
    - name: 'Kovács János'
      subject: 'Matematika'
      room: '201'

    - name: 'Nagy Éva'
      subject: 'Magyar nyelv'
      room: '105'
```

## Tesztelés

A rendszer teljes funkcionalitása tesztelve van:

- ✅ 2 oszlopos táblázat megjelenítése
- ✅ 3 oszlopos táblázat megjelenítése
- ✅ YAML adatok betöltése
- ✅ SchoolData helper működése
- ✅ Dinamikus fejlécek
- ✅ Hibakezelés (érvénytelen oszlopszám esetén)

## Korlátozások

- Csak 2 vagy 3 oszlop támogatott
- A YAML fájl struktúrájának meg kell felelnie a sablonnak
- A `schoolKey` értéknek `ps` vagy `bs`-nek kell lennie
