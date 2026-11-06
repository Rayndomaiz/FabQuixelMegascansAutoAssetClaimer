# Fab Quixel Megascans Auto Asset Claimer
This script automates the process of collecting free Quixel Megascans assets available on Fab.  It retrieves assets from the Quixel Megascans catalog, checks their availability and pricing, and attempts to add eligible free assets to your Fab library.

# How to Use
1. **Download the Script:** Download `run.js` from this repository.
2. **Login:** Login or Sign in to your account at [Fab](https://www.fab.com/).
3. **Open the Catalog:** Visit the [Quixel Megascans catalog](https://www.fab.com/sellers/Quixel%20Megascans?lang=en).
4. **Open Developer Tools:** Press `F12` and select the **Console** tab.
5. **Paste the Script:** Copy the contents of `run.js` into the console.
6. **Execute:** Press `Enter` to start the process.
7. **Wait:** Keep the Fab page open while the script processes available assets.

# Features
1. Retrieves Quixel Megascans assets from Fab.
2. Automatically navigates catalog pages.
3. Checks asset availability and license prices.
4. Tracks processed listings.
5. Displays progress and errors in the console.

# Common Issues
**HTTP 403 — Forbidden**
**Possible causes:**
- Expired login session.
- Temporary Fab restrictions.
- Changes to internal API endpoints.
