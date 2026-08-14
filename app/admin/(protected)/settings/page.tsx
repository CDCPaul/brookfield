import {
  CourtsForm,
  HoursForm,
  LimitsForm,
  NotifyForm,
  PaymentForm,
  PricingForm,
} from '@/components/admin/settings-forms';
import { isSmsConfigured } from '@/lib/notify/sms';
import { Card, SectionTitle } from '@/components/ui';
import { getSettings } from '@/lib/queries/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { limits, schedule, pricing, payment, courts, notify } =
    await getSettings();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Changes take effect immediately and are shown to residents.
        </p>
      </section>

      <section>
        <SectionTitle>Opening hours</SectionTitle>
        <Card>
          <HoursForm schedule={schedule} />
        </Card>
      </section>

      <section>
        <SectionTitle>Text messages</SectionTitle>
        <Card>
          <NotifyForm notify={notify} smsReady={isSmsConfigured()} />
        </Card>
      </section>

      <section>
        <SectionTitle>Which courts are bookable</SectionTitle>
        <Card>
          <CourtsForm courts={courts} />
        </Card>
      </section>

      <section>
        <SectionTitle>Court fees</SectionTitle>
        <Card>
          <PricingForm pricing={pricing} />
        </Card>
      </section>

      <section>
        <SectionTitle>Payment</SectionTitle>
        <Card>
          <PaymentForm payment={payment} />
        </Card>
      </section>

      <section>
        <SectionTitle>Free-hour limits</SectionTitle>
        <Card>
          <LimitsForm limits={limits} />
        </Card>
      </section>
    </div>
  );
}
