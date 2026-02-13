#!/usr/bin/env python3
import re

# Read the YAML file
with open('src/data/gal_picts_ps_2024_25.yml', 'r', encoding='utf-8') as f:
    content = f.read()

# Replacement values in order
replacements = [
    'Tanévzáró',
    'Ballagás',
    'Kihívás napja',
    'LÜK vetélkedő',
    'Kihívás napja, Szent Gellért Fórum',
    'Robotika foglalkozás IV.',
    'Látogatás a Móra Ferenc múzeumban',
    'Madarak és fák napja',
    'Rumini foglalkozás',
    'Föld napja',
    'Iskolai szavalóverseny',
    'Robotika foglalkozás III.',
    'Papírgyűjtés',
    'Csendéletfestő verseny',
    'Költészet napja',
    '2025. 04. 06.',
    '6 osztály közösségépítés',
    'Robot rajzórán',
    'Víz világnapja',
    'Petőfisek kiscsillagai',
    'Robotika foglalkozás II.',
    'Kreatív matematikaóra',
    'Március 15. ünnepség',
    'Irodalmi vetélkedő',
    '1. osztály, páros munka',
    'Ovisok sakkoztak a Petőfiben',
    'Kreatív_angol_óra',
    'Buli az 5.osztályban',
    '5._osztály_színházlátogatás',
    'Járási_versenyek',
    'Farsangi táncház',
    'Parasport napja',
    'farsang',
    'Robotika foglalkozás I.',
    'KRÉTA idegennyelvű felkészítő modul',
    'Sakk palota',
    'Hóemberek világnapja',
    'Sakkpalota matematikaórán',
    'Harmadikosok a csokimatinén',
    'Sakkverseny',
    'Karácsony',
    'Egészségnap',
    'Aranytoll meseíró háziverseny',
    'Sakkpalota',
    'Hallowen 10.25.',
    'Iskolában az erdő',
    'Ovis szavalóverseny',
    'PÁV nap',
    'Európai Diáksport Nap',
    'Tappancs állateledelgyűjtés',
    'Szüreti piknik'
]

# Find all occurrences of 'xxx' in title fields
pattern = r"title: 'xxx'"
matches = list(re.finditer(pattern, content))

if len(matches) != len(replacements):
    print(f"Warning: Found {len(matches)} 'xxx' occurrences but have {len(replacements)} replacements")

# Replace from the end to avoid index shifting
for i, match in enumerate(reversed(matches)):
    idx = len(matches) - i - 1
    start, end = match.span()
    replacement = f"title: '{replacements[idx]}'"
    content = content[:start] + replacement + content[end:]

# Write back to file
with open('src/data/gal_picts_ps_2024_25.yml', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Successfully replaced {len(matches)} 'xxx' values with the provided titles.")