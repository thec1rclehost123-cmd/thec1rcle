/**
 * react-native-maps web stub.
 * react-native-maps uses codegenNativeComponent which doesn't exist in RN Web.
 * This stub exports no-op components and constants so the app bundles on web.
 */
'use strict';

const React = require('react');
const { View } = require('react-native');

const MapView = React.forwardRef(function MapView(props, _ref) {
  return React.createElement(View, {
    style: [{ flex: 1, backgroundColor: '#111' }, props.style],
  });
});
MapView.displayName = 'MapView';

function noop() {
  return null;
}

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = noop;
module.exports.Polyline = noop;
module.exports.Polygon = noop;
module.exports.Circle = noop;
module.exports.Callout = noop;
module.exports.CalloutSubview = noop;
module.exports.Overlay = noop;
module.exports.Heatmap = noop;
module.exports.Geojson = noop;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = null;
