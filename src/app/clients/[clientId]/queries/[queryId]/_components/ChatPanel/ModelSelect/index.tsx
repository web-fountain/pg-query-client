'use client';

import styles from './styles.module.css';

type Props = {
  model?: string;
  onChange?: (val: string) => void;
};

const MODELS = [
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4o',
  'claude-3-opus',
  'claude-3-sonnet'
];

function ModelSelect({ model = MODELS[0], onChange }: Props) {
  return (
    <label className={styles['model-select']}>
      <select
        value={model}
        onChange={(e) => onChange?.(e.target.value)}
        className={styles['select']}
      >
        {MODELS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </label>
  );
}

export default ModelSelect;
