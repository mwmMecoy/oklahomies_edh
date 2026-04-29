# Oklahomies EDH — Random Commander

Generates a random MTG commander with card art and details from Scryfall. 

Hosted on GitHub Pages.

###  Generate commander data

The site loads `data/commanders.json`, which is built from Scryfall's bulk data by the Python script.

```bash
pip install -r requirements.txt
python scripts/fetch_commanders.py
```

This downloads ~100 MB from Scryfall, filters for legendary creatures and cards with "can be your commander", and writes `data/commanders.json`. Re-run whenever you want updated card data.