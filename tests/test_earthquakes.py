import os
import pytest
from bs4 import BeautifulSoup

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
EARTHQUAKES_HTML = os.path.join(OUTPUT_DIR, "earthquakes.html")
INDEX_HTML = os.path.join(OUTPUT_DIR, "index.html")

def test_earthquakes_page_exists():
    assert os.path.exists(EARTHQUAKES_HTML), "earthquakes.html was not generated"

def test_earthquakes_data_attributes():
    with open(EARTHQUAKES_HTML, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    
    map_div = soup.find("div", {"id": "earthquake-map"})
    assert map_div is not None, "Missing #earthquake-map element"
    
    # Verify coordinates are valid floats
    lat = float(map_div["data-lat"])
    lon = float(map_div["data-lon"])
    radius = float(map_div["data-radius"])
    minmag = float(map_div["data-minmag"])
    timespan = int(map_div["data-timespan"])
    
    assert 60.0 <= lat <= 65.0, f"Unexpected latitude: {lat}"
    assert -155.0 <= lon <= -145.0, f"Unexpected longitude: {lon}"
    assert radius == 300.0
    assert minmag == 2.5
    assert timespan == 7

def test_nav_links():
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    
    nav_links = [a["href"] for a in soup.find_all("a", class_="nav-link")]
    assert "earthquakes.html" in nav_links, "Missing Earthquakes link in header navbar"

def test_footer_link():
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    
    footer_links = [a["href"] for a in soup.find_all("a") if a.get("href")]
    assert "earthquakes.html" in footer_links, "Missing Earthquakes link in footer"

def test_bundled_assets():
    leaflet_js = os.path.join(OUTPUT_DIR, "js", "vendor", "leaflet", "leaflet.js")
    leaflet_css = os.path.join(OUTPUT_DIR, "css", "vendor", "leaflet", "leaflet.css")
    earthquakes_js = os.path.join(OUTPUT_DIR, "js", "earthquakes.js")
    
    assert os.path.exists(leaflet_js), "leaflet.js not copied to output"
    assert os.path.exists(leaflet_css), "leaflet.css not copied to output"
    assert os.path.exists(earthquakes_js), "earthquakes.js not copied to output"
