#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"
CONFIG_FILE="${SCRIPT_DIR}/test-weewx.conf"
DB_FILE="${SCRIPT_DIR}/sample-archive.sdb"

if [ ! -f "${DB_FILE}" ]; then
  echo "Error: ${DB_FILE} not found."
  exit 1
fi

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

cat > "${CONFIG_FILE}" <<EOF
WEEWX_ROOT = ${REPO_DIR}

[Station]
    location = "Knik-Fairview, Alaska"
    latitude = 61.5
    longitude = -149.5
    altitude = 71, meter
    station_type = Simulator
    station_url = https://zephos.xela.zone
    rain_year_start = 1
    week_start = 6

[Simulator]
    driver = weewx.drivers.simulator
    mode = simulator

[DatabaseTypes]
    [[SQLite]]
        driver = weedb.sqlite

[Databases]
    [[archive_sqlite]]
        database_name = ${DB_FILE}
        database_type = SQLite

[DataBindings]
    [[wx_binding]]
        database = archive_sqlite
        table_name = archive
        unit_system = US

[StdArchive]
    archive_interval = 300
    record_generation = software
    data_binding = wx_binding

[Engine]
    [[Services]]
        prep_services = weewx.engine.StdTimeSynch
        data_services = ,
        process_services = weewx.engine.StdConvert, weewx.engine.StdCalibrate, weewx.engine.StdQC, weewx.wxservices.StdWXCalculate
        xtype_services = weewx.wxxtypes.StdWXXTypes, weewx.wxxtypes.StdPressureCooker, weewx.wxxtypes.StdRainRater, weewx.wxxtypes.StdDelta
        archive_services = weewx.engine.StdArchive
        report_services = weewx.engine.StdPrint, weewx.engine.StdReport

[StdConvert]
    target_unit = US

[StdCalibrate]
    [[Corrections]]

[StdQC]
    [[MinMax]]

[StdReport]
    SKIN_ROOT = ${REPO_DIR}
    HTML_ROOT = ${OUTPUT_DIR}
    data_binding = wx_binding

    [[neowx-material]]
        skin = src
        HTML_ROOT = ${OUTPUT_DIR}
        enable = true
        [[[Extras]]]
            language = en
            color = indigo
            [[[[Appearance]]]]
                mode = auto
            [[[[Header]]]]
                earthquakes_nav_link = yes
            [[[[Footer]]]]
                name = "Test Station"
                show_about_data = yes
                show_earthquakes = yes
            [[[[Earthquakes]]]]
                enable = yes
                radius_km = 300
                min_magnitude = 2.5
                timespan_days = 7
EOF

WEECTL=$(which weectl 2>/dev/null || find /nix/store -maxdepth 3 -name weectl 2>/dev/null | grep -E 'weewx-[0-9]' | head -n1)
if [ -z "${WEECTL}" ]; then
    echo "ERROR: weectl not found in PATH or /nix/store"
    exit 1
fi

echo "==> Running ${WEECTL} report run neowx-material..."
"${WEECTL}" report run neowx-material --config="${CONFIG_FILE}"

echo "==> Report generated in ${OUTPUT_DIR}"
ls -lh "${OUTPUT_DIR}"/*.html | head -n 10
