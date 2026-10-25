'use strict';
/* Taal / Language
   De interface is in het Nederlands geschreven. Deze laag vertaalt alles wat op het scherm komt
   naar het Engels als die taal gekozen is: vaste teksten via een woordenlijst, teksten met getallen
   of namen via patronen. Namen die je zelf geeft (tegels, pagina's, apparaten) worden nooit vertaald.
   Datums en getallen volgen de gekozen taal via LOCALE. */

// Wordt door de rest van de code gebruikt voor datums en getallen
var LOCALE = 'nl-NL';

const I18N = (() => {
  const EN = {
    // Algemeen en knoppen
    'Aan': 'On', 'Uit': 'Off', 'Aanzetten': 'Turn on', 'Uitzetten': 'Turn off', 'Annuleren': 'Cancel', 'Sluiten': 'Close',
    'Klaar': 'Done', 'Klaar!': 'Done!', 'Verwijderen': 'Delete', 'Dupliceren': 'Duplicate', 'Uitvoeren': 'Run', 'Ontgrendelen': 'Unlock',
    'Bewerken': 'Edit', 'Dashboard bewerken': 'Edit dashboard', 'Instellingen': 'Settings', 'Ongedaan maken': 'Undo',
    'Tegel toevoegen': 'Add tile', 'Tegel instellen': 'Tile settings', 'Tegel verwijderd': 'Tile deleted', 'Geen': 'None', 'Niets': 'Nothing',
    'Details': 'Details', 'Bediening': 'Controls', 'Standaard': 'Default', 'Automatisch': 'Automatic', 'Auto': 'Auto', 'Fout': 'Error',
    'Exporteren': 'Export', 'Importeren': 'Import', 'Indeling geïmporteerd': 'Layout imported', 'Zoeken': 'Search', 'Tonen': 'Show',
    'Weet je het zeker?': 'Are you sure?', 'Voer de pincode in': 'Enter the PIN', 'Onjuiste pincode': 'Incorrect PIN',
    'Pincode nodig om te bewerken': 'PIN required to edit', 'Niets meer om ongedaan te maken': 'Nothing left to undo',
    'Laden…': 'Loading…', 'Verbinding': 'Connection', 'Gezien': 'Seen', 'Test de pop-up': 'Test the pop-up', 'Test het alarm': 'Test the alarm',
    'Demo-modus: er is nog geen Homey gekoppeld': 'Demo mode: no Homey connected yet',
    'Geen verbinding met de server, opnieuw verbinden…': 'No connection to the server, reconnecting…',
    'Bewerksessie verlopen. Tik op Klaar en daarna op het potlood om de pincode opnieuw in te voeren': 'Edit session expired. Tap Done, then the pencil to enter the PIN again',
    'Dit is geen dashboard-bestand': 'This is not a dashboard file', 'Er moet minstens één pagina blijven': 'At least one page must remain',
    'Deze pagina is nog leeg': 'This page is still empty',
    'Tik op het potlood rechtsboven om lampen, sensoren en flows toe te voegen.': 'Tap the pencil at the top right to add lights, sensors and flows.',
    'Onbekend type': 'Unknown type', 'Apparaat niet gevonden': 'Device not found', 'Homey is niet verbonden': 'Homey is not connected',
    'Homey is (nog) niet verbonden': 'Homey is not connected (yet)',

    // Tegel toevoegen
    'Apparaten': 'Devices', 'Flows': 'Flows', 'Moods': 'Moods', 'Overig': 'Other', 'Flow': 'Flow', 'Advanced flow': 'Advanced flow',
    'Geen apparaten gevonden.': 'No devices found.', 'Geen moods gevonden.': 'No moods found.',
    'Geen startbare flows. Een flow verschijnt hier als hij een "Deze flow is gestart"-kaart heeft.': 'No startable flows. A flow appears here when it has a "This flow is started" card.',
    'Kop': 'Heading', 'Nieuwe kop': 'New heading', 'Tekst over de volle breedte om tegels te groeperen': 'Full-width text to group tiles',
    'Klok': 'Clock', 'Tijd en datum': 'Time and date', 'Grafiek': 'Chart', 'Verloop van één of meer waarden, bijvoorbeeld net en zon': 'History of one or more values, for example grid and solar',
    'Ruimtes': 'Rooms', 'Overzicht per ruimte: lampen aan en temperatuur': 'Overview per room: lights on and temperature',
    'Energiestroom': 'Energy flow', 'Geanimeerd schema: zon, net, accu en huis': 'Animated diagram: solar, grid, battery and house',
    'Groep': 'Group', 'Meerdere lampen of stekkers in één tegel': 'Several lights or plugs in one tile',
    'Tijdlijn': 'Timeline', 'Wat er in huis gebeurde: deuren, post, apparaten, deurbel': 'What happened at home: doors, mail, appliances, doorbell',
    'Onderhoud': 'Maintenance', 'Batterijen die bijna leeg zijn en apparaten die offline zijn': 'Batteries running low and devices that are offline',
    'Afstandsbediening': 'Remote control', 'Kosten vandaag': "Today's costs", 'Energie vandaag': 'Energy today',
    'Opwek, verbruik, kosten en de jaarnota uit je energiedashboard': 'Production, consumption, costs and annual bill from your energy dashboard',
    'Afvalkalender': 'Waste calendar', 'Wanneer welke container aan de straat moet': 'When which bin goes out',
    'Aanwezigheid': 'Presence', 'Wie er thuis is, met een knop voor als iedereen weggaat': "Who's home, with a button for when everyone leaves",
    'Flow starten': 'Start flow', 'Mood': 'Mood', 'Knop': 'Button', 'Camera': 'Camera',

    // Tegeltypes
    'Lamp': 'Light', 'Schakelaar': 'Switch', 'Waarde': 'Value', 'Thermostaat': 'Thermostat', 'Zonwering': 'Blinds', 'Apparaat': 'Appliance',

    // Tegelinstellingen
    'Naam': 'Name', 'Icoon': 'Icon', 'Icoon kiezen': 'Choose icon', 'Icoon zoeken': 'Search icon', 'Breedte': 'Width', 'Hoogte': 'Height',
    'Volle rij': 'Full row', 'Soort tegel': 'Tile type', 'Kies een apparaat': 'Choose a device', 'Bij tikken': 'On tap',
    'Bij lang indrukken': 'On long press', 'Aan/uit': 'On/off', 'Kleur als hij aan is': 'Colour when on',
    'Vaste kleur gebruiken in plaats van de lichtkleur': 'Use a fixed colour instead of the light colour',
    'Tweede waarde (klein, rechtsboven)': 'Second value (small, top right)', 'Tekst bij waar': 'Text when true', 'Tekst bij onwaar': 'Text when false',
    'Decimalen': 'Decimals', 'Eenheid': 'Unit', 'Kleuren bij drempels': 'Threshold colours', 'Drempel toevoegen': 'Add threshold',
    'De laatste drempel die klopt bepaalt de kleur. Voor aan/uit-waarden gebruik je "=" met aan of uit.': 'The last matching threshold sets the colour. For on/off values use "=" with on or off.',
    'Stapgrootte': 'Step size', 'Eerst om bevestiging vragen': 'Ask for confirmation first', 'Datum tonen': 'Show date',
    'Alleen tonen als': 'Only show when', 'Laat leeg om de tegel altijd te tonen. Verborgen tegels zie je in bewerkmodus doorschijnend.': 'Leave empty to always show the tile. Hidden tiles appear transparent in edit mode.',
    'Weergave': 'Display', 'Getal': 'Number', 'Meter (boog)': 'Gauge (arc)', 'Meter van': 'Gauge from', 'Meter tot': 'Gauge to',
    'Grafiek van de afgelopen 24 uur tonen': 'Show a chart of the last 24 hours', 'Periode': 'Period', 'Stijl': 'Style', 'Vlak': 'Area', 'Lijn': 'Line',
    'Lijnen': 'Lines', 'Lijn toevoegen': 'Add line', 'Naam in de legenda': 'Name in the legend', 'Eenheid op de as': 'Axis unit',
    '6 uur': '6 hours', '12 uur': '12 hours', '24 uur': '24 hours', '48 uur': '48 hours', '7 dagen': '7 days', '30 dagen': '30 days',
    'Welke ruimtes tonen': 'Rooms to show', 'Geen ruimtes gevonden': 'No rooms found', 'Kleur van het icoon': 'Icon colour',
    'Eigen kleur in plaats van automatisch': 'Custom colour instead of automatic', 'Ook tonen in de statusbalk en het zijpaneel': 'Also show in the status bar and side panel',
    'Beeld verversen elke': 'Refresh picture every', 'Live-stream (naam in go2rtc)': 'Live stream (name in go2rtc)',
    'Ook live in de tegel (kost meer van de tablet)': 'Also live in the tile (heavier for the tablet)',
    'Leeg laten: alleen momentopnames. Ingevuld: tikken opent live beeld.': 'Empty: snapshots only. Filled in: tapping opens live video.',
    'bijvoorbeeld deurbel': 'for example doorbell', 'aan, 20, ...': 'on, 20, ...', 'Tekst op de knop': 'Button text', 'Geen knop': 'No button',
    'Flow onder de knop (bijvoorbeeld alles uit en alarm aan)': 'Flow behind the button (for example all off and alarm on)',
    'Aantal ophaaldagen': 'Number of collection days', 'Verwachte jaarnota tonen': 'Show expected annual bill',
    'Vermogen (om te zien of hij draait)': 'Power (to see if it is running)', 'Voortgang in procent (optioneel)': 'Progress in percent (optional)',
    'Resterende tijd (optioneel)': 'Remaining time (optional)', 'Draait boven (W)': 'Running above (W)', 'Klaar na (minuten stil)': 'Done after (minutes idle)',
    'Als hij klaar is, wordt de tegel groen en komt er een melding in de tijdlijn. Tik op de tegel om hem weer op "Uit" te zetten.': 'When it is done, the tile turns green and a notice appears in the timeline. Tap the tile to set it back to "Off".',
    'Kleur als er iets aan is': 'Colour when something is on', 'Kies apparaten in de instellingen': 'Choose devices in the settings',
    'Batterij tonen onder (%)': 'Show batteries below (%)', 'Net (positief = afname)': 'Grid (positive = import)', 'Zonnepanelen': 'Solar panels',
    'Thuisaccu: vermogen': 'Home battery: power', 'Laadniveau': 'Charge level', 'Accu geeft negatief bij laden (omdraaien)': 'Battery reports negative when charging (invert)',
    'Afgenomen vandaag (kWh)': 'Imported today (kWh)', 'Teruggeleverd vandaag (kWh)': 'Exported today (kWh)', 'Gas vandaag (m³)': 'Gas today (m³)',
    '€ per kWh': '€ per kWh', '€ terug': '€ export', '€ per m³': '€ per m³',
    'Tarieven inclusief belastingen en btw. Bij salderen is "terug" gelijk aan je stroomprijs.': 'Rates including taxes and VAT. With net metering, "export" equals your electricity price.',
    'Vul je tarieven in bij de instellingen van deze tegel': 'Enter your rates in the settings of this tile',
    'Kies in de instellingen wat je wilt zien': 'Choose what to show in the settings',

    // Algemene instellingen
    'Titel van het dashboard': 'Dashboard title', 'Linksboven tonen': 'Show at top left', "Pagina's hernoem je verderop onder Pagina's.": "Rename pages further down under Pages.",
    'Thema': 'Theme', 'Glas': 'Glass', 'Volgt apparaat': 'Follow device', 'Donker': 'Dark', 'Licht': 'Light',
    'Achtergrond': 'Background', 'Achtergrond (bij Glas)': 'Background (with Glass)', 'Dagverloop': 'Time of day', 'Aurora': 'Aurora', 'Oceaan': 'Ocean',
    'Zonsondergang': 'Sunset', 'Bos': 'Forest', 'Middernacht': 'Midnight', 'Of een eigen afbeelding: https://...': 'Or your own image: https://...',
    'Minder vervaging (sneller op eenvoudige tablets)': 'Less blur (faster on basic tablets)',
    'Het aantal kolommen past zich automatisch aan de schermbreedte aan. Grotere tegels betekent minder kolommen.': 'The number of columns adapts to the screen width. Larger tiles mean fewer columns.',
    'Klok in de bovenbalk': 'Clock in the top bar', 'Zijpaneel op brede schermen': 'Side panel on wide screens', 'Statusbalk op smalle schermen': 'Status bar on narrow screens',
    'Terug naar eerste pagina na (seconden, 0 = nooit)': 'Back to the first page after (seconds, 0 = never)',
    'Scherm \'s nachts dimmen': 'Dim the screen at night', "Scherm 's nachts dimmen": 'Dim the screen at night', 'Hoeveel donkerder (0 tot 0,95)': 'How much darker (0 to 0.95)',
    'Van, tot, en hoeveel donkerder. Aanraken maakt het scherm een minuut helder.': 'From, to, and how much darker. Touching makes the screen bright for a minute.',
    "Pagina's": 'Pages', 'Pagina': 'Page', 'Pagina toevoegen': 'Add page', 'Pagina verwijderen': 'Delete page', 'Naam van de pagina': 'Page name',
    'Naar voren': 'Move up', 'Startpagina van': 'Start page from', 'Startpagina tot': 'Start page until', 'Startpagina vanaf': 'Start page from',
    'Met "Startpagina van ... tot" wordt een pagina in die uren de startpagina, bijvoorbeeld \'s avonds een pagina met lampen en tv. Zonder tijden is de eerste pagina de startpagina.': 'With "Start page from ... until" a page becomes the start page during those hours, for example a page with lights and TV in the evening. Without times, the first page is the start page.',
    'Back-up': 'Backup', 'Plaats voor het weer': 'Location for the weather', 'Bijvoorbeeld Utrecht (leeg = geen weer)': 'For example London (empty = no weather)',
    'Afvalkalender (iCal-link, optioneel)': 'Waste calendar (iCal link, optional)', 'https://... of webcal://...': 'https://... or webcal://...',
    'Leeg laten: de ophaaldagen komen uit de Homey-app Trashcan Reminder. Een iCal-link van je gemeente gaat daar voor.': 'Leave empty: collection days come from the Homey app Trashcan Reminder. An iCal link from your municipality takes precedence.',
    'Deurbel': 'Doorbell', 'Waaraan zie je dat er gebeld is': 'Value that changes when someone rings', 'Belgeluid op de tablet': 'Chime on the tablet',
    'Schermbeveiliging': 'Screensaver', "Foto's": 'Photos', 'Overzicht': 'Overview', 'Na (minuten)': 'After (minutes)', 'Foto wisselen (sec)': 'Change photo (sec)',
    'Alleen tijdens de nachttijden van het dimmen': 'Only during the night dimming hours',
    "Foto's komen uit de map die je in docker-compose koppelt aan /app/photos.": 'Photos come from the folder you mount to /app/photos in docker-compose.',
    'Alarm (waterlek, rook, koolmonoxide)': 'Alarm (water leak, smoke, carbon monoxide)', 'Groot rood scherm op de tablet': 'Large red screen on the tablet',
    'Met alarmgeluid': 'With alarm sound', 'Adres van go2rtc (live camerabeeld)': 'go2rtc address (live camera video)',
    'Leeg laten is goed als je het dashboard via het IP-adres van de server opent. Via https (Traefik)? Vul dan het https-adres van go2rtc in.': 'Leave empty if you open the dashboard via the server\'s IP address. Using https (Traefik)? Enter the https address of go2rtc.',
    'Aanwezigheid komt van de Homey-app op de telefoons. De API-sleutel moet het recht hebben om gebruikers te bekijken.': 'Presence comes from the Homey app on the phones. The API key needs permission to view users.',
    'Koppel je energiedashboard met ENERGY_URL in .env': 'Connect your energy dashboard with ENERGY_URL in .env',
    'Alle cijfers komen uit je energiedashboard, dus met jouw contract en tarieven.': 'All figures come from your energy dashboard, with your own contract and rates.',
    'Zoek een icoon, bijv. keuken, slaapkamer, auto': 'Search an icon, e.g. kitchen, bedroom, car',
    'Verlichting': 'Lighting', 'Energie en klimaat': 'Energy and climate', 'Beveiliging': 'Security', 'Media en apparaten': 'Media and devices',

    'Tegelgrootte:': 'Tile size:', 'Ruimte tussen tegels:': 'Space between tiles:', 'px': 'px',

    // Waarden en toestanden
    'Open': 'Open', 'Dicht': 'Closed', 'Beweging': 'Motion', 'Rustig': 'Quiet', 'Rook!': 'Smoke!', 'Lek!': 'Leak!', 'Droog': 'Dry',
    'Sabotage': 'Tamper', 'Batterij laag': 'Battery low', 'Alarm': 'Alarm', 'OK': 'OK', 'Post!': 'Mail!', 'Trilling': 'Vibration', 'Post': 'Mail',
    'Bezig': 'Running', 'Kleur': 'Colour', 'Helderheid': 'Brightness', 'Kleurtemperatuur': 'Colour temperature', 'Verzadiging': 'Saturation',
    'Positie': 'Position', 'Doeltemperatuur': 'Target temperature', 'Omhoog': 'Up', 'Omlaag': 'Down', 'Stop': 'Stop',
    'Zachter': 'Quieter', 'Harder': 'Louder', 'Zender +': 'Channel +', 'Zender -': 'Channel -', 'Vorige': 'Previous', 'Volgende': 'Next',
    'Afspelen/pauze': 'Play/pause', 'Dempen': 'Mute', 'Volume': 'Volume', 'Schoonmaken': 'Clean', 'Snel': 'Quick', 'Pauze': 'Pause', 'Verder': 'Resume',
    'Naar dock': 'To dock', 'Terug naar dock': 'Returning to dock', 'Opgeladen': 'Charged', 'Opladen': 'Charging', 'Gestopt': 'Stopped',
    'Gepauzeerd': 'Paused', 'Vast!': 'Stuck!', 'Slaapt': 'Sleeping', 'Idle': 'Idle',
    'Lamp aan': 'Light on', 'Lampen aan': 'Lights on', 'Alles uit': 'All off', 'Iedereen thuis': 'Everyone home', 'Iedereen weg': 'Everyone away',
    'Niemand thuis': 'Nobody home', 'Weg': 'Away', 'Thuis': 'Home', 'Geen gebruikers': 'No users',
    'Nog geen ruimtes gevonden': 'No rooms found yet', 'Nog niets gebeurd': 'Nothing has happened yet', 'Geen beeld': 'No picture',
    'Er wordt aangebeld': 'Someone is at the door', 'Er werd aangebeld': 'Someone rang the doorbell', 'Post in de brievenbus': 'Mail in the letterbox',
    'Kies bij Instellingen welke camera bij de deurbel hoort.': 'Choose the doorbell camera in the settings.',
    'Tik om los te schakelen': 'Tap to switch individually', 'Alles in orde': 'All good', 'zojuist': 'just now', 'laag': 'low', 'offline': 'offline',

    // Energie
    'Zon': 'Solar', 'Accu': 'Battery', 'Laden': 'Charging', 'Ontladen': 'Discharging', 'Afname': 'Import', 'Teruglevering': 'Export',
    'Verbruik huis': 'House consumption', 'Verbruik': 'Consumption', 'Opwek': 'Production', 'Zelfvoorzienend': 'Self-sufficient',
    'Stroom afgenomen': 'Electricity imported', 'Teruggeleverd': 'Exported', 'Gas': 'Gas', 'Vandaag': 'Today', 'Morgen': 'Tomorrow',
    'opgewekt vandaag': 'produced today', 'verbruikt vandaag': 'used today', 'afname': 'import', 'terug': 'export',

    // Weer
    'Helder': 'Clear', 'Overwegend helder': 'Mostly clear', 'Half bewolkt': 'Partly cloudy', 'Bewolkt': 'Cloudy', 'Mist': 'Fog',
    'Motregen': 'Drizzle', 'Lichte regen': 'Light rain', 'Regen': 'Rain', 'Zware regen': 'Heavy rain', 'Lichte sneeuw': 'Light snow',
    'Sneeuw': 'Snow', 'Zware sneeuw': 'Heavy snow', 'Buien': 'Showers', 'Zware buien': 'Heavy showers', 'Onweer': 'Thunderstorm',
    'Goedemorgen': 'Good morning', 'Goedemiddag': 'Good afternoon', 'Goedenavond': 'Good evening', 'Goedenacht': 'Good night',

    // Afval
    'GFT': 'Organic', 'Papier': 'Paper', 'PMD': 'Plastic & cans', 'Textiel': 'Textiles', 'Kerstboom': 'Christmas tree',
    'Snoeiafval': 'Garden waste', 'Grofvuil': 'Bulky waste', 'Chemisch afval': 'Chemical waste', 'Restafval': 'Residual waste',
    'Geen ophaaldagen gevonden': 'No collection days found', 'morgen aan de straat': 'out tomorrow', 'vandaag aan de straat': 'out today',
    'Waterlek': 'Water leak', 'Deuren': 'Doors',
  };

  const W = (s) => EN[s] ?? s;
  // Teksten met getallen of namen erin
  const PATTERNS = [
    [/^(\d+) van (\d+) aan$/, (m, a, b) => `${a} of ${b} on`],
    [/^(\d+) van (\d+) thuis$/, (m, a, b) => `${a} of ${b} home`],
    [/^(\d+) min geleden$/, (m, a) => `${a} min ago`],
    [/^nog (.+)$/, (m, a) => `${a} left`],
    [/^(.+), duurde (\d+) min$/, (m, a, b) => `${tr(a)}, took ${b} min`],
    [/^duurde (\d+) min$/, (m, a) => `took ${a} min`],
    [/^(\d+)% open$/, (m, a) => `${a}% open`],
    [/^(\d+)% warm$/, (m, a) => `${a}% warm`],
    [/^Ingesteld op (.+)$/, (m, a) => `Set to ${a}`],
    [/^Nu (.+)$/, (m, a) => `Now ${a}`],
    [/^Week (\d+)$/, (m, a) => `Week ${a}`],
    [/^Pagina (\d+)$/, (m, a) => `Page ${a}`],
    [/^(.+) gestart$/, (m, a) => `${a} started`],
    [/^(.+) ingedrukt$/, (m, a) => `${a} pressed`],
    [/^(.+) ingesteld$/, (m, a) => `${a} set`],
    [/^(.+) gemarkeerd als uitgeruimd$/, (m, a) => `${a} marked as emptied`],
    [/^(.+) is klaar$/, (m, a) => `${a} is done`],
    [/^Beweging: (.+)$/, (m, a) => `Motion: ${a}`],
    [/^Trilling: (.+)$/, (m, a) => `Vibration: ${a}`],
    [/^Waterlek bij (.+)!$/, (m, a) => `Water leak at ${a}!`],
    [/^Rookmelder (.+)!$/, (m, a) => `Smoke detector ${a}!`],
    [/^(.+) open$/, (m, a) => `${a} opened`],
    [/^(.+) dicht$/, (m, a) => `${a} closed`],
    [/^Niet gelukt: (.+)$/, (m, a) => `Failed: ${tr(a)}`],
    [/^Opslaan mislukt: (.+)$/, (m, a) => `Saving failed: ${tr(a)}`],
    [/^Weer niet beschikbaar: (.+)$/, (m, a) => `Weather unavailable: ${a}`],
    [/^Niets gevonden voor "(.+)"\. Probeer een ander woord, ook Engels werkt\.$/, (m, a) => `Nothing found for "${a}". Try another word.`],
    [/^"(.+)" en de (\d+) tegels erop verwijderen\?$/, (m, a, b) => `Delete "${a}" and its ${b} tiles?`],
    [/^(.+) \(avond\)$/, (m, a) => `${W(a)} (evening)`],
    [/^Morgen: (.+)$/, (m, a) => `Tomorrow: ${a.split(', ').map(W).join(', ')}`],
    [/^Vandaag: (.+)$/, (m, a) => `Today: ${a.split(', ').map(W).join(', ')}`],
    [/^(\d+) eigenschappen$/, (m, a) => `${a} properties`],
    [/^(.+), (\d+) eigenschappen$/, (m, a, b) => `${W(a)}, ${b} properties`],
    [/^Apparaten \((\d+) gekozen\)$/, (m, a) => `Devices (${a} selected)`],
    [/^Naam van pagina (\d+)$/, (m, a) => `Name of page ${a}`],
    [/^verwacht, dag (\d+) van (\d+)$/, (m, a, b) => `expected, day ${a} of ${b}`],
    [/^(Laden|Ontladen|Accu) · (.+)$/, (m, a, b) => `${W(a)} · ${b}`],
    [/^(\d\d:\d\d), dit is een test$/, (m, a) => `${a}, this is a test`],
  ];

  function tr(s) {
    if (LANG === 'nl' || typeof s !== 'string') return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const core = s.trim();
    if (!core) return s;
    if (core in EN) return lead + EN[core] + trail;
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) return lead + fn(...m) + trail;
    }
    return s;
  }

  // Namen die de gebruiker zelf geeft: nooit vertalen
  const SKIP = '.tile .label, .room-name, .mt-name, .page-tab span, .lg, .pick .meta > div:first-child, #dashTitle, .stat-txt span, .chip span:not(.chip-ic), .popup h3, script, style, .cam-bar .label, .group-list .meta div:first-child, [data-noi18n]';

  let LANG = 'nl';
  const ATTRS = ['placeholder', 'title', 'aria-label'];

  function translateNode(root) {
    if (LANG === 'nl' || !root) return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest(SKIP)) return;
    for (const a of ATTRS) if (root.hasAttribute?.(a)) setAttr(root, a);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.nodeType === 1 && n.matches(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateText(n);
      else for (const a of ATTRS) if (n.hasAttribute(a)) setAttr(n, a);
    }
  }
  // Onthoud de Nederlandse tekst, zodat terugschakelen alles herstelt
  const touched = new Set();
  function remember(node, key, value) {
    node.__nl = node.__nl || {};
    node.__nl[key] = value;
    touched.add(new WeakRef(node));
  }
  function setAttr(el, a) {
    const v = el.getAttribute(a), o = tr(v);
    if (o !== v) { remember(el, a, v); el.setAttribute(a, o); }
  }
  function translateText(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    const v = node.nodeValue, o = tr(v);
    if (o !== v) { remember(node, '#text', v); node.nodeValue = o; }
  }
  function restore() {
    for (const ref of touched) {
      const n = ref.deref();
      if (!n || !n.__nl) continue;
      for (const [k, v] of Object.entries(n.__nl)) {
        if (k === '#text') n.nodeValue = v; else n.setAttribute(k, v);
      }
      delete n.__nl;
    }
    touched.clear();
  }

  const observer = new MutationObserver(muts => {
    if (LANG === 'nl') return;
    for (const m of muts) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  });

  function detect() {
    return (navigator.language || 'nl').toLowerCase().startsWith('nl') ? 'nl' : 'en';
  }

  function apply(lang) {
    const next = lang === 'en' ? 'en' : 'nl';
    const changed = next !== LANG;
    LANG = next;
    LOCALE = LANG === 'en' ? 'en-GB' : 'nl-NL';
    document.documentElement.lang = LANG;
    if (LANG === 'en') {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      translateNode(document.body);
    } else { observer.disconnect(); restore(); }
    return changed;
  }

  return { tr, apply, detect, get lang() { return LANG; } };
})();
const tr = I18N.tr;

// Bevestigingsvensters van de browser ook vertalen
(() => { const c = window.confirm.bind(window); window.confirm = msg => c(tr(msg)); })();

// Taal toepassen zodra de indeling er is, en een taalkeuze in Instellingen
document.addEventListener('DOMContentLoaded', () => {
  const current = () => S.layout?.settings?.language || I18N.detect();
  let lastApplied = null;
  const sync = () => {
    const lang = current();
    if (lang === lastApplied) return;
    lastApplied = lang;
    const changed = I18N.apply(lang);
    if (changed && S.layout) { try { applySettings(); renderAll(); } catch { /* nog niet klaar */ } }
  };
  // Na het laden van de indeling en bij elke wijziging (ook vanaf een ander scherm)
  const iv = setInterval(() => { if (S.layout) sync(); }, 500);
  setTimeout(() => clearInterval(iv), 30000);
  if (typeof EXTRA !== 'undefined') {
    EXTRA.msgHandlers.push(m => { if (m.type === 'layout' || m.type === 'snapshot') setTimeout(sync, 50); });
    const og = EXTRA.globalSettingsHtml, oi = EXTRA.onGlobalInput, ob = EXTRA.bindGlobal;
    EXTRA.globalSettingsHtml = s => `<div class="field" data-noi18n><span class="flabel">${I18N.lang === 'en' ? 'Language' : 'Taal'}</span>
        <div class="seg" data-seg="x_lang">
          <button type="button" data-v="nl" class="${current() === 'nl' ? 'sel' : ''}">Nederlands</button>
          <button type="button" data-v="en" class="${current() === 'en' ? 'sel' : ''}">English</button></div></div>` + (og ? og(s) : '');
    EXTRA.onGlobalInput = (e, n, s) => oi ? oi(e, n, s) : false;
    EXTRA.bindGlobal = (body, s) => {
      ob?.(body, s);
      body.querySelector('[data-seg="x_lang"]')?.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        e.stopImmediatePropagation();
        s.language = b.dataset.v;
        save(true);
        sync();
        openGlobalSettings();
      }, true);
    };
  }
});
