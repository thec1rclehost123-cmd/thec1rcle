import axios from 'axios';

async function checkApi() {
  const venueId = 'venue_NPpsWyAw';
  const url = `http://localhost:4000/api/v1/analytics/reach?venueId=${venueId}&range=30d`;

  try {
    console.log(`📡 Fetching: ${url}`);
    const res = await axios.get(url);
    console.log('✅ Response Status:', res.status);
    console.log('✅ Response Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ API Error:', err.response?.status, err.response?.data || err.message);
  }
}

checkApi();
