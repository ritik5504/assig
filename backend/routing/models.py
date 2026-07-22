from django.db import models

class Trip(models.Model):
    """
    Represents a planned truck route including HOS calculations and route geometries.
    """
    origin_address = models.CharField(max_length=255)
    pickup_address = models.CharField(max_length=255)
    destination_address = models.CharField(max_length=255)
    
    origin_lat = models.FloatField()
    origin_lng = models.FloatField()
    pickup_lat = models.FloatField()
    pickup_lng = models.FloatField()
    destination_lat = models.FloatField()
    destination_lng = models.FloatField()
    
    start_cycle_hours = models.FloatField(default=0.0) # Cycle hours used at start (out of 70)
    total_distance_miles = models.FloatField()
    total_duration_hours = models.FloatField()
    total_driving_hours = models.FloatField()
    total_duty_hours = models.FloatField()
    
    # Route points stored as JSON array: [[lat, lng], [lat, lng], ...]
    route_points = models.JSONField(default=list)
    
    carrier_name = models.CharField(max_length=255, default="Apex Carrier Corp")
    vehicle_id = models.CharField(max_length=50, default="TRK-7742")
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Trip {self.id}: {self.origin_address} -> {self.destination_address}"


class TimelineEvent(models.Model):
    """
    Represents an event on the driver's log sheet conforming to FMCSA duty statuses.
    """
    STATUS_CHOICES = [
        ('OFF_DUTY', 'Off Duty'),
        ('SLEEPER', 'Sleeper Berth'),
        ('DRIVING', 'Driving'),
        ('ON_DUTY_ND', 'On Duty (Not Driving)'),
    ]
    
    trip = models.ForeignKey(Trip, related_name='timeline_events', on_delete=models.CASCADE)
    event_type = models.CharField(max_length=20, choices=STATUS_CHOICES)
    description = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration_hours = models.FloatField()
    start_odometer = models.FloatField(default=0.0)
    end_odometer = models.FloatField(default=0.0)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"{self.event_type} ({self.duration_hours} hrs) - {self.description}"
