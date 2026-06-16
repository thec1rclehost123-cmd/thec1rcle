#!/bin/bash
components=(
  "PromoterPageTransition"
  "PromoterSidebarWrapper"
  "PromoterPlaceholderPage"
  "PromoterSidebar"
  "TierProgressBar"
  "PromoterFunnelChart"
  "PromoterAssignmentCard"
  "PromoterAssignmentsPageClient"
  "PromoterFinanceClient"
  "PromoterGuestsPageClient"
  "PromoterActiveEventsRail"
  "PromoterConversionSnapshot"
  "PromoterKPIGrid"
  "PromoterLeaderboardCard"
  "PromoterOverviewClient"
  "PromoterTopLinkCard"
  "PromoterProfileClient"
  "IdentityPanel"
  "PayoutConfig"
  "SecurityHub"
  "VerificationStepper"
)

for comp in "${components[@]}"; do
  echo "Checking $comp..."
  count=$(grep -R "$comp" apps/partner-dashboard/app apps/partner-dashboard/components apps/partner-dashboard/lib | wc -l)
  echo "$comp total occurrences: $count"
done
