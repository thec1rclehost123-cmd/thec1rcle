// React Native already installs fetch, Headers, Request, and Response globally.
// Expo's runtime imports `whatwg-fetch` defensively, so this mobile-local shim
// satisfies that import without bundling a second fetch implementation.
module.exports = {};
