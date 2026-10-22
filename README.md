# Homey tablet-dashboard

Een eigen dashboard voor Homey Pro dat je volledig op het scherm zelf indeelt: tegels toevoegen, verslepen, groter maken en instellen, zonder code aan te raken. De indeling past zich automatisch aan elk schermformaat aan, van telefoon tot liggende of staande tablet.

## Snel uitproberen (zonder Homey)

```bash
npm install
npm run demo
```

Open http://localhost:8080. Je krijgt een demo-indeling met nep-apparaten die live veranderen.

## Installeren op de server

1. Maak in de Homey web-app (my.homey.app) onder **Instellingen → API-sleutels** een nieuwe sleutel. Geef hem rechten om apparaten en zones te bekijken, apparaten te bedienen, flows te bekijken en te starten, en moods te gebruiken.
2. Kopieer `.env.example` naar `.env` en vul `HOMEY_ADDRESS`, `HOMEY_TOKEN` en eventueel `EDIT_PIN` in.
3. Start de container:

   ```bash
   docker compose up -d --build
   docker compose logs -f
   ```

   In de log moet `Verbonden, N apparaten gevolgd` verschijnen.

4. Voeg een route toe aan je Traefik `services.yml`:

   ```yaml
   http:
     routers:
       homey-dashboard:
         rule: "Host(`dashboard.example.nl`)"
         entryPoints: [websecure]
         tls: {}
         service: homey-dashboard
     services:
       homey-dashboard:
         loadBalancer:
           servers:
             - url: "http://homey-dashboard:8080"
   ```

   Pas `entryPoints` en de TLS-regel aan zoals je andere routes ze gebruiken. WebSockets werken via Traefik zonder extra instellingen.

**Netwerk:** de server moet de Homey kunnen bereiken op poort 80 (HTTP en de live-verbinding). Staat de Homey in een IoT-VLAN, sta dan verkeer van de server naar de Homey toe in de UniFi-firewall.

## Gebruik

- **Tikken** op een lamp of schakelaar zet hem aan of uit. **Lang indrukken** opent de bediening (helderheid, kleurtemperatuur, kleur).
- **Vegen** naar links of rechts wisselt van pagina.
- **Potlood rechtsboven** opent de bewerkmodus:
  - **Tegel toevoegen**: kies een apparaat, flow, mood, kop of klok. Het dashboard kiest zelf het passende tegeltype.
  - **Tikken op een tegel** opent de instellingen: naam, icoon, breedte en hoogte, apparaat, soort tegel, wat tikken en lang indrukken doen, vaste kleur, drempelkleuren, decimalen, eenheid en een voorwaarde om de tegel alleen te tonen in bepaalde situaties.
  - **Slepen** verplaatst een tegel.
  - **Instellingen** bevat thema, tegelgrootte, ruimte tussen tegels, pagina's, nachtdimmen, terugkeren naar de startpagina en export/import.
  - **Ongedaan maken** draait de laatste wijzigingen terug.

### Glasthema

Standaard staat het thema **Glas** aan: matglazen tegels boven een lucht die met het tijdstip meekleurt, van ochtendrood via blauw en teal overdag naar paars bij zonsondergang en diep indigo 's nachts. Een zachte zon (overdag) of maan ('s nachts) schuift langzaam van links naar rechts mee. Een lamp die aan staat wordt een heldere matwitte tegel waarvan het icoon gloeit in de echte lichtkleur, feller naarmate hij hoger gedimd is.

Is de tablet traag, zet dan in Instellingen "Minder vervaging" aan. De tegels worden dan iets dekkender en vervagen niet meer live, wat veel rekenkracht scheelt. De kleuren van de lucht pas je aan in de tabel `SKY` in `public/app.js`.

### Grafisch

- **Gekleurde iconen:** elk icoon krijgt automatisch een kleur per soort (lampen amber, energie geel, zon oranje, accu groen, temperatuur roze, deuren paars). Per tegel kun je een eigen kleur kiezen.
- **Minigrafiek:** waardetegels van 2 breed of hoog tonen een grafiek van de afgelopen 24 uur. Dit is aan of uit te zetten per tegel.
- **Meter:** een waardetegel kan als boogmeter worden getoond, met een instelbaar bereik. Een lamp van 2 hoog toont zijn helderheid als boog.
- **Grafiektegel:** tot 4 lijnen in één grafiek, over 6, 12, 24 of 48 uur.
- **Ruimtes:** een overzicht per Homey-zone met hoeveel lampen aan zijn, de temperatuur en beweging.
- **Zijpaneel:** op schermen vanaf 900 px breed staan links de klok, datum, weeknummer, het weer (Open-Meteo, vul een plaats in bij Instellingen) en de statusregels met minigrafiek. Op smallere schermen worden de statusregels een balk met chips bovenaan.
- **Statusregels:** zet bij een tegel het vinkje "Ook tonen in de statusbalk en het zijpaneel" aan.
- **Achtergronden:** Dagverloop, Aurora, Oceaan, Zonsondergang, Bos en Middernacht.

De geschiedenis voor grafieken wordt vanaf de eerste start opgebouwd (gemiddelde per 5 minuten 48 uur bewaard, gemiddelde per uur 30 dagen, in `data/history.json`). Een nieuwe grafiek vult zich dus vanzelf in de loop van de dag.

### Extra tegels (Tegel toevoegen → Overig, of via het type bij een apparaat)

- **Energiestroom:** geanimeerd schema van zon, net, accu en huis. De stippen lopen sneller naarmate er meer vermogen stroomt.
- **Apparaat:** wasmachine, droger, vaatwasser of printer met voortgangsring. Herkent "bezig" aan vermogen of voortgang en wordt groen met een melding als hij klaar is. Tik om af te vinken.
- **Groep:** meerdere lampen of stekkers in één tegel. Tikken schakelt de hele groep, lang indrukken geeft een lijst om los te schakelen.
- **Tijdlijn:** deuren, post, deurbel, apparaten die klaar zijn en eventueel beweging.
- **Onderhoud:** batterijen onder een drempel en apparaten die offline zijn.
- **Afstandsbediening:** TV, receiver, speakers en stofzuigrobot: aan/uit, volume, dempen, zenders, afspelen en robotcommando's.
- **Kosten vandaag:** stroom, teruglevering en gas in euro's op basis van je tarieven.

- **Energie vandaag:** opwek, verbruik, zelfvoorzienendheid, kosten en de verwachte jaarnota uit je energiedashboard. Zet daarvoor `ENERGY_URL` in `.env`.
- **Afvalkalender:** de komende ophaaldagen, met kleur per soort. Plak bij Instellingen de iCal-link van je gemeente. De avond ervoor en de ochtend zelf staat het ook in de statusbalk en het zijpaneel.
- **Aanwezigheid:** wie er thuis is volgens de Homey-app op de telefoons, met een knop voor een flow als iedereen weggaat. Geef de API-sleutel ook het recht om gebruikers te bekijken.

### Alarm, startpagina per tijdstip en langere grafieken

- **Alarm:** bij een waterlek, rook of koolmonoxide verschijnt een groot rood scherm met alarmgeluid, ook over de schermbeveiliging heen. Het geluid stopt na 2 minuten, het scherm blijft tot je op "Gezien" tikt. Uitproberen kan met "Test het alarm" bij Instellingen.
- **Startpagina per tijdstip:** geef een pagina bij Instellingen → Pagina's een tijdvak, bijvoorbeeld 18:00 tot 23:00. In die uren keert het dashboard daarnaar terug in plaats van naar de eerste pagina.
- **Grafieken tot 30 dagen:** naast de 5-minutenwaarden van 48 uur worden uurgemiddelden 30 dagen bewaard. Bij de eerste start worden ze aangevuld uit Homey Insights.

### Deurbel en schermbeveiliging (Instellingen)

- **Deurbel:** kies de camera van de deurbel en de waarde die verandert bij aanbellen (bij UniFi: "last_ring_at"). Bij aanbellen verschijnt een groot live beeld met belgeluid, ook als het scherm gedimd is of de schermbeveiliging aan staat. Met "Test de pop-up" probeer je het uit.
- **Schermbeveiliging:** een grote klok, een overzicht van de dag (opwek, verbruik, het weer van morgen en de volgende ophaaldag) of een fotolijst na een aantal minuten zonder aanraking, eventueel alleen 's nachts. Koppel voor foto's een map in `docker-compose.yml` aan `/app/photos`. De klok verschuift elke minuut een stukje tegen inbranden.

### Server

- **Homey Insights:** grafieken worden bij de start aangevuld met de geschiedenis die Homey zelf al bewaart, dus ze zijn meteen gevuld.
- **Beveiliging:** zie `.env.example`. Met `ALLOWED_NETWORKS` kom je alleen vanaf je eigen netwerken binnen. Met `DASH_USER`/`DASH_PASS` log je één keer per apparaat in. Zet achter Traefik `TRUST_PROXY=1`.
- **Back-ups:** zet `BACKUP_DIR` en koppel die map, bijvoorbeeld op de NAS. Er wordt dan dagelijks een kopie van de indeling gemaakt, en de laatste 30 blijven bewaard.
- **Health-check:** `/health` geeft status 200 als de Homey verbonden is en 503 als dat niet zo is. Docker gebruikt dit zelf, en je kunt het ook in Uptime Kuma of je eigen monitoring zetten.
- **App op de tablet:** het dashboard is te installeren via "Toevoegen aan startscherm" en opent dan schermvullend. Als de server even weg is verschijnt een rode melding, en de pagina herstelt zichzelf.

Alle wijzigingen worden direct opgeslagen in `data/layout.json` en live naar andere schermen gestuurd. De laatste 20 versies staan in `data/backups/`.

## Afvalkalender

De afvaltegel haalt de ophaaldagen automatisch uit de Homey-app **Trashcan Reminder** (com.trashchecker). Er hoeft dan niets ingevuld te worden. De API-sleutel moet daarvoor toegang hebben tot apps. Krijg je een melding dat de sleutel de app niet mag lezen, maak dan in de Homey web-app een nieuwe sleutel met dat recht en zet die in `.env`.

Vul je bij Instellingen een iCal-link van je gemeente in, dan gaat die voor.

## Live camerabeeld (go2rtc)

Homey levert van UniFi alleen momentopnames. Voor live beeld start `docker compose` ook de container **go2rtc**, die de RTSP-streams van UniFi Protect omzet naar beeld voor de browser.

1. **RTSP aanzetten:** zet in UniFi Protect per camera RTSP aan: camera > Instellingen > Geavanceerd > RTSP(S) > "Gemiddeld".
2. **Adressen invullen:** kopieer `go2rtc/go2rtc.example.yaml` naar `go2rtc/go2rtc.yaml` en plak de adressen daarin, zoals in dat bestand uitgelegd, en draai `docker compose up -d`.
3. **Testen:** open `http://<server>:1984` en klik bij een stream op "stream".
4. **Koppelen:** vul bij de camera-tegel de streamnaam in, bijvoorbeeld `deurbel`. Tikken op de camera opent dan live beeld, en de deurbel-pop-up toont live beeld. "Ook live in de tegel" kan per camera, maar is zwaarder voor de tablet.

Open je het dashboard via https, maak dan in Traefik een interne route naar `http://go2rtc:1984` en vul dat https-adres in bij Instellingen > "Adres van go2rtc". go2rtc heeft zelf geen wachtwoord.

## Tablet instellen

- **Android:** Fully Kiosk Browser met de URL van het dashboard. Zet "Keep screen on", "Launch on boot" en eventueel "Motion detection" aan.
- **iPad:** open de pagina in Safari, kies "Zet op beginscherm" en gebruik Begeleide toegang om de app vast te zetten.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `server.js` | Webserver, opslag van de indeling, WebSocket voor live updates |
| `lib/homey.js` | Verbinding met de Homey via de lokale Web API |
| `lib/mock.js` | Demo-apparaten voor uitproberen zonder Homey |
| `public/app.js` | Alle tegeltypes, bediening en de bewerkmodus |
| `public/live.js` | Live camerabeeld via go2rtc |
| `go2rtc/go2rtc.yaml` | De camerastreams voor go2rtc |
| `public/style.css` | Uiterlijk; kleuren staan bovenaan als variabelen |

Een nieuw tegeltype toevoegen doe je in `TYPES` in `public/app.js`: elk type heeft een `render`-functie en optioneel `tap`, `hold` en `popup`.

## Licentie

GPL-3.0, zie `LICENSE`. Het dashboard gebruikt de officiële bibliotheek `homey-api` van Athom, die ook onder GPL-3.0 valt.
