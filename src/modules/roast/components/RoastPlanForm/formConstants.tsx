import styles from '../RoastPlanManualCreator.module.css';

export const GENERIC_BEAN_ID = 'generic';
export const GENERIC_BEAN_NAME = '通用';

export const renderLabel = (label: string, required = false) => {
  return (
    <span className={styles.labelText}>
      {label}
      {required ? (
        <em aria-hidden="true" className={styles.requiredMark}>
          *
        </em>
      ) : null}
    </span>
  );
};
