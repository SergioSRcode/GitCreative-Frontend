import type { RGBColor } from "../types/color";
import { rgbToHex } from "../utils/color";

type Props = {
  colors: RGBColor[],
  onSelect: (color: RGBColor) => void,
};

export function RecentColors({ colors, onSelect }: Props) {
  if (colors.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Recent</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {colors.map((color, i) => (
          <div
            key={i}
            onClick={() => onSelect(color)}
            title={rgbToHex(color)}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: rgbToHex(color),
              border: '1px solid rgba(0,0,0,0.15)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}

