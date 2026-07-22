import React from 'react';
import { FileText, Calendar, Truck, Landmark, Navigation } from 'lucide-react';

export default function LogSheet({ days, carrier, vehicle, remarks }) {
  if (!days || days.length === 0) return null;

  // SVG grid sizing parameters
  const svgWidth = 800;
  const svgHeight = 180;
  const marginLeft = 80;
  const marginRight = 60;
  const marginTop = 30;
  const marginBottom = 20;
  const gridWidth = svgWidth - marginLeft - marginRight;
  const gridHeight = svgHeight - marginTop - marginBottom;
  const numRows = 4;
  const rowHeight = gridHeight / numRows;

  // Map status names to row indexes
  const statusToRowIndex = {
    'OFF_DUTY': 0,
    'SLEEPER': 1,
    'DRIVING': 2,
    'ON_DUTY_ND': 3
  };

  // Get Y coordinate for a specific status
  const getYCoordinate = (status) => {
    const idx = statusToRowIndex[status] ?? 0;
    return marginTop + (idx * rowHeight) + (rowHeight / 2);
  };

  // Convert minutes (0 - 1440) to X coordinate
  const getXCoordinate = (minute) => {
    return marginLeft + (minute / 1440) * gridWidth;
  };

  // Formats date string into readable heading
  const formatDateHeading = (dateStr) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-10" id="pdf-logs-container">
      {days.map((day, dayIdx) => {
        const { date, start_odometer, end_odometer, total_miles, hours_summary, events } = day;
        
        // Generate coordinates for the SVG polyline path representing HOS changes
        const pathPoints = [];
        events.forEach((event, idx) => {
          const xStart = getXCoordinate(event.start_minute);
          const xEnd = getXCoordinate(event.end_minute);
          const y = getYCoordinate(event.event_type);
          
          // Connect to the starting point of this event
          pathPoints.push({ x: xStart, y });
          // Draw to the end of this event
          pathPoints.push({ x: xEnd, y });
        });

        // Convert path points to an SVG polyline string (points="x1,y1 x2,y2 ...")
        const polylinePointsStr = pathPoints.map(pt => `${pt.x},${pt.y}`).join(' ');

        return (
          <div 
            key={date} 
            className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-glass log-sheet-page"
            style={{ pageBreakAfter: 'always' }} // for printing
          >
            {/* Header info */}
            <div className="flex flex-col lg:flex-row justify-between border-b border-slate-850 pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center">
                  <Calendar className="w-5 h-5 text-primary-400 mr-2" />
                  {formatDateHeading(date)}
                </h3>
                <p className="text-xs text-slate-400 mt-1">FMCSA Form 395.8 - Driver's Daily Log</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-dark-900 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">Carrier</span>
                  <span className="font-semibold text-slate-200 flex items-center">
                    <Landmark className="w-3.5 h-3.5 text-primary-400 mr-1 shrink-0" />
                    {carrier}
                  </span>
                </div>
                <div className="bg-dark-900 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">Vehicle ID</span>
                  <span className="font-semibold text-slate-200 flex items-center">
                    <Truck className="w-3.5 h-3.5 text-primary-400 mr-1 shrink-0" />
                    {vehicle}
                  </span>
                </div>
                <div className="bg-dark-900 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">Odometer</span>
                  <span className="font-semibold text-slate-200 flex items-center">
                    <Navigation className="w-3.5 h-3.5 text-primary-400 mr-1 shrink-0" />
                    {Math.round(start_odometer).toLocaleString()} &rarr; {Math.round(end_odometer).toLocaleString()}
                  </span>
                </div>
                <div className="bg-dark-900 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">Total Distance</span>
                  <span className="font-semibold text-slate-200">
                    {Math.round(total_miles)} mi
                  </span>
                </div>
              </div>
            </div>

            {/* SVG LOG GRID */}
            <div className="w-full overflow-x-auto select-none bg-dark-900/40 p-4 rounded-xl border border-slate-850">
              <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="mx-auto"
                style={{ minWidth: '700px' }}
              >
                {/* Defs for gradients & patterns */}
                <defs>
                  <linearGradient id="gridLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8"/>
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.8"/>
                  </linearGradient>
                </defs>

                {/* Grid row background dividers and labels */}
                {Object.entries(statusToRowIndex).map(([status, rowIdx]) => {
                  const yTop = marginTop + rowIdx * rowHeight;
                  const label = status === 'OFF_DUTY' ? 'OFF DUTY' 
                              : status === 'SLEEPER' ? 'SLEEPER' 
                              : status === 'DRIVING' ? 'DRIVING' 
                              : 'ON DUTY';
                  
                  return (
                    <g key={status}>
                      {/* Alternating row stripes */}
                      <rect 
                        x={marginLeft} 
                        y={yTop} 
                        width={gridWidth} 
                        height={rowHeight} 
                        fill={rowIdx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)'}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="0.5"
                      />
                      {/* Row Label */}
                      <text 
                        x={marginLeft - 12} 
                        y={yTop + rowHeight / 2 + 4} 
                        fill="#94a3b8" 
                        fontSize="10" 
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {label}
                      </text>
                      
                      {/* Row Hours Total text at right margin */}
                      <text 
                        x={svgWidth - marginRight + 15} 
                        y={yTop + rowHeight / 2 + 4} 
                        fill="#0ea5e9" 
                        fontSize="12" 
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        {hours_summary[status]?.toFixed(1)}h
                      </text>
                    </g>
                  );
                })}

                {/* Header Labels (Midnight, Noon, Midnight) */}
                <text x={marginLeft} y={marginTop - 10} fill="#64748b" fontSize="8" textAnchor="middle">MDT</text>
                <text x={marginLeft + gridWidth / 2} y={marginTop - 10} fill="#64748b" fontSize="8" textAnchor="middle">NOON</text>
                <text x={marginLeft + gridWidth} y={marginTop - 10} fill="#64748b" fontSize="8" textAnchor="middle">MDT</text>

                {/* Draw vertical grid lines & hour ticks */}
                {Array.from({ length: 25 }).map((_, hr) => {
                  const x = marginLeft + (hr / 24) * gridWidth;
                  
                  // Label coordinates
                  const showLabel = hr > 0 && hr < 24;
                  const labelVal = hr > 12 ? hr - 12 : hr;
                  
                  return (
                    <g key={hr}>
                      {/* Primary Hour Line */}
                      <line 
                        x1={x} 
                        y1={marginTop} 
                        x2={x} 
                        y2={marginTop + gridHeight} 
                        stroke="rgba(255, 255, 255, 0.1)" 
                        strokeWidth="1"
                        strokeDasharray={hr === 12 || hr === 0 || hr === 24 ? "none" : "2,2"}
                      />
                      
                      {/* Hour Number Labels */}
                      {showLabel && (
                        <text 
                          x={x} 
                          y={marginTop - 8} 
                          fill="#64748b" 
                          fontSize="9" 
                          fontWeight="500"
                          textAnchor="middle"
                        >
                          {labelVal}
                        </text>
                      )}

                      {/* Half-hour Ticks (drawn at the top & bottom of the grid) */}
                      {hr < 24 && (
                        <>
                          <line 
                            x1={x + gridWidth / 48} 
                            y1={marginTop} 
                            x2={x + gridWidth / 48} 
                            y2={marginTop + 6} 
                            stroke="rgba(255, 255, 255, 0.2)" 
                            strokeWidth="0.75" 
                          />
                          <line 
                            x1={x + gridWidth / 48} 
                            y1={marginTop + gridHeight - 6} 
                            x2={x + gridWidth / 48} 
                            y2={marginTop + gridHeight} 
                            stroke="rgba(255, 255, 255, 0.2)" 
                            strokeWidth="0.75" 
                          />
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Legend Headers */}
                <text x={svgWidth - marginRight + 15} y={marginTop - 10} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="start">TOTAL</text>

                {/* THE HOS STATUS POLYLINE GRAPH */}
                {polylinePointsStr && (
                  <polyline
                    fill="none"
                    stroke="url(#gridLineGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePointsStr}
                    style={{ filter: 'drop-shadow(0px 0px 4px rgba(14, 165, 233, 0.35))' }}
                  />
                )}
              </svg>
            </div>

            {/* Daily event list / Remarks */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                <FileText className="w-4 h-4 text-primary-400 mr-2" />
                Shift Log Event Details
              </h4>
              
              <div className="overflow-hidden border border-slate-850 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-dark-900 border-b border-slate-850 text-slate-400">
                      <th className="p-3 font-semibold">Time Interval</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Duration</th>
                      <th className="p-3 font-semibold">Odometer Range</th>
                      <th className="p-3 font-semibold">Remarks & Locations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {events.map((e, idx) => {
                      const formatTime = (timeIso) => {
                        return new Date(timeIso).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        });
                      };

                      const statusLabels = {
                        'OFF_DUTY': 'Off Duty',
                        'SLEEPER': 'Sleeper Berth',
                        'DRIVING': 'Driving',
                        'ON_DUTY_ND': 'On Duty (ND)'
                      };

                      return (
                        <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                          <td className="p-3 font-medium text-slate-400">
                            {formatTime(e.start_time)} &rarr; {formatTime(e.end_time)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              e.event_type === 'DRIVING' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' :
                              e.event_type === 'ON_DUTY_ND' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {statusLabels[e.event_type]}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{e.duration_hours.toFixed(1)} hrs</td>
                          <td className="p-3 text-slate-400 font-mono">
                            {e.event_type === 'DRIVING' 
                              ? `${Math.round(e.start_odometer).toLocaleString()} - ${Math.round(e.end_odometer).toLocaleString()} mi`
                              : `${Math.round(e.start_odometer).toLocaleString()} mi`
                            }
                          </td>
                          <td className="p-3 text-slate-200">{e.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer comments block */}
            {dayIdx === days.length - 1 && remarks && (
              <div className="mt-6 p-4 bg-dark-900 border border-slate-850 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Remarks</span>
                <p className="text-xs text-slate-300 leading-relaxed italic">{remarks}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
