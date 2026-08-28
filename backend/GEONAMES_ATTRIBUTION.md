# GeoNames attribution

This project uses GeoNames downloadable extracts for country, administrative-division, city, and postal-code lookup data.

- GeoNames: https://www.geonames.org/
- Gazetteer data: https://download.geonames.org/export/dump/
- Postal data: https://download.geonames.org/export/zip/
- Data license and limitations: see the `readme.txt` files published with those extracts.

The generated files under `backend/data/` are not committed to the repository. Rebuild them with:

```bash
python3 backend/setup-geodata.py
```