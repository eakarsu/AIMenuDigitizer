import './NativeAIControls.css';

export interface AIPreset<T> {
  name: string;
  values: T;
}

interface Props<T> {
  presets: AIPreset<T>[];
  onSelect: (values: T, index: number) => void;
  disabled?: boolean;
  description?: string;
}

export default function AIPresetButtons<T>({
  presets,
  onSelect,
  disabled = false,
  description = 'Each example fills every editable AI field, including optional context. Existing record selections and uploaded files are preserved.',
}: Props<T>) {
  return (
    <div className="native-ai-controls" data-testid="ai-preset-buttons">
      <div>
        <strong>Demo AI · fill all fields</strong>
        <span>{description}</span>
      </div>
      <div className="native-ai-control-buttons">
        {presets.map((preset, index) => (
          <button
            key={preset.name}
            type="button"
            disabled={disabled}
            data-ai-preset={preset.name}
            onClick={() => onSelect(preset.values, index)}
          >
            Demo AI · {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
