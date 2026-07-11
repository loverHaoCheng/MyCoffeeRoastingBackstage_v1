import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Link, useLocation } from 'react-router-dom';

import { LegalFooter } from '@/modules/legal/components';

import {
  dataDeletionDocument,
  legalContactEmail,
  legalEffectiveDate,
  legalOwnerName,
  privacyDocument,
  termsDocument,
  type LegalDocument,
} from './legalContent';
import styles from './LegalPage.module.css';

type LegalPageKind = 'dataDeletion' | 'privacy' | 'terms';

interface LegalPageProps {
  kind: LegalPageKind;
}

const documents: Record<LegalPageKind, LegalDocument> = {
  dataDeletion: dataDeletionDocument,
  privacy: privacyDocument,
  terms: termsDocument,
};

const legalLinks: { label: string; path: string; kind: LegalPageKind }[] = [
  { label: '用户协议', path: '/terms', kind: 'terms' },
  { label: '隐私政策', path: '/privacy', kind: 'privacy' },
  { label: '数据删除机制', path: '/data-deletion', kind: 'dataDeletion' },
];

const joinClassNames = (...classNames: (string | false | null | undefined)[]) => {
  return classNames.filter((className): className is string => Boolean(className)).join(' ');
};

export function LegalPage({ kind }: LegalPageProps) {
  const location = useLocation();
  const document = documents[kind];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <Link className={styles.brand} to="/login">
            EasyBake
          </Link>
          <nav aria-label="法律文档" className={styles.nav}>
            {legalLinks.map((link) => {
              const isActive = location.pathname === link.path;

              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={joinClassNames(styles.navLink, isActive && styles.navLinkActive)}
                  key={link.path}
                  to={link.path}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <article className={styles.document}>
          <div className={styles.meta}>
            <span className={styles.eyebrow}>Legal</span>
            <h1 className={styles.title}>{document.title}</h1>
            <p className={styles.description}>{document.description}</p>
            <div className={styles.summary} aria-label="文档信息">
              <span className={styles.summaryItem}>生效日期：{legalEffectiveDate}</span>
              <span className={styles.summaryItem}>主体：{legalOwnerName}</span>
              <span className={styles.summaryItem}>联系：{legalContactEmail}</span>
            </div>
          </div>

          <div className={styles.sections}>
            {document.sections.map((section) => (
              <section className={styles.section} key={section.title}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p className={styles.paragraph} key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <footer className={styles.footer}>
            本页面为产品合规说明草案，不构成正式法律意见。正式上线或面向更多地区用户前，建议由专业法律顾问复核。
          </footer>

          <div className={styles.bottomActions}>
            <Button block className={styles.exitButton} href="#/login" icon={<CloseOutlined />}>
              退出
            </Button>
          </div>
        </article>

        <LegalFooter />
      </div>
    </main>
  );
}
