import styles from './LegalFooter.module.css';

const recordLinks: { href: string; text: string }[] = [
  {
    href: 'https://beian.miit.gov.cn/',
    text: '冀ICP备2026025428号-1',
  },
];

export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      {recordLinks.map((recordLink) => (
        <a
          className={styles.recordLink}
          href={recordLink.href}
          key={recordLink.text}
          rel="noopener noreferrer"
          target="_blank"
        >
          {recordLink.text}
        </a>
      ))}
    </footer>
  );
}
