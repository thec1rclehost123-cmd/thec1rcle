import { useMemo, useState } from "react";
import { accentNames, getAccentToken, type AccentName } from "../design-system/tokens";

export const useAccentColor = (initial: AccentName = "iris") => {
  const [accent, setAccent] = useState<AccentName>(initial);
  const token = useMemo(() => getAccentToken(accent), [accent]);

  const cycleAccent = () => {
    const currentIndex = accentNames.indexOf(accent);
    const nextIndex = (currentIndex + 1) % accentNames.length;
    setAccent(accentNames[nextIndex]);
  };

  return { accent, accentToken: token, setAccent, cycleAccent };
};

export default useAccentColor;
