import requests
import json
from urllib.parse import quote

api_key = "4266d898-969c-43c3-9018-654642adda56"

base_search_query = {
    "isMapVisible": True,
    "mapBounds": {
        "north": 41.649235532695364,
        "south": 35.854467055579796,
        "east": -73.50710810156248,
        "west": -80.96682489843748
    },
    "filterState": {
        "sort": {"value": "globalrelevanceex"}
    },
    "isListVisible": True,
    "mapZoom": 7,
    "usersSearchTerm": "MD",
    "regionSelection": [{"regionId": 27, "regionType": 2}]
}

all_properties = []

for page in range(1, 21): 
    search_query = base_search_query.copy()
    if page > 1:
        search_query["pagination"] = {"currentPage": page}
        listing_url = f"https://www.zillow.com/md/{page}_p/"
    else:
        listing_url = "https://www.zillow.com/md/"
    search_query_str = quote(json.dumps(search_query))
    full_url = f"{listing_url}?searchQueryState={search_query_str}"

    api_url = "https://app.scrapeak.com/v1/scrapers/zillow/listing"
    params = {
        "api_key": api_key,
        "url": full_url
    }

    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        raw_data = response.json()
        if raw_data.get("is_success"):
            properties = raw_data["data"]["cat1"]["searchResults"]["listResults"]

            for prop in properties:
                all_properties.append({
                        "image": prop.get("imgSrc", "https://via.placeholder.com/350x200"),
                        "price": prop.get("price", "N/A"),
                        "location": f"{prop.get('addressCity', '')}, {prop.get('addressState', '')}",
                        "zip": prop.get("hdpData", {}).get("homeInfo", {}).get("zipcode", "N/A"),
                        "bedrooms": prop.get("beds", "N/A"),
                        "bathrooms": prop.get("baths", "N/A"),
                        "area_sqft": prop.get("area", "N/A"),
                        "property_type": prop.get("hdpData", {}).get("homeInfo", {}).get("homeType", "N/A"),
                        "year_built": prop.get("hdpData", {}).get("homeInfo", {}).get("yearBuilt", "N/A"),
                        "listing_url": "https://www.zillow.com" + prop.get("detailUrl", ""),
                        "cashflow": "TBD",
                        "rent": "N/A",
                        "mortgage": "N/A"
                    })


            print(f"âœ… Page {page}: {len(properties)} properties scraped.")
        else:
            print(f"âŒ Page {page}: Scrapeak API error:", raw_data.get('message'))
    else:
        print(f"âŒ Page {page}: HTTP error: {response.status_code}")

with open("mock-properties.json", "w") as f:
    json.dump(all_properties, f, indent=2)

print(f"ðŸ  Total properties scraped: {len(all_properties)}")