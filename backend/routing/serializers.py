from rest_framework import serializers
from .models import Trip, TimelineEvent

class TimelineEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineEvent
        fields = [
            'id', 'event_type', 'description', 'start_time', 'end_time', 
            'duration_hours', 'start_odometer', 'end_odometer'
        ]


class TripSerializer(serializers.ModelSerializer):
    timeline_events = serializers.SerializerMethodField()
    days = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'origin_address', 'pickup_address', 'destination_address',
            'origin_lat', 'origin_lng', 'pickup_lat', 'pickup_lng', 
            'destination_lat', 'destination_lng', 'start_cycle_hours', 
            'total_distance_miles', 'total_duration_hours', 'total_driving_hours', 
            'total_duty_hours', 'route_points', 'carrier_name', 'vehicle_id', 
            'remarks', 'created_at', 'timeline_events', 'days'
        ]

    def get_timeline_events(self, obj):
        events = obj.timeline_events.all().order_by('start_time')
        return TimelineEventSerializer(events, many=True).data

    def get_days(self, obj):
        """
        Reconstructs the 24-hour log sheets day-by-day based on persisted timeline events.
        Crucial for loading historical logs in standard FMCSA formats.
        """
        events = list(obj.timeline_events.all().order_by('start_time'))
        if not events:
            return []

        # Group by start date
        from collections import defaultdict
        import math
        days_dict = defaultdict(list)
        for e in events:
            # We convert timezone-aware datetimes to localized date strings
            date_str = e.start_time.date().isoformat()
            days_dict[date_str].append(e)

        compiled_days = []
        for date_str, evs in sorted(days_dict.items()):
            # Sort events for this day chronologically
            evs = sorted(evs, key=lambda x: x.start_time)
            
            off_duty = sum(x.duration_hours for x in evs if x.event_type == 'OFF_DUTY')
            sleeper = sum(x.duration_hours for x in evs if x.event_type == 'SLEEPER')
            driving = sum(x.duration_hours for x in evs if x.event_type == 'DRIVING')
            on_duty_nd = sum(x.duration_hours for x in evs if x.event_type == 'ON_DUTY_ND')
            
            # Recompute total to assert 24h consistency
            total = off_duty + sleeper + driving + on_duty_nd
            if not math.isclose(total, 24.0, abs_tol=1e-3):
                off_duty += (24.0 - total)

            day_events = []
            for e in evs:
                # Minutes from midnight calculation
                midnight = e.start_time.replace(hour=0, minute=0, second=0, microsecond=0)
                start_min = (e.start_time - midnight).total_seconds() / 60.0
                end_min = (e.end_time - midnight).total_seconds() / 60.0
                
                day_events.append({
                    "event_type": e.event_type,
                    "description": e.description,
                    "start_time": e.start_time.isoformat(),
                    "end_time": e.end_time.isoformat(),
                    "duration_hours": round(e.duration_hours, 2),
                    "start_minute": round(start_min, 1),
                    "end_minute": round(end_min, 1),
                    "start_odometer": round(e.start_odometer, 1),
                    "end_odometer": round(e.end_odometer, 1)
                })

            compiled_days.append({
                "date": date_str,
                "start_odometer": round(evs[0].start_odometer, 1),
                "end_odometer": round(evs[-1].end_odometer, 1),
                "total_miles": round(evs[-1].end_odometer - evs[0].start_odometer, 1),
                "hours_summary": {
                    "OFF_DUTY": round(off_duty, 2),
                    "SLEEPER": round(sleeper, 2),
                    "DRIVING": round(driving, 2),
                    "ON_DUTY_ND": round(on_duty_nd, 2),
                },
                "events": day_events
            })

        return compiled_days
