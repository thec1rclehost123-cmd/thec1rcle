import { Image } from 'react-native';

const assetUri = (source: number) => Image.resolveAssetSource(source).uri;

export const DEMO_POSTERS = {
  afterhours: assetUri(require('../../assets/posters/afterhours.jpg')),
  aquaSundays: assetUri(require('../../assets/posters/aqua-sundays.jpg')),
  eclipse: assetUri(require('../../assets/posters/eclipse.jpg')),
  houseOfAfro: assetUri(require('../../assets/posters/house-of-afro.jpg')),
  logoCircle: assetUri(require('../../assets/posters/logo-circle.jpg')),
  midnightClub: assetUri(require('../../assets/posters/midnight-club.jpg')),
  neonDistrict: assetUri(require('../../assets/posters/neon-district.jpg')),
  noSignal: assetUri(require('../../assets/posters/no-signal.jpg')),
  redRoom: assetUri(require('../../assets/posters/red-room.jpg')),
  velvetNights: assetUri(require('../../assets/posters/velvet-nights.jpg')),
} as const;
