import math
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class HOSCalculator:
    """
    Simulates a truck trip under FMCSA Hours of Service (HOS) regulations.
    
    HOS Rules Implemented:
    1. 11-Hour Driving Limit: Driver cannot drive more than 11 cumulative hours per shift.
    2. 14-Hour Duty Window: Driver cannot drive after being on duty for 14 consecutive hours.
    3. 30-Minute Break: Driver must take a 30-minute off-duty break after 8 hours of cumulative driving.
    4. 10-Hour Off-Duty: 10 consecutive hours off duty resets the 11-hour driving and 14-hour duty clocks.
    5. 70-Hour / 8-Day Limit: Driver cannot work after reaching 70 duty hours (driving + on-duty-nd) 
       in an 8-day period. A 34-hour consecutive off-duty period acts as a cycle reset.
       
    Other Simulation Rules:
    - Pre-trip Inspection: 30 minutes On-Duty Not Driving (ND) at the start of each work day/shift.
    - Fuel Stops: 30 minutes On-Duty ND every 1,000 miles.
    - Pickup / Dropoff: 1 hour On-Duty ND each.
    """
    
    def __init__(self, start_cycle_hours: float = 0.0, start_time: datetime = None):
        self.start_cycle_hours = min(max(start_cycle_hours, 0.0), 70.0)
        self.start_time = start_time if start_time else datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        
        # State variables
        self.current_time = self.start_time
        self.odometer = 100000.0  # Starting odometer reading in miles
        self.miles_since_last_fuel = 0.0
        
        # Clocks
        self.day_driving_hours = 0.0
        self.day_duty_hours = 0.0
        self.driving_since_last_break = 0.0
        self.cycle_hours_used = self.start_cycle_hours
        
        # Raw sequence of events
        self.raw_events = []

    def calculate_schedule(self, route_data: dict) -> dict:
        """
        Runs the simulation for:
        1. Pre-trip inspection (30 mins)
        2. Segment 1: Drive to Pickup
        3. Pickup: Loading (1 hour)
        4. Segment 2: Drive to Dropoff
        5. Dropoff: Unloading (1 hour)
        """
        # Start Trip: Initial Pre-trip inspection
        self._execute_duty_nd(0.5, "Initial Pre-Trip Inspection")
        
        # Phase 1: Drive to Pickup
        dist1 = route_data["distance_miles_1"]
        dur1 = route_data["duration_hours_1"]
        self._execute_driving(dist1, dur1, "Driving to Pickup")
        
        # Phase 2: Pickup Loading
        self._execute_duty_nd(1.0, "Loading at Pickup Location")
        
        # Phase 3: Drive to Dropoff
        dist2 = route_data["distance_miles_2"]
        dur2 = route_data["duration_hours_2"]
        self._execute_driving(dist2, dur2, "Driving to Destination")
        
        # Phase 4: Dropoff Unloading
        self._execute_duty_nd(1.0, "Unloading at Destination")
        
        # Process raw events to fit calendar days (split at midnight and pad ends)
        processed_days = self._split_events_by_calendar_day()
        
        # Calculate summary statistics
        total_dist = dist1 + dist2
        total_driving = sum(e["duration_hours"] for e in self.raw_events if e["event_type"] == "DRIVING")
        total_duty_nd = sum(e["duration_hours"] for e in self.raw_events if e["event_type"] == "ON_DUTY_ND")
        total_off_duty = sum(e["duration_hours"] for e in self.raw_events if e["event_type"] == "OFF_DUTY")
        
        return {
            "total_distance_miles": round(total_dist, 1),
            "total_driving_hours": round(total_driving, 2),
            "total_duty_hours": round(total_driving + total_duty_nd, 2),
            "total_off_duty_hours": round(total_off_duty, 2),
            "start_time": self.start_time.isoformat(),
            "end_time": self.current_time.isoformat(),
            "days": processed_days,
            "raw_events": [
                {
                    "event_type": e["event_type"],
                    "description": e["description"],
                    "start_time": e["start_time"].isoformat(),
                    "end_time": e["end_time"].isoformat(),
                    "duration_hours": round(e["duration_hours"], 2),
                    "start_odometer": round(e["start_odometer"], 1),
                    "end_odometer": round(e["end_odometer"], 1)
                }
                for e in self.raw_events
            ]
        }

    def _add_raw_event(self, status: str, duration_hours: float, description: str, start_odo: float, end_odo: float):
        """Helper to create and append a timeline event."""
        start = self.current_time
        self.current_time += timedelta(hours=duration_hours)
        self.raw_events.append({
            "event_type": status,
            "description": description,
            "start_time": start,
            "end_time": self.current_time,
            "duration_hours": duration_hours,
            "start_odometer": start_odo,
            "end_odometer": end_odo
        })

    def _execute_duty_nd(self, duration: float, description: str):
        """Simulates an On-Duty Not Driving task, inserting HOS rests if required."""
        remaining = duration
        while remaining > 0.001:
            time_to_14_hr_duty = 14.0 - self.day_duty_hours
            time_to_70_hr_cycle = 70.0 - self.cycle_hours_used
            
            # The maximum we can work before hitting a daily or cycle limit
            dt = min(time_to_14_hr_duty, time_to_70_hr_cycle, remaining)
            
            if dt <= 0.001:
                # Resolve limit
                if time_to_70_hr_cycle <= 0.001:
                    # Out of 70 hour cycle -> Must rest 34 hours (restart)
                    self._add_raw_event("OFF_DUTY", 34.0, "34-hour cycle restart", self.odometer, self.odometer)
                    self.day_driving_hours = 0.0
                    self.day_duty_hours = 0.0
                    self.driving_since_last_break = 0.0
                    self.cycle_hours_used = 0.0
                    
                    # Perform post-rest pre-trip inspection
                    self._execute_duty_nd(0.5, "Post-Restart Pre-Trip Inspection")
                elif time_to_14_hr_duty <= 0.001:
                    # Out of 14 hour daily duty window -> Must rest 10 hours
                    self._add_raw_event("OFF_DUTY", 10.0, "10-hour mandatory rest", self.odometer, self.odometer)
                    self.day_driving_hours = 0.0
                    self.day_duty_hours = 0.0
                    self.driving_since_last_break = 0.0
                    
                    # Perform post-rest pre-trip inspection
                    self._execute_duty_nd(0.5, "Post-Rest Pre-Trip Inspection")
                continue
                
            # Log working time
            self._add_raw_event("ON_DUTY_ND", dt, description, self.odometer, self.odometer)
            self.day_duty_hours += dt
            self.cycle_hours_used += dt
            remaining -= dt

    def _execute_driving(self, distance: float, duration: float, description: str):
        """Simulates driving a segment, breaking it up with rest stops/refuels as needed."""
        speed_mph = distance / duration if duration > 0 else 55.0
        remaining_dur = duration
        remaining_dist = distance
        
        while remaining_dur > 0.001:
            time_to_8_hr_break = 8.0 - self.driving_since_last_break
            time_to_11_hr_drive = 11.0 - self.day_driving_hours
            time_to_14_hr_duty = 14.0 - self.day_duty_hours
            time_to_70_hr_cycle = 70.0 - self.cycle_hours_used
            
            # Fuel Stops: Check distance to next fuel stop (every 1000 miles)
            miles_to_fuel = 1000.0 - self.miles_since_last_fuel
            time_to_fuel = miles_to_fuel / speed_mph
            
            # Find the closest event limit
            dt = min(time_to_8_hr_break, time_to_11_hr_drive, time_to_14_hr_duty, 
                     time_to_70_hr_cycle, time_to_fuel, remaining_dur)
            
            if dt <= 0.001:
                # Handle limit hit
                if time_to_70_hr_cycle <= 0.001:
                    # 34 hour restart
                    self._add_raw_event("OFF_DUTY", 34.0, "34-hour cycle restart", self.odometer, self.odometer)
                    self.day_driving_hours = 0.0
                    self.day_duty_hours = 0.0
                    self.driving_since_last_break = 0.0
                    self.cycle_hours_used = 0.0
                    self._execute_duty_nd(0.5, "Post-Restart Pre-Trip Inspection")
                elif time_to_11_hr_drive <= 0.001 or time_to_14_hr_duty <= 0.001:
                    # 10 hour rest
                    self._add_raw_event("OFF_DUTY", 10.0, "10-hour daily rest break", self.odometer, self.odometer)
                    self.day_driving_hours = 0.0
                    self.day_duty_hours = 0.0
                    self.driving_since_last_break = 0.0
                    self._execute_duty_nd(0.5, "Post-Rest Pre-Trip Inspection")
                elif time_to_8_hr_break <= 0.001:
                    # 30 minute rest break (Off-Duty)
                    # Note: Counts against 14-hour duty window, but NOT 11-hour driving or 70-hour cycle
                    self._add_raw_event("OFF_DUTY", 0.5, "Mandatory 30-min break", self.odometer, self.odometer)
                    self.day_duty_hours += 0.5
                    self.driving_since_last_break = 0.0
                elif time_to_fuel <= 0.001:
                    # 30-min Fuel Stop (On-Duty Not Driving)
                    self._add_raw_event("ON_DUTY_ND", 0.5, "Refueling Stop", self.odometer, self.odometer)
                    self.day_duty_hours += 0.5
                    self.cycle_hours_used += 0.5
                    self.miles_since_last_fuel = 0.0
                continue
            
            # Drive for dt hours
            dist_driven = dt * speed_mph
            start_odo = self.odometer
            self.odometer += dist_driven
            self.miles_since_last_fuel += dist_driven
            
            self._add_raw_event("DRIVING", dt, description, start_odo, self.odometer)
            
            self.day_driving_hours += dt
            self.day_duty_hours += dt
            self.driving_since_last_break += dt
            self.cycle_hours_used += dt
            
            remaining_dur -= dt
            remaining_dist -= dist_driven

    def _split_events_by_calendar_day(self) -> list:
        """
        Pads and splits events by midnight so we can render clean, standard 
        24-hour log grids for each day of the journey.
        """
        if not self.raw_events:
            return []
            
        # 1. Pad the start: from midnight of Day 1 to trip start time
        first_event = self.raw_events[0]
        trip_start = first_event["start_time"]
        day1_midnight = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        padded_events = []
        if trip_start > day1_midnight:
            pad_dur = (trip_start - day1_midnight).total_seconds() / 3600.0
            padded_events.append({
                "event_type": "OFF_DUTY",
                "description": "Off Duty (Start of Day)",
                "start_time": day1_midnight,
                "end_time": trip_start,
                "duration_hours": pad_dur,
                "start_odometer": first_event["start_odometer"],
                "end_odometer": first_event["start_odometer"]
            })
            
        padded_events.extend(self.raw_events)
        
        # 2. Pad the end: from final event end time to midnight of the final day
        last_event = padded_events[-1]
        trip_end = last_event["end_time"]
        final_day_end = (trip_end + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        if trip_end < final_day_end:
            pad_dur = (final_day_end - trip_end).total_seconds() / 3600.0
            padded_events.append({
                "event_type": "OFF_DUTY",
                "description": "Off Duty (End of Day)",
                "start_time": trip_end,
                "end_time": final_day_end,
                "duration_hours": pad_dur,
                "start_odometer": last_event["end_odometer"],
                "end_odometer": last_event["end_odometer"]
            })

        # 3. Split events crossing midnight boundaries
        split_events = []
        for event in padded_events:
            start = event["start_time"]
            end = event["end_time"]
            
            # While the event crosses a midnight boundary
            while start.date() != end.date():
                # Find midnight of the next day
                next_midnight = (start + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                
                # Split ratio
                total_sec = (end - start).total_seconds()
                to_midnight_sec = (next_midnight - start).total_seconds()
                ratio = to_midnight_sec / total_sec if total_sec > 0 else 0
                
                odo_diff = event["end_odometer"] - event["start_odometer"]
                mid_odo = event["start_odometer"] + (odo_diff * ratio)
                
                split_events.append({
                    "event_type": event["event_type"],
                    "description": event["description"],
                    "start_time": start,
                    "end_time": next_midnight,
                    "duration_hours": to_midnight_sec / 3600.0,
                    "start_odometer": event["start_odometer"],
                    "end_odometer": mid_odo
                })
                
                # Prepare for next loop segment
                start = next_midnight
                event = {
                    "event_type": event["event_type"],
                    "description": event["description"],
                    "start_time": next_midnight,
                    "end_time": end,
                    "duration_hours": (end - next_midnight).total_seconds() / 3600.0,
                    "start_odometer": mid_odo,
                    "end_odometer": event["end_odometer"]
                }
            
            split_events.append(event)

        # 4. Group by date and compile 24-hour summary days
        days_dict = {}
        for event in split_events:
            date_str = event["start_time"].date().isoformat()
            if date_str not in days_dict:
                days_dict[date_str] = []
            days_dict[date_str].append(event)
            
        compiled_days = []
        for date_str, evs in sorted(days_dict.items()):
            # Sort events for this day chronologically
            evs = sorted(evs, key=lambda e: e["start_time"])
            
            # Totals per duty type (must sum to exactly 24.0)
            off_duty = sum(e["duration_hours"] for e in evs if e["event_type"] == "OFF_DUTY")
            sleeper = sum(e["duration_hours"] for e in evs if e["event_type"] == "SLEEPER")
            driving = sum(e["duration_hours"] for e in evs if e["event_type"] == "DRIVING")
            on_duty_nd = sum(e["duration_hours"] for e in evs if e["event_type"] == "ON_DUTY_ND")
            
            # Force exact 24-hour sum mathematically, fixing floating point errors
            total = off_duty + sleeper + driving + on_duty_nd
            if not math.isclose(total, 24.0, abs_tol=1e-5):
                # Distribute difference into off-duty
                diff = 24.0 - total
                off_duty += diff
            
            day_events = []
            for e in evs:
                # Convert time back relative to start of calendar day (minutes from midnight 0 to 1440)
                # This makes it easy for frontend SVG coordinates to map to x-axis
                start_min = (e["start_time"] - e["start_time"].replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds() / 60.0
                end_min = (e["end_time"] - e["end_time"].replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds() / 60.0
                
                day_events.append({
                    "event_type": e["event_type"],
                    "description": e["description"],
                    "start_time": e["start_time"].isoformat(),
                    "end_time": e["end_time"].isoformat(),
                    "duration_hours": round(e["duration_hours"], 2),
                    "start_minute": round(start_min, 1),
                    "end_minute": round(end_min, 1),
                    "start_odometer": round(e["start_odometer"], 1),
                    "end_odometer": round(e["end_odometer"], 1)
                })
                
            compiled_days.append({
                "date": date_str,
                "start_odometer": round(evs[0]["start_odometer"], 1),
                "end_odometer": round(evs[-1]["end_odometer"], 1),
                "total_miles": round(evs[-1]["end_odometer"] - evs[0]["start_odometer"], 1),
                "hours_summary": {
                    "OFF_DUTY": round(off_duty, 2),
                    "SLEEPER": round(sleeper, 2),
                    "DRIVING": round(driving, 2),
                    "ON_DUTY_ND": round(on_duty_nd, 2),
                },
                "events": day_events
            })
            
        return compiled_days
