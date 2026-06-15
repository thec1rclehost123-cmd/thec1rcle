import VenuePayoutsSettingsClient from './PageClient';

export const metadata = {
  title: 'Payout Settings | Finance | Venue Dashboard',
  description: 'Manage bank accounts, payout schedule, and settlement history.',
};

export default function VenuePayoutsSettingsPage() {
  return <VenuePayoutsSettingsClient />;
}
