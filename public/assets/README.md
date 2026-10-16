# Grafiki serwisu

Tu wgrywasz oryginalne grafiki z gry (zastępują placeholdery automatycznie – bez zmian w kodzie).

| Katalog | Nazwa pliku | Przykład |
|---|---|---|
| `factions/` | `<slug-frakcji>.png` | `castle.png`, `rampart.png`, `tower.png`, `inferno.png`, `necropolis.png`, `dungeon.png`, `stronghold.png`, `fortress.png`, `conflux.png`, `cove.png`, `factory.png`, `bulwark.png` |
| `heroes/` | `<slug-bohatera>.png` | `orrin.png`, `crag-hack.png`, `sir-mullich.png`, `mutare-drake.png` |
| `ui/` | `corner.svg` / `corner.png` | ozdobny narożnik okien (zmień też `--corner-img` w `globals.css` przy PNG) |
| `ui/` | `banner.jpg` | baner strony głównej – w panelu ustaw adres `/grafika/ui/banner.jpg` |

Slug bohatera = imię małymi literami, spacje → `-` (lista w panelu: *Bohaterowie*).
Zalecane rozmiary: herby 64×64 lub 128×128, portrety 58×64 (oryginał gry) lub wielokrotność.
Lista plików jest odświeżana co minutę. W kontenerze katalog grafik to `ASSETS_DIR` (na Pterodactylu: `assets/` w menedżerze plików) – ten katalog jest tylko szablonem domyślnych plików.
