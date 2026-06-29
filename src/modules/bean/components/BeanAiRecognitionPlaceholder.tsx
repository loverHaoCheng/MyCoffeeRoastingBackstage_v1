import styles from './BeanAiRecognitionPlaceholder.module.css';

export function BeanAiRecognitionPlaceholder() {
  return (
    <section className={styles.panel}>
      <div className={styles.hero}>
        <h3>AI 图片识别预留</h3>
        <p>后续这里会接入上传袋标、采购单或生豆标签图片，自动识别并回填基础字段。</p>
      </div>

      <ol className={styles.list}>
        <li>上传图片后优先提取编号、名称、产地、处理法、海拔、含水率、密度和处理厂。</li>
        <li>识别结果会先进入待确认状态，再由你一键写入表单，避免误识别直接入库。</li>
        <li>未来可继续扩展为多图识别、OCR 纠错和供应商模板学习。</li>
      </ol>

      <p className={styles.hint}>当前版本先保留页面结构，方便后面直接接入上传、OCR 与 AI 字段映射。</p>
    </section>
  );
}
