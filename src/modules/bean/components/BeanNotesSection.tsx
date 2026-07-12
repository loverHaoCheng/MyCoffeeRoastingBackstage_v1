import Input from 'antd/es/input';
import { Controller, type Control } from 'react-hook-form';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import styles from './BeanForm.module.css';

const { TextArea } = Input;

export function BeanNotesSection({ control }: { control: Control<GreenBeanFormInput> }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h3>补充说明</h3>
        <p>这里预留给杯测、批次备注和未来 AI 图像识别回填结果。</p>
      </header>
      <label className={styles.notesField} data-field-path="notes">
        <span className={styles.labelText}>备注</span>
        <Controller control={control} name="notes" render={({ field }) => <TextArea {...field} aria-label="备注" autoSize={{ minRows: 4, maxRows: 8 }} placeholder="例如 到港时间、杯测要点、特殊批次说明" value={field.value ?? ''} />} />
      </label>
      <div className={styles.linkedHint}>烘焙方案、烘焙记录不会在这里手动填写，创建生豆后会在烘焙模块继续关联。</div>
    </section>
  );
}
