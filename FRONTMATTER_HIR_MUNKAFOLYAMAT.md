# Hír létrehozása Front Matter pluginnel

Az aktuális tanév **2026-27**. A Front Matter Dashboard **Data** fülén a **Hírek 2026/2027 (aktuális tanév)** adatforrásban hozhatod létre és szerkesztheted a hírlista bejegyzéseit. Mentéskor automatikusan létrejön a `newsNN` azonosító és a hozzá tartozó üres szövegblokk. A hír szövegét ebben a blokkban, a tanévi Markdown-fájlban kell megadni.

## Kapcsolódó fájlok

| Fájl | Szerep |
|------|--------|
| `frontmatter.json` | Adatűrlap sémája, média mappa és snippetek |
| `frontmatter.config.cjs` | Képválasztó, csak olvasható ID-mező és a hírmentési parancsok regisztrálása |
| `.frontmatter/ui/data-select-colors.js` | A Data legördülő mezőinek és listaelemeinek olvasható témaszínei |
| `.frontmatter/ui/news-id.mjs` | Az Add/Update gomb ellenőrzött mentése és visszajelzése |
| `.frontmatter/lib/news-store.cjs` | Friss fájlolvasás, ID-kiosztás, ütközésellenőrzés és szövegblokk létrehozása |
| `.frontmatter/lib/news-commands.cjs` | A mentés és a szöveg megnyitása a VS Code-ban |
| `.frontmatter/templates/hir-uj.md` | Emlékeztető a lépésekhez |
| `src/data/news-2026-27.yml` | Hírlista: cím, iskola, kép, tartalomazonosító |
| `src/content/common-news-content-2026-27.md` | Hírszövegek: `{{#ifequal hir "newsNN"}}` blokkok |
| `src/assets/img/hirfolyam/` | Hírképek |
| `src/helpers/filterNews.js` | A megfelelő iskola híreinek kiválasztása és a főoldali hírek rendezése |

## 1. Kép feltöltése

**A képet csak egyszer kell feltölteni.** A Media fül menti a képfájlt; a Data űrlap csak kiválasztja, melyik képet használja a hír.

1. `Ctrl+Shift+P` → **Front Matter: Open media dashboard**, vagy a dashboard **Media** füle. Az alapértelmezett médiamappa a `src/assets/img/hirfolyam/`.
2. Nyisd meg a **Windows Fájlkezelőt**, és onnan kezdd el a képfájl húzását a Media fül képeket mutató területére. **Húzás közben nyomd le és tartsd nyomva a Shift billentyűt.** Várd meg a Front Matter feltöltési jelzését (feltöltési nyíl és célmappa), majd **előbb az egérgombot engedd fel, és csak utána a Shiftet**. Várd meg a feltöltés visszajelzését. A Front Matter 10.13.0 ezen a felületen húzással fogad fájlokat; nincs külön „Add/Upload” fájlválasztó gomb.
3. `Ctrl+Shift+P` → **Front Matter: Refresh Front Matter Settings**. Ez újraolvassa a képmappát és frissíti a Data űrlap képválasztóját. A Media saját frissítőgombja csak a médiatárat frissíti.
4. Válts a **Data → Hírek 2026/2027** adatforrásra, és a **Hírkép** listából válaszd ki a fájlt. A legutóbb módosított képek kerülnek előre; a `nincs` választás kép nélküli hírt jelent.

Meglévő képhez csak a 4. lépés kell. Alternatív feltöltésként a fájlt közvetlenül a `src/assets/img/hirfolyam/` mappába is másolhatod, majd frissítsd a Front Matter beállításait.

**Ha a kép új szerkesztőlapon nyílik meg:** a rádobást a VS Code fájlmegnyitója kezelte. A kurzor melletti pluszjel önmagában még nem jelzi a Front Matter feltöltését. Térj vissza a Media fülre, és ismételd meg a húzást **végig nyomva tartott Shifttel**, a képeket mutató terület fölött. A VS Code a Shift hatására adja át a húzást a beágyazott felületnek; ezt a telepített 1.143.0 verzió kódja is megerősíti. Forrás: [VS Code húzáskezelő](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/webview/browser/webviewWindowDragMonitor.ts).

**Előbb töltsd fel a képet és frissítsd a listát, utána töltsd ki a hír űrlapját.** Ha már szerkesztettél egy hírt, mentsd el az **Add/Update** gombbal, mielőtt másik fülre váltasz vagy frissítesz. Ha a már megnyitott adatűrlapon még a régi lista látszik, zárd be az adatforrást, és válaszd ki újra.

Használj egyedi fájlnevet: a Media húzásos feltöltése az azonos nevű meglévő fájlt felülírhatja. A képválasztó a hírfotók mappájának közvetlen képfájljait mutatja; videókat, PSD-fájlokat és almappák tartalmát nem.

A Data nézetben nincs beépített képfeltöltő vagy bélyegképes médiaválasztó. A fájlnévlistát a projekt dinamikus konfigurációja állítja össze, így a fájlnevet nem kell kézzel beírnod. Forrás: [Media feltöltés](https://frontmatter.codes/docs/dashboard/media-view/#drag-and-drop), [dinamikus konfiguráció](https://frontmatter.codes/docs/settings/#extending-with-code).

**Ha a képválasztóban fehér szöveg jelenik meg fehér háttéren:** a projekt UI-kiegészítése a mező és a lenyíló lista szövegét és hátterét is a VS Code témájához igazítja. A javítás első betöltéséhez mentsd a folyamatban lévő szerkesztést, futtasd a **Front Matter: Refresh Front Matter Settings** parancsot, majd zárd be és nyisd meg újra a dashboard lapját. Ha még a régi színek látszanak, futtasd a **Developer: Reload Window** parancsot. A kiegészítést a `frontMatter.extensibility.scripts` beállítás tölti be; lásd a [Front Matter UI-bővítésének dokumentációját](https://frontmatter.codes/docs/ui-extensibility/).

## 2. Új bejegyzés a Data fülön

**Az automatikus ID-kiosztás első betöltése:** mentsd a módosított fájlokat, majd `Ctrl+Shift+P` → **Developer: Reload Window**. Ezután nyisd meg újra a Front Matter Dashboardot. A Tartalomazonosító mező csak olvasható; új hírnél a „Mentéskor automatikusan létrejön” felirat látszik benne.

1. Nyisd meg a **Data** fület, majd válaszd a **Hírek 2026/2027 (aktuális tanév)** adatforrást.
2. Új hírhez az üres hozzáadási űrlapot használd. Ha egy meglévő hírt választottál ki, előbb kattints az új bejegyzés hozzáadására vagy a **Cancel** gombra.
3. Töltsd ki a mezőket:

| Mező | Mit adj meg? |
|------|-------------|
| A hír címe | A megjelenő cím |
| Megjelenés (`site`) | `ps`: Petőfi / Székhely; `bs`: Bálint / Tagiskola; `common`: mindkettő |
| Hírkép (`img`) | Válassz a feltöltött képek listájából; kép nélkül `nincs` |
| Tartalomazonosító (`content`) | Automatikus, nem kell és nem lehet beírni; mentés után például `news08` |
| Kép igazítása | Általában `center` |
| Kép oszlopszélessége | Általában `medium-3` |
| Tartalom oszlopszélessége | Általában `medium-9` |

4. Kattints az **Add** gombra. Várd meg a **Mentve: newsNN. A szövegblokk elkészült.** visszajelzést. Meglévő hír mentéséhez az **Update** gombot használd; az azonosítója megmarad.
5. **Az új hír automatikusan legfelül jelenik meg.** A kiegészítés a Data listájának elejére menti. A két főoldal a `content` mező `newsNN` sorszáma szerint, csökkenő sorrendben rendezi a híreket (például `news100`, `news99`, `news98`). Nem kell kézzel áthúzni; a Data lista húzással módosított sorrendje nem változtatja meg a főoldali sorrendet.
A Data fül bal oldali bejegyzéslistája is ezt a legújabb-elöl sorrendet követi: a `content` sorszám szerint csökkenően (például news10, news07, news06), a még azonosító nélküli, frissen felvett bejegyzés legelöl, a sorszám nélküli régi bejegyzések pedig a lista végén. A sorrend mentés után automatikusan frissül; kézzel áthúzni nem kell.

A kiosztás minden mentéskor újraolvassa a tanévi YAML-listát és a tartalomfájlt, és a legnagyobb meglévő sorszám + 1 értéket használja. A két iskola és a közös hírek egy számsort használnak. A formátum `news01`…`news99`, majd `news100` stb. A törölt bejegyzés megmaradt szövegblokkja továbbra is foglalja a számát. Meglévő azonosítót a rendszer nem számoz át, a korábbi hibás azonosítókat sem javítja át magától.

Egymás után több hírt is felvehetsz beállításfrissítés nélkül. A mentés fájlzárral védi a kiosztást a másik VS Code-ablakból indított egyidejű mentéstől. Ha egy szerkesztett hírt közben máshol módosítottak, a mentés hibát jelez: nyisd meg újra az adatforrást, majd végezd el újra a módosítást. Ha a YAML vagy a szövegfájl megnyitott, nem mentett változtatást tartalmaz, előbb mentsd el azt.

A főoldalak a `filterNews` segédet `newestFirst=true` beállítással hívják. A meglévő hírek szerkesztése nem változtatja meg a sorrendet, amíg a sorszámuk változatlan. Az archív oldalak továbbra is a saját adatlistájuk sorrendjét követik.

Az **Add** a hírlista bejegyzését és az üres szövegblokkot is elkészíti. A szöveg kitöltéséhez folytasd a 3. lépéssel.

### Alternatíva: YAML snippet

Ha közvetlenül a fájlban dolgoznál, a kézi snippet továbbra is használható. Ez megkerüli az automatikus kiosztást: a YAML-ben és a szövegfájlban található legnagyobb szám + 1 azonosítót neked kell megadnod, mindkét helyen pontosan ugyanúgy.

1. Nyisd meg a `src/data/news-2026-27.yml` fájlt, és menj a legelejére (`Ctrl+Home`).
2. `Ctrl+Shift+P` → **Front Matter: Insert Snippet into your content** → **HIR - YAML bejegyzés (news-*.yml)**.
3. Töltsd ki a mezőket, majd szúrd be a bejegyzést a meglévő lista elé. Ezt a lépést ne végezd el újra, ha az adatűrlapon már hozzáadtad a hírt.

A YAML snippet `img` mezője továbbra is fájlnevet kér. A gépelés nélküli képválasztáshoz a **Data** űrlapot használd.

A fájl gyökerében közvetlenül lista található, **nincs `2026-27:` gyűjtőkulcs**. Példa:

```yaml
- site: ps
  title: Új hír címe
  img: ujhir.jpg
  align: center
  imgclass: medium-3
  contentclass: medium-9
  content: news07
```

A megjelenés helyét a `site` mező határozza meg. A régi bejegyzésekben megmaradt `school` és `id` mezőket nem kell kitöltened az új hírekhez. A korábbi tanévek `- ps:`, `- bs:` és `- common:` formátumát a hírszűrő továbbra is kezeli.

## 3. A hír szövege

1. A mentési visszajelzésben kattints a **Hír szövegének megnyitása** linkre. Ez a tanévi Markdown-fájl megfelelő `newsNN` blokkjához visz. Később a fájlt közvetlenül is megnyithatod.
2. A `<!-- Ide írd a hír szövegét. -->` megjegyzés helyére írd a hírt Markdown vagy HTML formátumban.
3. A blokk nyitó és záró sorát hagyd meg, majd mentsd a fájlt. Az azonosítót nem kell másolnod vagy újragépelned.

Ha a hírt a kézi YAML snippettel készítetted, az üres blokk nem jön létre automatikusan. Ilyenkor a fájl végén (`Ctrl+End`) használd a **Front Matter: Insert Snippet into your content → HIR - Tartalom blokk (common-news-content-*.md)** snippetet a YAML-ben megadott azonosítóval. Az Add által már létrehozott blokk mellé ne szúrj be másodikat ugyanazzal az ID-val.

Példa:

```handlebars
{{#ifequal hir "news07"}}

A hír szövege.

{{/ifequal}}
```

Táblázatos időpontlistákhoz használható a **HIR - Táblázat sor (időpontlistákhoz)** snippet is. A snippetek az aktív szerkesztő kurzorához szúrnak be; a célfájlt mindig neked kell megnyitnod.

## 4. Ellenőrzés

- `npm run ps` vagy `npm run bs`: előnézet és fájlfigyelés a kiválasztott iskolához.
- A hír a megfelelő iskola főoldalának tetején jelenjen meg; `common` esetén mindkettőn.
- Ellenőrizd a címet, a képet és a szöveget is.
- `npm run test:news`: a hírszűrés és a hírek tartalomkapcsolatainak automatikus ellenőrzése.
- `node --test tests/news-ids.test.cjs`: ID-kiosztás, egymás utáni és párhuzamos mentés, szerkesztési ütközés és hibás mentés ellenőrzése elkülönített tesztfájlokkal.

A **Content** fül „Create article” művelete önálló cikkfájlt készít, ezért ehhez a hírrendszerhez a **Data** űrlapot és a tartalomblokkot használd. Az emlékeztető sablon önmagában nem hoz létre hírt.

### Mentési hiba elhárítása

Ha nem érkezik mentési visszajelzés, előbb nyisd meg újra az adatforrást, és ellenőrizd, létrejött-e a hír. Ezután szükség esetén futtasd a **Developer: Reload Window** parancsot. A megoldás a projekt dinamikus konfigurációjával regisztrált VS Code-parancsot és a Front Matter által támogatott UI-scriptet használja; a telepített bővítmény fájljait nem módosítja.
Régi tünet: az Add gombra nem jött létre a hír. Ennek oka az volt, hogy a dashboard saját (ajv alapú) ellenőrzése az üres, automatikus `content` mezőt kötelező + mintaillesztési (`^news[0-9]{2,}$`) szabállyal utasította el, az érintetlen legördülő mezők pedig üres értéket küldtek a mentésnek. Most a `content` mező már nem kötelező és nincs mintaillesztési szabálya, az üresen hagyott mezők pedig a séma default-ját kapják mentéskor.

Ha az Add után a Data fül kiürült és elszürkült: a VS Code webview a programozott (szintetikus) kattintásokat eldobja (`isTrusted` hamis), ezért a korábbi `command:` hivatkozás nem a parancsot futtatta, hanem navigálta a nézetet. A mentés mostantól a Front Matter saját üzenethídján (`runCommand`) keresztül fut a bővítményben, így ez a hiba nem fordulhat elő.
Tartalék mentési út: ha a dashboard üzenethídja egy adott VS Code-verzióban nem elérhető, az űrlap nem blokkolja a dashboard saját mentését. Ekkor a bejegyzés a lista végére kerül üres azonosítóval, majd a bővítmény fájlfigyelője legfeljebb néhány másodperc alatt kiosztja a `newsNN` azonosítót, a lista **elére** mozgatja, és elkészíti a szövegblokkot. A visszajelzés ilyenkor VS Code-értesítésben jelenik meg („Hír létrehozva: newsNN…”), és a Data listát elég újra kiválasztani a friss állapotért. A korábban elszürkült lapot zárd be, és nyisd meg újra a dashboardot (szükség esetén **Developer: Reload Window**).

A `.frontmatter/runtime/` csak helyi visszajelzéseket és a folyamatban lévő mentés zárolását tartalmazza; Git nem követi. Ha a VS Code mentés közben összeomlik, megmaradhat a `news-2026-27.lock` fájl. Kizárólag az összes, ezt a projektet szerkesztő VS Code-ablak bezárása után töröld ezt a lock fájlt; normál működéskor automatikusan eltűnik.

## Ha a dashboard hibaoldalon maradt

Zárd be a Front Matter Dashboard lapját, majd nyisd meg újra. Ha továbbra is a régi állapot látszik: `Ctrl+Shift+P` → **Developer: Reload Window**, majd újra **Data → Hírek 2026/2027**.

A korábbi összeomlás oka a `frontMatter.data.files` bejegyzéséből hiányzó `schema` volt. A naplóban ez jelent meg: `Cannot use 'in' operator to search for '$ref' in undefined`. A fájllistához `singleEntry: false` és az egyes hírek mezőit leíró objektumséma szükséges. Lásd a [Front Matter adatnézetének dokumentációját](https://frontmatter.codes/docs/dashboard/datafiles-view/).

## Tanévváltás és archiválás

Új hírt csak az aktuális tanévbe készítünk. A Data fülön csak ez a tanév szerepel; a korábbi évek fájljait archiválás után nem szerkesztjük.

Tanévváltáskor manuálisan:

1. Hozd létre az új `src/data/news-2027-28.yml` fájlt, kezdetben `[]` tartalommal (üres lista, tanévi gyűjtőkulcs nélkül), valamint a `src/content/common-news-content-2027-28.md` fájlt.
2. Mindkét főoldalon (`src/pages/ps/index.html`, `src/pages/bs/index.html`) frissítsd a `year`, `newsData` és `mdFile` hivatkozásokat az új tanévre.
3. A `frontmatter.json` `frontMatter.data.files` bejegyzésében cseréld az `id`, `title` és `file` értékét. A `schema`, `labelField` és `singleEntry` beállítást tartsd meg. A YAML snippet leírásában is frissítsd a célfájlt; a snippeteknek nincs automatikus célfájl-választásuk.
4. Frissítsd ezt az útmutatót és a `.frontmatter/templates/hir-uj.md` emlékeztetőt.
5. A lezárt tanév YAML- és tartalomfájlját hagyd meg. Az archív oldalakat a `src/pages/{ps|bs}/regi_hirfolyamok/` alatt készítsd el, a korábbi év mintájára.
6. Frissítsd az archív hivatkozásokat a `src/partials/common-{ps|bs}-korabbi-hirek.html` és szükség szerint a `common-regi-hirfolyamok-nav.html` fájlban.
