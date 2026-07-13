import styles from './LegalFooter.module.css';

interface RecordLink {
  iconSrc?: string;
  href: string;
  text: string;
  ariaLabel: string;
}

const recordLinks: RecordLink[] = [
  {
    iconSrc: '/beian-police.png',
    href: 'https://beian.mps.gov.cn/#/query/webSearch?code=13060902000317',
    text: '冀公网安备13060902000317号',
    ariaLabel: '冀公网安备13060902000317号，点击跳转至全国互联网安全管理服务平台',
  },
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
          {recordLink.iconSrc ? (
            <img alt="" aria-hidden="true" className={styles.recordIcon} src={recordLink.iconSrc} />
          ) : null}
          {recordLink.text}
        </a>
      ))}
    </footer>
  );
}
