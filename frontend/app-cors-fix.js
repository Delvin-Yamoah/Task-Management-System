// Add this function at the beginning of your app.js file
function fetchWithCORS(url, options = {}) {
  // Add CORS mode to all fetch requests
  return fetch(url, {
    ...options,
    mode: 'cors',
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    }
  });
}

// Then replace all fetch calls with fetchWithCORS
// For example:
// Instead of:
// fetch(`${awsConfig.apiEndpoint}/tasks`, { headers: { 'Authorization': idToken } })
// Use:
// fetchWithCORS(`${awsConfig.apiEndpoint}/tasks`, { headers: { 'Authorization': idToken } })