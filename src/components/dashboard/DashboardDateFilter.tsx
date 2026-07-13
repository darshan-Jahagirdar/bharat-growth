import {
  DATE_PRESETS,
  type DatePreset,
} from '@/lib/dashboard/dashboardPresentation';

interface DashboardDateFilterProps {
  customEnd: string;
  customStart: string;
  datePreset: DatePreset;
  onCustomEndChange: (value: string) => void;
  onCustomStartChange: (value: string) => void;
  onDatePresetChange: (preset: DatePreset) => void;
}

export function DashboardDateFilter({
  customEnd,
  customStart,
  datePreset,
  onCustomEndChange,
  onCustomStartChange,
  onDatePresetChange,
}: DashboardDateFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mr-1">
        Period
      </span>
      {DATE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          onClick={() => onDatePresetChange(preset.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${datePreset === preset.key
              ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
              : 'text-gray-400 border border-white/5 hover:border-white/10 hover:text-gray-300'
            }`}
        >
          {preset.label}
        </button>
      ))}

      {datePreset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customStart}
            onChange={(event) => onCustomStartChange(event.target.value)}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300
                       focus:outline-none focus:border-orange-500/40"
          />
          <span className="text-gray-600 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(event) => onCustomEndChange(event.target.value)}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300
                       focus:outline-none focus:border-orange-500/40"
          />
        </div>
      )}
    </div>
  );
}
