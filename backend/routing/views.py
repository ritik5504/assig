from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import datetime
import logging

from .models import Trip, TimelineEvent
from .serializers import TripSerializer
from .services.route_service import RouteService
from .services.hos_calculator import HOSCalculator

logger = logging.getLogger(__name__)

class TripViewSet(viewsets.ModelViewSet):
    """
    ViewSet for listing, retrieving, and saving trips and their associated HOS logs.
    """
    queryset = Trip.objects.all().order_by('-created_at')
    serializer_name = 'Trip'
    serializer_class = TripSerializer

    def create(self, request, *args, **kwargs):
        """
        Calculates and persists a planned trip and all of its individual logs.
        """
        data = request.data
        
        origin = data.get('origin_address')
        pickup = data.get('pickup_address')
        destination = data.get('destination_address')
        start_cycle_hours = float(data.get('start_cycle_hours', 0.0))
        carrier_name = data.get('carrier_name', 'Apex Carrier Corp')
        vehicle_id = data.get('vehicle_id', 'TRK-7742')
        remarks = data.get('remarks', '')
        
        start_time_str = data.get('start_time')
        start_time = None
        if start_time_str:
            try:
                # Remove Z or offset timezone parsing helpers for simplicity
                cleaned_str = start_time_str.split('.')[0].replace('Z', '')
                start_time = datetime.fromisoformat(cleaned_str)
            except ValueError:
                pass

        try:
            # 1. Compute routing and geocoding
            route_svc = RouteService()
            origin_lat, origin_lng = route_svc.geocode(origin)
            pickup_lat, pickup_lng = route_svc.geocode(pickup)
            destination_lat, destination_lng = route_svc.geocode(destination)
            
            route_data = route_svc.get_route(
                (origin_lat, origin_lng),
                (pickup_lat, pickup_lng),
                (destination_lat, destination_lng)
            )

            # 2. Run simulation
            calculator = HOSCalculator(start_cycle_hours=start_cycle_hours, start_time=start_time)
            schedule = calculator.calculate_schedule(route_data)

            # 3. Persist Trip
            trip = Trip.objects.create(
                origin_address=origin,
                pickup_address=pickup,
                destination_address=destination,
                origin_lat=origin_lat,
                origin_lng=origin_lng,
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                destination_lat=destination_lat,
                destination_lng=destination_lng,
                start_cycle_hours=start_cycle_hours,
                total_distance_miles=schedule['total_distance_miles'],
                total_duration_hours=route_data['total_duration'],
                total_driving_hours=schedule['total_driving_hours'],
                total_duty_hours=schedule['total_duty_hours'],
                route_points=route_data['points'],
                carrier_name=carrier_name,
                vehicle_id=vehicle_id,
                remarks=remarks
            )

            # 4. Persist Timeline Events
            for event in schedule['raw_events']:
                TimelineEvent.objects.create(
                    trip=trip,
                    event_type=event['event_type'],
                    description=event['description'],
                    start_time=datetime.fromisoformat(event['start_time']),
                    end_time=datetime.fromisoformat(event['end_time']),
                    duration_hours=event['duration_hours'],
                    start_odometer=event['start_odometer'],
                    end_odometer=event['end_odometer']
                )

            serializer = self.get_serializer(trip)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.exception("Error saving trip planning")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def calculate_trip(request):
    """
    Computes HOS timeline schedules, distance, fuel stops, and returns structured JSON.
    Does NOT write anything to the database. Useful for planning previews.
    """
    data = request.data
    origin = data.get('origin_address')
    pickup = data.get('pickup_address')
    destination = data.get('destination_address')
    start_cycle_hours = float(data.get('start_cycle_hours', 0.0))
    
    start_time_str = data.get('start_time')
    start_time = None
    if start_time_str:
        try:
            cleaned_str = start_time_str.split('.')[0].replace('Z', '')
            start_time = datetime.fromisoformat(cleaned_str)
        except ValueError:
            pass

    if not origin or not pickup or not destination:
        return Response({"error": "origin_address, pickup_address, and destination_address are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        # 1. Geocode and Routing
        route_svc = RouteService()
        origin_lat, origin_lng = route_svc.geocode(origin)
        pickup_lat, pickup_lng = route_svc.geocode(pickup)
        destination_lat, destination_lng = route_svc.geocode(destination)
        
        route_data = route_svc.get_route(
            (origin_lat, origin_lng),
            (pickup_lat, pickup_lng),
            (destination_lat, destination_lng)
        )

        # 2. Run simulation
        calculator = HOSCalculator(start_cycle_hours=start_cycle_hours, start_time=start_time)
        schedule = calculator.calculate_schedule(route_data)

        # 3. Prepare response object
        response_payload = {
            "origin_address": origin,
            "pickup_address": pickup,
            "destination_address": destination,
            "origin_coords": [origin_lat, origin_lng],
            "pickup_coords": [pickup_lat, pickup_lng],
            "destination_coords": [destination_lat, destination_lng],
            "route_points": route_data['points'],
            "total_distance_miles": schedule['total_distance_miles'],
            "total_duration_hours": round(route_data['total_duration'], 2),
            "total_driving_hours": schedule['total_driving_hours'],
            "total_duty_hours": schedule['total_duty_hours'],
            "total_off_duty_hours": schedule['total_off_duty_hours'],
            "start_time": schedule['start_time'],
            "end_time": schedule['end_time'],
            "days": schedule['days'],
            "raw_events": schedule['raw_events']
        }

        return Response(response_payload, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception("Error calculating HOS trip plan")
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
