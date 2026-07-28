export function getScannerRefreshPlan(messageType: string) {
  return {
    refreshStream: messageType === 'TICKET_CHECKED_IN',
    refreshDevices: false,
  };
}
