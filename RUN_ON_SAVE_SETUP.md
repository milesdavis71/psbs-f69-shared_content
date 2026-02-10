# Run on Save Plugin Beállítása

## 1. Ellenőrzés

Győződj meg róla, hogy a **Run on Save** plugin telepítve van:

- Nyomd meg `Ctrl+Shift+X`
- Keresd meg: **"emeraldwalk.RunOnSave"**
- Ha nincs telepítve, telepítsd

## 2. VS Code újratöltése

Miután módosítottad a `.vscode/settings.json` fájlt:

1. Nyomd meg `Ctrl+Shift+P`
2. Írd be: **"Reload Window"**
3. Enter

## 3. Plugin engedélyezése

A Run on Save pluginnek engedélyezve kell lennie:

- Nézd meg a VS Code státuszsorában (alul) van-e valami "Run on Save" felirat
- Ha van egy "play" vagy "pause" gomb, kattints rá és válaszd "Run on Save: Enable"

## 4. Tesztelés

1. Nyiss meg egy HTML fájlt a `src/pages/` mappából
2. Módosítsd a frontmatter sorrendet (pl. rakd a `layout`-ot középre)
3. Mentsd el a fájlt (`Ctrl+S`)
4. A script automatikusan rendezni fogja a frontmatter-t

## 5. Debug

Ha nem működik, nézd meg a VS Code Output panelt:

1. `View` → `Output` (vagy `Ctrl+Shift+U`)
2. A dropdown-ból válaszd: **"Run on Save"**
3. Itt láthatod, hogy fut-e a parancs

## FONTOS LÉPÉSEK A MŰKÖDÉSHEZ

### A. VS Code újraindítása

Miután módosítottad a settings.json-t:

1. `Ctrl+Shift+P` → "Developer: Reload Window"
2. VAGY zárdd be és nyisd meg újra a VS Code-ot

### B. Plugin engedélyezése

Ellenőrizd a státuszt az alul lévő státuszsorban (Status Bar) - kék szöveg: "Run on Save: **Enabled**"

### C. Tesztelés

1. Nyiss meg egy .html fájlt a src/pages mappából
2. Módosítsd valamelyik sort
3. Mentés (Ctrl+S)
4. Ha működik, láthatod a konzolon a "Sikeresen rendezve" üzenetet

## Alternatív beállítások

Ha az aktuális beállítás nem működik, próbáld ki ezeket sorban:

### Változat 1 - Egyszerű glob:

```json
"emeraldwalk.runonsave": {
    "commands": [
        {
            "match": ".*pages.*\\.html$",
            "cmd": "node \"${workspaceFolder}/sort-fm.js\" \"${file}\""
        }
    ]
}
```

### Változat 2 - Teljes útvonal:

```json
"emeraldwalk.runonsave": {
    "commands": [
        {
            "match": "src[\\\\/]pages[\\\\/].*\\.html$",
            "cmd": "node c:/Users/Istvan/vscode_projects/psbs-f69-shared_content/sort-fm.js \"${file}\""
        }
    ]
}
```

### Változat 2 - Shell parancs:

```json
"emeraldwalk.runonsave": {
    "commands": [
        {
            "match": "src[\\\\/]pages[\\\\/].*\\.html$",
            "isAsync": true,
            "cmd": "cd ${workspaceFolder} && node sort-fm.js \"${file}\""
        }
    ]
}
```

### Változat 3 - Autosave kikapcsolása esetén:

```json
"emeraldwalk.runonsave": {
    "autoClearConsole": true,
    "commands": [
        {
            "match": "src[\\\\/]pages[\\\\/].*\\.html$",
            "notMatch": "[\\\\/]node_modules[\\\\/]",
            "cmd": "node ${workspaceFolder}/sort-fm.js \"${file}\""
        }
    ]
}
```

## Manuális használat

Ha a plugin nem működik megfelelően, mindig használhatod manuálisan:

```bash
# Egy fájl rendezése
node sort-fm.js "src/pages/ps/kozzeteteli_lista/egyeni_fejlesztes.html"

# Minden fájl rendezése egyszerre
node sort-fm.js
```
