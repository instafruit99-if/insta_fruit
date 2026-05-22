const { googleMapsApiKey } = require('../config/env');

function pickComponent(components, type) {
  return components.find((c) => c.types.includes(type))?.long_name ?? '';
}

function parseGoogleResult(result) {
  const ac = result.address_components;
  const locality =
    pickComponent(ac, 'sublocality_level_1') ||
    pickComponent(ac, 'sublocality') ||
    pickComponent(ac, 'neighborhood') ||
    pickComponent(ac, 'locality');
  const city =
    pickComponent(ac, 'locality') ||
    pickComponent(ac, 'administrative_area_level_2');
  const route = pickComponent(ac, 'route');
  const streetNumber = pickComponent(ac, 'street_number');
  const line1 =
    [streetNumber, route].filter(Boolean).join(' ') ||
    result.formatted_address.split(',')[0]?.trim() ||
    '';

  return {
    locality: locality || city,
    city: city || locality,
    state: pickComponent(ac, 'administrative_area_level_1'),
    postalCode: pickComponent(ac, 'postal_code'),
    country: pickComponent(ac, 'country'),
    line1,
    formattedAddress: result.formatted_address,
  };
}

async function reverseGeocode(req, res) {
  try {
    if (!googleMapsApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key is not configured',
      });
    }

    const { lat, lng } = req.body ?? {};
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng are required',
      });
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates',
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return res.status(404).json({
        success: false,
        message: data.error_message ?? 'Address not found',
      });
    }

    res.status(200).json(parseGoogleResult(data.results[0]));
  } catch (error) {
    console.error('Reverse geocode failed:', error);
    res.status(500).json({
      success: false,
      message: error.message ?? 'Reverse geocode failed',
    });
  }
}

module.exports = {
  reverseGeocode,
};
