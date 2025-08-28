'use client';

import Icon   from '@Components/Icons';
import styles from './styles.module.css';

type Props = {
  tags?: string[];
  onToggle?: (tag: string) => void;
};

const DEFAULT_LABEL = '@ Add Context';

function TagTabs({ tags = [], onToggle }: Props) {
  const items = [DEFAULT_LABEL, ...tags];

  return (
    <div className={styles['tags']}>
      {items.map((tag) => {
        const isDefault = tag === DEFAULT_LABEL;
        const display   = isDefault ? (tags.length > 0 ? '@' : DEFAULT_LABEL) : tag;
        const className = isDefault ? styles['tag'] : styles['tag-chip'];

        return (
          <button
            key={tag}
            type="button"
            className={className}
            onClick={() => {
              if (isDefault) {
                console.log('Default context tag clicked');
              } else {
                console.log('Tag clicked:', tag);
                onToggle?.(tag);
              }
            }}
          >
            <span className={styles['label']}>{display}</span>
            {!isDefault && (
              <span className={styles['close']}
                onClick={(e) => { e.stopPropagation(); console.log('Remove tag:', tag); onToggle?.(tag); }}
                aria-label={`Remove ${tag}`}
                role="img"
              >
                <Icon name="x" width={12} height={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TagTabs;
