import { useEffect, useState } from 'react';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { Page } from '../Page';
import { Row, Section } from '../settings/Layout';

/** Version, licence, source code and logs (spec J3 § 4.5). */
export function AboutPage() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    void commands.appInfo().then((r) => {
      if (r.status === 'ok') setVersion(r.data.version);
    });
  }, []);
  const action =
    'k-press flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium hover:bg-white/5';
  const actionStyle = {
    borderColor: 'var(--k-border)',
    background: 'transparent',
    color: 'var(--k-text)',
  };
  return (
    <Page title={t('about.title')}>
      <div className="flex max-w-[760px] items-center gap-4">
        <Logo size={44} />
        <div className="flex flex-col gap-1">
          <span className="text-[20px] font-semibold tracking-tight">Kirishot</span>
          <span className="text-[13px]" style={{ color: 'var(--k-text-2)' }}>
            {t('about.tagline')}
          </span>
        </div>
      </div>
      <div className="max-w-[760px]">
        <Section title={t('about.title')}>
          <Row label={t('about.version', { version })} hint={t('about.license')}>
            <button
              type="button"
              className={action}
              style={actionStyle}
              onClick={() => void commands.openRepository()}
            >
              <ExternalLink size={14} />
              {t('about.repository')}
            </button>
          </Row>
          <Row label={t('about.logs')} hint={t('about.logsHint')}>
            <button
              type="button"
              className={action}
              style={actionStyle}
              onClick={() => void commands.openLogsFolder()}
            >
              <FolderOpen size={14} />
              {t('settings.open')}
            </button>
          </Row>
        </Section>
      </div>
    </Page>
  );
}
