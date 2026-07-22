import React from 'react';
import { 
  Navigation, 
  Clock, 
  Shield, 
  Coffee, 
  MapPin, 
  Truck, 
  Activity, 
  Calendar,
  Layers
} from 'lucide-react';

export default function TripTimeline({ tripData }) {
  if (!tripData) return null;

  const {
    total_distance_miles,
    total_driving_hours,
    total_duty_hours,
    total_off_duty_hours,
    start_time,
    end_time,
    raw_events,
    days
  } = tripData;

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (type, desc) => {
    const d = desc.toLowerCase();
    if (type === 'DRIVING') return <Truck className="w-4 h-4 text-primary-400" />;
    if (type === 'ON_DUTY_ND') {
      if (d.includes('inspect')) return <Shield className="w-4 h-4 text-emerald-400" />;
      if (d.includes('refuel')) return <Activity className="w-4 h-4 text-amber-400" />;
      return <Layers className="w-4 h-4 text-emerald-400" />;
    }
    // Off duty
    if (d.includes('rest') || d.includes('break')) return <Coffee className="w-4 h-4 text-slate-400" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  const getEventColorClasses = (type) => {
    switch (type) {
      case 'DRIVING':
        return {
          bg: 'bg-primary-500/10 border-primary-500/30 text-primary-400',
          badge: 'bg-primary-500/20 text-primary-300',
          border: 'border-primary-500/40',
          dot: 'bg-primary-500 ring-primary-500/30'
        };
      case 'ON_DUTY_ND':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300',
          border: 'border-emerald-500/40',
          dot: 'bg-emerald-500 ring-emerald-500/30'
        };
      default: // OFF_DUTY or SLEEPER
        return {
          bg: 'bg-slate-700/10 border-slate-700/30 text-slate-400',
          badge: 'bg-slate-700/20 text-slate-300',
          border: 'border-slate-700/40',
          dot: 'bg-slate-500 ring-slate-500/30'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-primary-500/10 text-primary-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Distance</p>
            <p className="text-lg font-bold">{total_distance_miles.toLocaleString()} mi</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Driving Time</p>
            <p className="text-lg font-bold">{total_driving_hours.toFixed(1)} hrs</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Duty Time</p>
            <p className="text-lg font-bold">{total_duty_hours.toFixed(1)} hrs</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-slate-500/10 text-slate-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Duration</p>
            <p className="text-lg font-bold">{days ? days.length : 1} Days</p>
          </div>
        </div>
      </div>

      {/* Date Ranges */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-sm text-slate-300 gap-3 border border-slate-800">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Depart:</span>
          <span className="text-slate-400">{formatDate(start_time)}</span>
        </div>
        <div className="hidden md:block text-slate-600">|</div>
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-rose-400" />
          <span className="font-medium">Arrive:</span>
          <span className="text-slate-400">{formatDate(end_time)}</span>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <h3 className="text-base font-bold mb-4 flex items-center">
          <Activity className="w-5 h-5 text-primary-400 mr-2" />
          Trip Execution Timeline
        </h3>

        <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
          {raw_events && raw_events.map((event, index) => {
            const colors = getEventColorClasses(event.event_type);
            const isDriving = event.event_type === 'DRIVING';
            
            return (
              <div key={index} className="relative group">
                {/* Visual Dot */}
                <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full ${colors.dot} ring-4 flex items-center justify-center transform transition-transform group-hover:scale-125`}>
                  {/* Inner pulse */}
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>

                {/* Event Card */}
                <div className={`p-4 rounded-xl border ${colors.bg} hover:border-opacity-50 transition-colors`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-md bg-dark-900 border border-slate-800">
                        {getEventIcon(event.event_type, event.description)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">{event.description}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(event.start_time)} &rarr; {formatDate(event.end_time)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-start md:self-center">
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${colors.badge}`}>
                        {event.event_type.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono bg-dark-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                        {event.duration_hours.toFixed(1)}h
                      </span>
                    </div>
                  </div>

                  {/* Supplemental data (e.g. Odometer) */}
                  {isDriving && (
                    <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Odometer Start: {Math.round(event.start_odometer).toLocaleString()} mi</span>
                      <span>End: {Math.round(event.end_odometer).toLocaleString()} mi</span>
                      <span className="text-primary-400">+{Math.round(event.end_odometer - event.start_odometer)} mi</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
