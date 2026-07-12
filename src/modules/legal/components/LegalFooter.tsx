import styles from './LegalFooter.module.css';

interface RecordLink {
  href: string;
  text: string;
  ariaLabel: string;
}

const recordLinks: RecordLink[] = [
  {
    href: 'https://beian.miit.gov.cn/',
    text: '冀ICP备2026025428号-1',
    ariaLabel: '冀ICP备2026025428号-1，点击跳转至工信部备案管理系统',
  },
];

export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      {recordLinks.map((recordLink) => (
        <a
          aria-label={recordLink.ariaLabel}
          className={styles.recordLink}
          href={recordLink.href}
          key={recordLink.text}
          rel="noopener noreferrer"
          target="_blank"
          title={recordLink.ariaLabel}
        >
          {recordLink.text}
        </a>
      ))}
    </footer>
  );
}
