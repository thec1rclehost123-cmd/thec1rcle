module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const android = { ...config.android };

  if (googleMapsApiKey) {
    android.config = {
      ...android.config,
      googleMaps: {
        ...android.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    };
  }

  return {
    ...config,
    android,
  };
};
