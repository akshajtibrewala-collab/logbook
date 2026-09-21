# CSV import & export

Open **Logbook → the swap icon (top right) → Import & export**.

## Export

Writes every flight to `logbook-YYYY-MM-DD.csv`, oldest first, using the template columns below. Times are decimal hours
with two decimals. The file can be imported back unchanged.

## Import

Pick a `.csv` (comma, tab or semicolon separated). You get a preview before anything is saved:

- **Ready** rows will be imported.
- **Duplicate** rows (same date, departure, arrival, tail number and total time as a flight already in your logbook, or
  earlier in the same file) are skipped unless you tick *Import duplicates anyway*.
- **Error** rows are never imported; the preview says why (bad date, unreadable time, category time larger than total
  time, and so on).

### Template columns

Header names are case-insensitive and ignore spaces and punctuation. `date` is the only required column; anything
missing is treated as 0 or blank.

| Column | Notes |
| --- | --- |
| `date` | `YYYY-MM-DD` (also `M/D/YYYY`; `D/M/YYYY` when the first number is over 12) |
| `departure_airport`, `arrival_airport` | 3–4 character ICAO/IATA codes |
| `route` | optional airports flown via, space separated (e.g. `KFYG`); they appear on the Map and Stats |
| `aircraft_type`, `tail_number` | free text (e.g. `C172`, `N123AB`) |
| `airline` | optional, for commercial flights (e.g. `Delta`, `UA`); shown as a badge |
| `total_time`, `pic_time`, `sic_time`, `dual_received`, `solo_time`, `night_time`, `instrument_actual`, `instrument_simulated`, `cross_country_time` | hours as `1.5` or `1:30`; none may exceed `total_time` |
| `day_landings`, `night_landings`, `approaches`, `holds` | whole numbers |
| `remarks` | free text |

A ready-made example is available from the **Download the template** link on the import screen.

### ForeFlight and LogTen

ForeFlight's "Logbook Import" CSV (with its *Aircraft Table* and *Flights Table* sections) is recognised: aircraft types
come from the aircraft table, `Approach1`–`Approach6` columns are counted as approaches, landings come from `AllLandings` (so touch-and-gos count), and the `Route` column becomes the via airports, and rows with the `FlightReview`
column set add a flight review on that date to the Dashboard. LogTen-style headers (`Aircraft ID`, `Actual Instrument`,
`Day Landings`, …) are matched by name. Columns this app has no field for are listed in the preview as not imported.

If a column you expected isn't picked up, rename its header to the template name above.
