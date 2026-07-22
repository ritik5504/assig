import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../services/api';
import { exportLogsToPdf } from '../utils/pdfExport';
import MapView from './MapView';
import TripTimeline from './TripTimeline';
import LogSheet from './LogSheet';
import { 
  Compass, 
  MapPin, 
  Clock, 
  Plus, 
  Loader2, 
  AlertCircle, 
  FileDown, 
  Layers, 
  Calendar, 
  Save, 
  Eye, 
  Trash2, 
  ChevronRight,
  BookOpen
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('route'); // 'route' or 'logs'
  const [activeTrip, setActiveTrip] = useState(null);
  const [savedTrips, setSavedTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      origin_address: 'Chicago, IL',
      pickup_address: 'Kansas City, MO',
      destination_address: 'Denver, CO',
      start_cycle_hours: 0.0,
      start_time: new Date().toISOString().substring(0, 16),
      carrier_name: 'Apex Carrier Corp',
      vehicle_id: 'TRK-7742',
      remarks: 'Standard freight delivery. High-priority logistics route.'
    }
  });

  // Load list of saved trips from SQLite on mount
  useEffect(() => {
    fetchSavedTrips();
  }, []);

  const fetchSavedTrips = async () => {
    try {
      const trips = await api.listTrips();
      setSavedTrips(trips);
    } catch (err) {
      console.error("Failed to load saved trips", err);
    }
  };

  // Perform calculation without saving to DB (Preview mode)
  const onSimulate = async (formData) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.calculateTrip({
        origin_address: formData.origin_address,
        pickup_address: formData.pickup_address,
        destination_address: formData.destination_address,
        start_cycle_hours: parseFloat(formData.start_cycle_hours),
        start_time: formData.start_time
      });
      // Set active trip preview, append metadata for rendering
      setActiveTrip({
        ...result,
        carrier_name: formData.carrier_name,
        vehicle_id: formData.vehicle_id,
        remarks: formData.remarks
      });
      setActiveTab('route');
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to calculate route.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate and Save trip to DB
  const onSaveAndCommit = async (formData) => {
    setIsLoading(true);
    setError(null);
    try {
      const savedResult = await api.saveTrip({
        origin_address: formData.origin_address,
        pickup_address: formData.pickup_address,
        destination_address: formData.destination_address,
        start_cycle_hours: parseFloat(formData.start_cycle_hours),
        start_time: formData.start_time,
        carrier_name: formData.carrier_name,
        vehicle_id: formData.vehicle_id,
        remarks: formData.remarks
      });
      setActiveTrip(savedResult);
      fetchSavedTrips(); // Refresh sidebar list
      setActiveTab('route');
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save trip.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load a saved trip from the sidebar
  const handleSelectTrip = async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const trip = await api.getTrip(id);
      setActiveTrip(trip);
      // Populate form fields with selected trip values
      setValue('origin_address', trip.origin_address);
      setValue('pickup_address', trip.pickup_address);
      setValue('destination_address', trip.destination_address);
      setValue('start_cycle_hours', trip.start_cycle_hours);
      setValue('carrier_name', trip.carrier_name);
      setValue('vehicle_id', trip.vehicle_id);
      setValue('remarks', trip.remarks);
      setValue('start_time', trip.created_at.substring(0, 16));
    } catch (err) {
      setError("Failed to retrieve saved trip.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTrip = async (e, id) => {
    e.stopPropagation(); // prevent loading the trip
    if (!window.confirm("Are you sure you want to delete this trip?")) return;
    try {
      await api.deleteTrip(id);
      if (activeTrip?.id === id) {
        setActiveTrip(null);
      }
      fetchSavedTrips();
    } catch (err) {
      setError("Failed to delete trip.");
    }
  };

  const handleExportPDF = async () => {
    if (!activeTrip) return;
    setIsLoading(true);
    try {
      const formattedDate = new Date(activeTrip.start_time).toISOString().split('T')[0];
      const filename = `ELD_Logs_${activeTrip.vehicle_id}_${formattedDate}.pdf`;
      await exportLogsToPdf('pdf-logs-container', filename);
    } catch (err) {
      setError("PDF compilation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark-950">
      
      {/* 1. Left Sidebar: Saved Trips Navigation */}
      <aside className="w-80 border-r border-slate-900 bg-dark-900/60 hidden md:flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-900 flex items-center space-x-2">
          <div className="bg-primary-500/10 p-2 rounded-lg text-primary-400">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-white">TRUCKROUTE ELD</h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">FMCSA Compliance</p>
          </div>
        </div>
        
        {/* Saved list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widex flex items-center mb-1">
            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-primary-400" />
            Saved Routes
          </h2>
          
          {savedTrips.length === 0 ? (
            <div className="text-xs text-slate-600 p-4 border border-dashed border-slate-850 rounded-xl text-center">
              No saved routes yet. Fill the planner to create one.
            </div>
          ) : (
            savedTrips.map((trip) => (
              <div 
                key={trip.id}
                onClick={() => handleSelectTrip(trip.id)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-300 ${
                  activeTrip?.id === trip.id 
                    ? 'bg-primary-500/10 border-primary-500/30 text-primary-400' 
                    : 'border-slate-850 bg-dark-800/30 text-slate-300 hover:bg-dark-800/50 hover:border-slate-800'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center text-xs font-bold truncate">
                    <span>{trip.origin_address.split(',')[0]}</span>
                    <ChevronRight className="w-3 h-3 mx-1 text-slate-600" />
                    <span>{trip.destination_address.split(',')[0]}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-2 font-medium">
                    <span>{Math.round(trip.total_distance_miles)} mi</span>
                    <span>•</span>
                    <span>{trip.vehicle_id}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDeleteTrip(e, trip.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 2. Main content container */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-900 bg-dark-900/20 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="font-bold text-slate-100 text-sm hidden md:block">Logistics Dispatch Center</h2>
            <div className="md:hidden flex items-center space-x-2">
              <Compass className="w-5 h-5 text-primary-400" />
              <span className="font-extrabold text-sm text-white">TRUCKROUTE</span>
            </div>
          </div>
          
          {/* Tab Selector */}
          {activeTrip && (
            <div className="flex bg-dark-900 border border-slate-850 rounded-lg p-1 text-xs">
              <button 
                onClick={() => setActiveTab('route')}
                className={`px-4 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'route' ? 'bg-primary-500 text-white shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Route & Timeline
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-1.5 rounded-md font-medium transition-all flex items-center ${
                  activeTab === 'logs' ? 'bg-primary-500 text-white shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                FMCSA Log Sheets
              </button>
            </div>
          )}
        </header>

        {/* Content body split */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* 2A. Input parameters Form panel */}
          <section className="w-full lg:w-96 border-r border-slate-900 p-6 overflow-y-auto shrink-0 bg-dark-900/30">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center">
              <Plus className="w-4 h-4 text-primary-400 mr-1.5" />
              Plan New Route
            </h3>

            <form className="space-y-4 text-xs">
              {/* Origin */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Current Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    {...register('origin_address', { required: 'Required' })}
                    placeholder="City, State or coordinates"
                    className="w-full bg-dark-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                {errors.origin_address && <p className="text-rose-400 text-[10px] mt-1">{errors.origin_address.message}</p>}
              </div>

              {/* Pickup */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Pickup Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                  <input 
                    type="text" 
                    {...register('pickup_address', { required: 'Required' })}
                    placeholder="City, State or coordinates"
                    className="w-full bg-dark-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                {errors.pickup_address && <p className="text-rose-400 text-[10px] mt-1">{errors.pickup_address.message}</p>}
              </div>

              {/* Destination */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Dropoff Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-rose-500" />
                  <input 
                    type="text" 
                    {...register('destination_address', { required: 'Required' })}
                    placeholder="City, State or coordinates"
                    className="w-full bg-dark-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                {errors.destination_address && <p className="text-rose-400 text-[10px] mt-1">{errors.destination_address.message}</p>}
              </div>

              {/* Current Cycle */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Current Cycle Hours Used (70h/8d)</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="number" 
                    step="0.1"
                    {...register('start_cycle_hours', { 
                      required: 'Required',
                      min: { value: 0, message: 'Min 0' },
                      max: { value: 70, message: 'Max 70' }
                    })}
                    placeholder="0.0"
                    className="w-full bg-dark-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors font-mono"
                  />
                </div>
                {errors.start_cycle_hours && <p className="text-rose-400 text-[10px] mt-1">{errors.start_cycle_hours.message}</p>}
              </div>

              {/* Start Date & Time */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Departure Schedule</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="datetime-local" 
                    {...register('start_time', { required: 'Required' })}
                    className="w-full bg-dark-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>

              {/* Carrier */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Carrier (FMCSA Log Header)</label>
                <input 
                  type="text" 
                  {...register('carrier_name')}
                  className="w-full bg-dark-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              {/* Vehicle ID */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Vehicle ID</label>
                <input 
                  type="text" 
                  {...register('vehicle_id')}
                  className="w-full bg-dark-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Log Remarks / Dispatch Instructions</label>
                <textarea 
                  rows="3"
                  {...register('remarks')}
                  className="w-full bg-dark-900 border border-slate-850 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-primary-500 transition-colors resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit(onSimulate)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-1 border border-slate-800 hover:border-slate-700 bg-dark-800/40 hover:bg-dark-800 text-slate-200 font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Simulate</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleSubmit(onSaveAndCommit)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-glow disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Route</span>
                </button>
              </div>
            </form>
          </section>

          {/* 2B. Right Display panel (Map, timeline, logs) */}
          <section className="flex-1 p-6 overflow-y-auto relative h-full">
            {/* Loading Indicator Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-dark-950/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center border border-slate-850">
                  <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-200">Recomputing compliance logs...</p>
                  <p className="text-xs text-slate-400 mt-1">Applying FMCSA rules, fuel stops, and rest windows</p>
                </div>
              </div>
            )}

            {/* Error alerts */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-start space-x-3 mb-6 text-xs animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="font-bold">Execution Error</h4>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Route planning view */}
            {!activeTrip ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="glass-panel p-10 rounded-2xl max-w-md border border-slate-850">
                  <Compass className="w-16 h-16 text-primary-500 mx-auto animate-bounce mb-5" />
                  <h3 className="text-lg font-bold text-white mb-2">Truck Route Planner & Compliance Center</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Compute complete HOS compliant schedules under 11-hour driving, 14-hour duty windows, and 70-hour cycle rules. Automatically map routes, fuel stops, and generate printable SVG log sheets.
                  </p>
                  <div className="bg-dark-900 border border-slate-850 px-4 py-2.5 rounded-lg text-[10px] text-slate-500 text-left font-mono">
                    <span className="text-primary-400 block font-bold mb-0.5">Calculations Included:</span>
                    • Fuel stop placement every 1,000 miles<br />
                    • 30-min break after 8 hrs drive<br />
                    • 10-hr off-duty shift reset<br />
                    • 34-hr cycle restarts
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Active Plan Tab Content */}
                {activeTab === 'route' && (
                  <div className="space-y-6">
                    {/* Leaflet Map Row */}
                    <div className="h-96 md:h-[450px]">
                      <MapView 
                        originCoords={activeTrip.origin_coords}
                        pickupCoords={activeTrip.pickup_coords}
                        destinationCoords={activeTrip.destination_coords}
                        routePoints={activeTrip.route_points}
                        originAddress={activeTrip.origin_address}
                        pickupAddress={activeTrip.pickup_address}
                        destinationAddress={activeTrip.destination_address}
                        rawEvents={activeTrip.raw_events}
                      />
                    </div>

                    {/* Timeline & stats */}
                    <TripTimeline tripData={activeTrip} />
                  </div>
                )}

                {/* FMCSA Log Sheets Content */}
                {activeTab === 'logs' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-dark-900/60 p-4 border border-slate-850 rounded-xl">
                      <div>
                        <h3 className="text-sm font-bold text-white">Compliance Log Exports</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Compile daily log charts directly into high-fidelity PDF documents</p>
                      </div>
                      <button 
                        onClick={handleExportPDF}
                        disabled={isLoading}
                        className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Export PDF Logs</span>
                      </button>
                    </div>

                    {/* Visual Logs sheets lists */}
                    <LogSheet 
                      days={activeTrip.days} 
                      carrier={activeTrip.carrier_name} 
                      vehicle={activeTrip.vehicle_id}
                      remarks={activeTrip.remarks}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
