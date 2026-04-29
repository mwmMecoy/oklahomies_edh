# Oklahomies EDH — Random Commander

Generates a random MTG commander with card art and details from Scryfall. Filter by EDHREC rank to narrow the pool.

Hosted on GitHub Pages.

## Setup

### 1. Generate commander data

The site loads `data/commanders.json`, which is built from Scryfall's bulk data by the Python script.

```bash
pip install -r requirements.txt
python scripts/fetch_commanders.py
```

This downloads ~100 MB from Scryfall, filters for legendary creatures and cards with "can be your commander", and writes `data/commanders.json`. Re-run whenever you want updated card data.

### 2. Commit the data file

```bash
git add data/commanders.json
git commit -m "update commander data"
git push
```

### 3. Enable GitHub Pages

In the repo settings → Pages → set source to the `main` branch, root folder. The site will be available at `https://<username>.github.io/<repo>/`.

## Usage

- **Max EDHREC Rank** — enter a number to limit the pool to the top N most-popular commanders (e.g. `500` = top 500). Leave blank for all commanders.
- **Roll Commander** — picks a random commander from the current pool and displays the card image, oracle text, color identity, and links to Scryfall and EDHREC.

## Project structure

```
index.html               # single-page app
style.css
app.js
scripts/
  fetch_commanders.py    # generates data/commanders.json
data/
  commanders.json        # generated — not checked in by default
requirements.txt
```
