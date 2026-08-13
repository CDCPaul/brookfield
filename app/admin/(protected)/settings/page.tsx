import { LimitsForm } from '@/components/admin/limits-form';
import { Card, SectionTitle } from '@/components/ui';
import { getLimits } from '@/lib/queries/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const limits = await getLimits();

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          These take effect immediately and are shown on the residents&apos;
          Rules page.
        </p>
      </section>

      <section>
        <SectionTitle>Booking limits</SectionTitle>
        <Card>
          <LimitsForm limits={limits} />
        </Card>
      </section>
    </div>
  );
}
