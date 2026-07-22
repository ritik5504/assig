from django.test import TestCase
from datetime import datetime, timedelta
from .services.hos_calculator import HOSCalculator
from .services.route_service import RouteService
from .models import Trip, TimelineEvent

class RouteServiceTestCase(TestCase):
    def setUp(self):
        self.route_service = RouteService()

    def test_fallback_geocoding_known_cities(self):
        """Verify that known hubs resolve correctly via local DB fallback."""
        lat, lng = self.route_service.geocode("Chicago, IL")
        self.assertAlmostEqual(lat, 41.8781, places=3)
        self.assertAlmostEqual(lng, -87.6298, places=3)

    def test_fallback_geocoding_unregistered_addresses(self):
        """Arbitrary strings should resolve deterministically in continental US."""
        lat1, lng1 = self.route_service.geocode("123 Random Road, Montana")
        lat2, lng2 = self.route_service.geocode("123 Random Road, Montana")
        
        # Consistent hash coordinates
        self.assertEqual(lat1, lat2)
        self.assertEqual(lng1, lng2)
        
        # Valid US boundaries
        self.assertTrue(30.0 <= lat1 <= 45.0)
        self.assertTrue(-120.0 <= lng1 <= -75.0)

    def test_route_calculation_fallback(self):
        """Ensures routing calculation returns consistent structures and distances."""
        origin = (41.8781, -87.6298)       # Chicago
        pickup = (39.0997, -94.5786)       # Kansas City (~500 miles road distance)
        destination = (39.7392, -104.9903)  # Denver (~600 miles road distance)
        
        route = self.route_service.get_route(origin, pickup, destination)
        
        self.assertIn("points", route)
        self.assertTrue(len(route["points"]) > 0)
        self.assertTrue(route["total_distance"] > 800)
        self.assertTrue(route["total_duration"] > 14)


class HOSCalculatorTestCase(TestCase):
    def test_hos_short_trip_no_breaks(self):
        """A short trip (<4 hours driving) should require only the initial pre-trip inspection."""
        start_time = datetime(2026, 7, 22, 8, 0)
        calculator = HOSCalculator(start_cycle_hours=10.0, start_time=start_time)
        
        # 100 miles total (50 to pickup, 50 to dropoff) -> ~1.8 hours driving
        route_data = {
            "distance_miles_1": 50.0,
            "duration_hours_1": 0.9,
            "distance_miles_2": 50.0,
            "duration_hours_2": 0.9,
            "total_distance": 100.0,
            "total_duration": 1.8
        }
        
        result = calculator.calculate_schedule(route_data)
        
        self.assertEqual(result["total_distance_miles"], 100.0)
        # 0.5 (initial inspection) + 0.9 (driving 1) + 1.0 (pickup) + 0.9 (driving 2) + 1.0 (dropoff) = 4.3 duty hours
        self.assertAlmostEqual(result["total_duty_hours"], 4.3, places=1)
        self.assertAlmostEqual(result["total_driving_hours"], 1.8, places=1)
        
        # No 10-hour rests or 30-minute breaks should be triggered
        rests = [e for e in result["raw_events"] if "rest" in e["description"].lower() or "break" in e["description"].lower()]
        self.assertEqual(len(rests), 0)

    def test_hos_medium_trip_break_required(self):
        """A trip with 10 driving hours should trigger a 30-minute break (8-hour limit) but fit in a single shift."""
        start_time = datetime(2026, 7, 22, 8, 0)
        calculator = HOSCalculator(start_cycle_hours=10.0, start_time=start_time)
        
        # 550 miles total -> 10 hours driving.
        # Shift schedule: Pre-trip (0.5), Drive 5 (5.0), Load (1.0), Drive 5 (5.0), Unload (1.0) = 12.5 hrs duty
        # Driving since shift start reaches 8.0 hours inside the second driving leg, triggering a 30-minute break.
        route_data = {
            "distance_miles_1": 275.0,
            "duration_hours_1": 5.0,
            "distance_miles_2": 275.0,
            "duration_hours_2": 5.0,
            "total_distance": 550.0,
            "total_duration": 10.0
        }
        
        result = calculator.calculate_schedule(route_data)
        
        # Verify 30-minute break was inserted
        breaks = [e for e in result["raw_events"] if "30-min break" in e["description"]]
        self.assertEqual(len(breaks), 1)
        self.assertEqual(breaks[0]["duration_hours"], 0.5)

    def test_hos_long_trip_multiple_days_and_fuel_stops(self):
        """A multi-day trip (>1500 miles) must trigger daily rests, breaks, and a fuel stop."""
        start_time = datetime(2026, 7, 22, 8, 0)
        calculator = HOSCalculator(start_cycle_hours=0.0, start_time=start_time)
        
        # 1650 miles -> 30 hours driving. Requires at least 3 days.
        # Should also trigger a fuel stop after 1000 miles.
        route_data = {
            "distance_miles_1": 825.0,
            "duration_hours_1": 15.0,
            "distance_miles_2": 825.0,
            "duration_hours_2": 15.0,
            "total_distance": 1650.0,
            "total_duration": 30.0
        }
        
        result = calculator.calculate_schedule(route_data)
        
        # Should have multiple 10-hour rest breaks
        rests = [e for e in result["raw_events"] if "10-hour" in e["description"].lower()]
        self.assertTrue(len(rests) >= 2)
        
        # Should have a fuel stop (since total miles > 1000)
        fuels = [e for e in result["raw_events"] if "refueling" in e["description"].lower()]
        self.assertTrue(len(fuels) >= 1)

    def test_hos_cycle_hours_restart(self):
        """If driver starts with high cycle hours (68 hrs), a 34-hour restart should be triggered."""
        start_time = datetime(2026, 7, 22, 8, 0)
        calculator = HOSCalculator(start_cycle_hours=68.0, start_time=start_time)
        
        # Needs 4 hours of duty to hit 70. Driving 5 hours requires 5.5 hours total (0.5 pre-trip + 5.0 drive)
        # This must trigger a 34-hour restart.
        route_data = {
            "distance_miles_1": 275.0,
            "duration_hours_1": 5.0,
            "distance_miles_2": 0.0,
            "duration_hours_2": 0.0,
            "total_distance": 275.0,
            "total_duration": 5.0
        }
        
        result = calculator.calculate_schedule(route_data)
        
        restarts = [e for e in result["raw_events"] if "34-hour" in e["description"]]
        self.assertEqual(len(restarts), 1)
        self.assertEqual(restarts[0]["duration_hours"], 34.0)
