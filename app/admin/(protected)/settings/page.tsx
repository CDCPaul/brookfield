import {
  CourtsForm,
  HoursForm,
  LimitsForm,
  NotifyForm,
  PaymentForm,
  PricingForm,
} from '@/components/admin/settings-forms';
import { PushToggle } from '@/components/push-toggle';
import { isSmsConfigured } from '@/lib/notify/sms';
import { isPushConfigured, publicVapidKey } from '@/lib/notify/push';
import { Card, Notice, SectionTitle } from '@/components/ui';
import { countSubscriptions } from '@/lib/queries/push';
import { getSettings } from '@/lib/queries/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { limits, schedule, pricing, payment, courts, notify } =
    await getSettings();
  const pushReady = isPushConfigured();
  const devices = pushReady
    ? await countSubscriptions()
    : { admin: 0, booker: 0 };

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
        <SectionTitle>Notifications</SectionTitle>
        <Card>
          <NotifyForm notify={notify} smsReady={isSmsConfigured()} />
        </Card>
      </section>

      <section>
        <SectionTitle>Notifications on this device</SectionTitle>
        <Card className="space-y-3">
          {pushReady ? (
            <>
              <PushToggle
                vapidKey={publicVapidKey()}
                audience="admin"
                label="Alert me here when a court is requested"
                hint="Applies to this browser only. Turn it on wherever you approve requests."
              />
              <p className="text-xs text-muted">
                {devices.admin} association{' '}
                {devices.admin === 1 ? 'device' : 'devices'} and {devices.booker}{' '}
                booker {devices.booker === 1 ? 'device' : 'devices'} are signed
                up. Add the app to your home screen first if you are on an
                iPhone.
              </p>
            </>
          ) : (
            <Notice tone="error">
              Browser notifications are switched off because no VAPID keys are
              set on the server. Text messages are unaffected.
            </Notice>
          )}
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
