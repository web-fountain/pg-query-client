import type { PanelSide }               from '../utils/constants';
import { useEffect, useState }          from 'react';
import { readMinMax, readCurrentWidth } from '../utils/cssVars';


// AIDEV-NOTE: Low-risk ARIA sync hook; no state updates in drag hot paths
function useSeparatorAria(side: PanelSide) {
  const [ariaMin, setAriaMin] = useState<number | undefined>(undefined);
  const [ariaMax, setAriaMax] = useState<number | undefined>(undefined);
  const [ariaNow, setAriaNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    const init = () => {
      const { min, max } = readMinMax();
      const cur = readCurrentWidth(side);
      setAriaMin(min);
      setAriaMax(max);
      setAriaNow(cur);
    };
    init();

    const onWidthsEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<{ lw: number; rw: number }>).detail;
      if (!detail) return;

      const { min, max } = readMinMax();
      setAriaNow(side === 'left' ? detail.lw : detail.rw);
      setAriaMin(min);
      setAriaMax(max);
    };

    window.addEventListener('op-space-layout-widths', onWidthsEvent as EventListener);
    return () => {
      window.removeEventListener('op-space-layout-widths', onWidthsEvent as EventListener);
    };
  }, [side]);

  const controlledId = `op-space-layout-${side}-panel`;
  return { ariaMin, ariaMax, ariaNow, setAriaNow, controlledId } as const;
}

export { useSeparatorAria };
