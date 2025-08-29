'use client';

import { memo, useEffect, useRef, useState } from 'react';
import Icon from '@Components/Icons';
import styles from './styles.module.css';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole
} from '@floating-ui/react';

type Props = {
  model?: string;
  onChange?: (val: string) => void;
  placement?: 'top' | 'bottom';
};

const MODELS = [
  'claude-4-sonnet',
  'claude-4.1-opus',
  'gpt-5',
  'gpt-5-high',
  'gpt-5-fast'
];

function ModelSelect({ model = MODELS[0], onChange, placement = 'top' }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [menuMinWidth, setMenuMinWidth] = useState<number>(220);
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const COLLAPSE_AT = 120; // px threshold for hiding label text (control-local)
  const PANEL_COLLAPSE_AT = 238; // px threshold based on chat panel width

  // AIDEV-NOTE: Use Floating UI to position the popover below the trigger,
  // fixed strategy prevents clipping by scroll containers.
  const {refs, floatingStyles, context} = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
    middleware: [
      // AIDEV-NOTE: mainAxis=8px vertical gap; crossAxis=-4px shifts popover 4px to the left
      offset({ mainAxis: 4, crossAxis: -4 }),
      flip({ padding: 8 }),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${menuMinWidth}px`,
            maxHeight: `${Math.min(availableHeight, 280)}px`
          });
        }
      })
    ]
  });

  const click = useClick(context, { event: 'click' });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  // AIDEV-NOTE: Observe container width to toggle collapsed text and remember a stable menu width.
  useEffect(() => {
    function measure() {
      const panel = containerRef.current?.closest('[data-panel-side]') as HTMLElement | null;
      const panelW = panel ? panel.getBoundingClientRect().width : 0;
      const parent = containerRef.current?.parentElement;
      const fallback = containerRef.current;
      const node = parent || fallback;
      if (!node) return;
      const nodeW = node.getBoundingClientRect().width;

      if (panelW) {
        const collapseByPanel = panelW <= PANEL_COLLAPSE_AT;
        setCollapsed(collapseByPanel);
        if (!collapseByPanel) {
          const trigger = (refs.reference as any)?.current as HTMLElement | null;
          const triggerW = trigger ? trigger.getBoundingClientRect().width : nodeW;
          setMenuMinWidth((prev) => Math.max(prev, Math.round(Math.max(triggerW, 200))));
        }
        return;
      }

      const isCollapsed = nodeW < COLLAPSE_AT;
      setCollapsed(isCollapsed);
      if (!isCollapsed) {
        const trigger = (refs.reference as any)?.current as HTMLElement | null;
        const triggerW = trigger ? trigger.getBoundingClientRect().width : nodeW;
        setMenuMinWidth((prev) => Math.max(prev, Math.round(Math.max(triggerW, 200))));
      }
    }

    measure();

    const ro = new ResizeObserver(() => measure());
    const target = (containerRef.current?.closest('[data-panel-side]') as HTMLElement | null) || containerRef.current?.parentElement || containerRef.current;
    if (target) ro.observe(target);
    return () => ro.disconnect();
  }, [refs.reference]);

  const chevronName = placement === 'bottom' ? 'chevron-up' : 'chevron-down';

  return (
    <label ref={containerRef} className={styles['model-select']} data-collapsed={collapsed || undefined}>
      <span className={styles['icon']}>
        <Icon name="brain" aria-hidden="true" />
      </span>

      <button
        type="button"
        className={styles['select']}
        ref={refs.setReference}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={collapsed ? `Model: ${model}` : undefined}
        {...getReferenceProps()}
      >
        {!collapsed && (
          <span className={styles['label']}>{model}</span>
        )}
      </button>

      <span className={styles['chevron']} aria-hidden="true">
        <Icon name={chevronName} />
      </span>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles['popover']}
            onMouseDown={(e) => { e.stopPropagation(); }}
            {...getFloatingProps()}
          >
            <ul role="listbox" className={styles['options']} aria-label="Models" onMouseDown={(e) => { e.stopPropagation(); }}>
              {MODELS.map((m) => (
                <li
                  key={m}
                  role="option"
                  className={styles['option']}
                  data-selected={(m === model) || undefined}
                  onClick={() => {
                    onChange?.(m);
                    setOpen(false);
                  }}
                >
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </FloatingPortal>
      )}
    </label>
  );
}

export default memo(ModelSelect);
