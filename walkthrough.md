# Project Walkthrough - Truck Route Planner & FMCSA ELD Application

We have successfully built and verified a production-quality Truck Route Planner and FMCSA Electronic Logging Device (ELD) simulation application.

---

## What Was Built

### 1. Django REST Backend & HOS Simulation Engine
- **Database Schema (`routing/models.py`)**: Defined models `Trip` and `TimelineEvent` to persist planned routes, metadata, and 24-hour log events.
- **HOS Calculator Service (`routing/services/hos_calculator.py`)**: Implements standard FMCSA trucking safety hours regulations:
  - 11-hour driving maximum and 14-hour duty windows per shift.
  - Mandatory 30-minute breaks after 8 hours of cumulative driving.
  - 10-hour off-duty rests to reset shift limits.
  - 70-hour/8-day cycle limits with a 34-hour cycle restart.
  - Simulated 30-minute pre-trip inspections at shift starts, and 30-minute fuel stops every 1,000 miles.
  - Padding and event splitting at midnight boundaries to ensure that each generated day sums to exactly 24.0 hours for compliant log grids.
- **Routing Service (`routing/services/route_service.py`)**: Integrates with OpenRouteService directions/HGV and geocoding endpoints, with a high-fidelity deterministic fallback geocoder and Bezier-curved route point generator if no API key is provided.
- **API Endpoints (`routing/views.py`)**:
  - `POST /api/trips/calculate/`: Calculates the compliance timeline and route preview without writing to the database.
  - `POST /api/trips/`: Persists the calculated route and logs to the SQLite database.
  - `GET /api/trips/`: Lists saved historical trips.
  - `GET /api/trips/<id>/`: Retrieves details of a saved trip.
  - `DELETE /api/trips/<id>/`: Deletes a trip.

### 2. Vite React Frontend
- **Environment Configuration**: Tailored configurations for Tailwind CSS v4, PostCSS, and Vite plugins to compile modern, clean layouts.
- **Interactive Map Container (`src/components/MapView.jsx`)**: Renders route coordinates on a CartoDB Dark Matter tile layer, plotting start, pickup, dropoff, and refueling markers using custom SVG-div Leaflet icons.
- **Trip Statistics & Vertical Timeline (`src/components/TripTimeline.jsx`)**: Displays KPI metrics (total distance, driving time, duty window, days needed) and a color-coded vertical step-by-step history of the driver's schedule.
- **FMCSA Daily Log Sheets (`src/components/LogSheet.jsx`)**: Renders custom dynamic SVG canvases drawing the standard FMCSA 24-hour logs grid for each day, tracking the continuous stepping line across states. It displays daily summaries, odometer values, and detailed remarks.
- **Client-Side PDF Exporter (`src/utils/pdfExport.js`)**: Converts the SVG log sheet DOM nodes into high-resolution images using `html2canvas` and builds a multi-page PDF document using `jsPDF`.
- **Master UI Dashboard (`src/components/Dashboard.jsx`)**: Connects the input form, saved-trips sidebar, and loading/error states, allowing users to toggle between route planning previews and active log sheet views.

---

## Verification & Testing Results

### 1. Backend Test Suites
We ran 7 target unit tests testing short trips, breaks, multi-day routes, 34-hour cycle restarts, and fallback geocoding. All tests passed successfully:

```bash
source venv/bin/activate && cd backend && python manage.py test
```
```
Creating test database for alias 'default'...
.......
----------------------------------------------------------------------
Ran 7 tests in 0.001s

OK
Destroying test database for alias 'default'...
Found 7 test(s).
```

### 2. Frontend Build Compilation
We verified that the Vite bundling engine compiles all Javascript, dynamic SVGs, and Tailwind CSS v4 modules cleanly:

```bash
cd frontend && npm run build
```
```
vite v8.1.5 building client environment for production...
transforming...✓ 2084 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                        0.67 kB │ gzip:   0.42 kB
dist/assets/index-DKK1bcCT.css        46.75 kB │ gzip:  12.65 kB
dist/assets/purify.es-DuRL7t6i.js     26.87 kB │ gzip:  10.45 kB
dist/assets/index.es-BQiA-oFr.js     151.32 kB │ gzip:  48.88 kB
dist/assets/index-B5nCl-9c.js      1,097.12 kB │ gzip: 330.98 kB

✓ built in 620ms
```
All assets are optimized and compile successfully.
