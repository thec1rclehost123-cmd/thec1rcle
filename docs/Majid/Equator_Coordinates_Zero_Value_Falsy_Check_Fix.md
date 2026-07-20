# Equator Coordinates Zero Value Falsy Check Fix

## 1. What was actual Bug
In JavaScript/TypeScript, the number `0` is a falsy value. Across several parts of the application, truthiness checks (such as `!coords?.latitude`, `coords?.latitude && coords?.longitude`, or `!lat || !lng`) were used to validate the presence of geographical coordinates (latitude and longitude).
Because of these falsy checks, whenever an event or venue was located at the Equator (0° Latitude) or Prime Meridian (0° Longitude), the `0` coordinate value was incorrectly evaluated as falsy. As a result:
- In `event-service.ts`, events at 0° latitude were rejected and mapped to `null` in the nearby event search.
- In `event-repository.ts`, geohash snapshots were not embedded for events at the equator or prime meridian, making them completely un-queryable for geohash-based spatial queries.
- In `matching-service.ts`, proximity scores for events at the equator or prime meridian defaulted to `0.5` instead of being calculated correctly.
- In `social.ts` (API Gateway), SOS alerts triggered at 0° latitude or longitude saved their locations as `null`.
- In the frontend (`VenueDetails.jsx` and `VenueQuickActions.jsx`), maps did not embed correctly and directions URLs fell back to address text when coordinates were exactly `0`.

## 2. What is solution to solve that Bug
The solution is to replace the truthiness checks on coordinates with explicit nullish validation (`latitude != null` / `longitude != null` or comparing to `undefined` and `null`). This ensures that `0` is treated as a valid numeric coordinate and not filtered out.

## 3. What Changes You made to fix this Bug
We made the following minimal and robust changes to resolve the bug across the backend, API Gateway, and frontend components:

1. **Backend / Core Engine**:
   - **`packages/core/src/infrastructure/repositories/firebase/event-repository.ts`**: Updated the geohash embedding check:
     ```typescript
     if (coords?.latitude != null && coords?.longitude != null) {
     ```
   - **`packages/core/src/domain/services/matching-service.ts`**: Hardened the proximity score check to check for nullish inputs and target coordinates fields:
     ```typescript
     if (lat == null || lng == null || !target.coordinates || target.coordinates.latitude == null || target.coordinates.longitude == null) return 0.5;
     ```
   - **`packages/core/matching-service.test.ts`**: Added a new unit test verifying that `calculateProximityScore` correctly calculates scores for Equator coordinates `(0, 0)`.

2. **API Gateway**:
   - **`apps/api-gateway/src/routes/v1/events.ts`**: Modified `/events/nearby` validation check to allow `0` value coordinates:
     ```typescript
     if (lat == null || lat === '' || lng == null || lng === '')
     ```
   - **`apps/api-gateway/src/routes/v1/social.ts`**: Updated location coordinates check in POST `/social/sos` route:
     ```typescript
     location: latitude != null && longitude != null ? { latitude, longitude } : null,
     ```

3. **Frontend (Guest Portal)**:
   - **`apps/guest-portal/components/venue/VenueDetails.jsx`**: Changed coordinates presence validation for Google Maps embed URL:
     ```javascript
     coordinates?.lat != null && coordinates?.lng != null
     ```
   - **`apps/guest-portal/components/venue/VenueQuickActions.jsx`**: Hardened coordinate check to verify coordinates are not undefined or null:
     ```javascript
     const lat = venue.coordinates?.lat !== undefined && venue.coordinates?.lat !== null
       ? venue.coordinates.lat
       : venue.location?.latitude;
     const lng = venue.coordinates?.lng !== undefined && venue.coordinates?.lng !== null
       ? venue.coordinates.lng
       : venue.location?.longitude;

     if (lat != null && lng != null) {
     ```
