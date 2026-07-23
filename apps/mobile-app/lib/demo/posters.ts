import { Image } from 'react-native';

const assetUri = (source: number) =>
  (Image?.resolveAssetSource ? Image.resolveAssetSource(source)?.uri : String(source)) ||
  String(source);

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
  newPoster1: assetUri(require('../../assets/posters/playboy_delhi.png')),
  newPoster2: assetUri(require('../../assets/posters/new_poster_2.png')),
  newPoster3: assetUri(require('../../assets/posters/new_poster_3.png')),
  newPoster4: assetUri(require('../../assets/posters/new_poster_4.jpg')),
  newPoster5: assetUri(require('../../assets/posters/new_poster_5.png')),
} as const;
