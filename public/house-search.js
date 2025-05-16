function renderPropertiesPage(properties, page) {
  grid.innerHTML = "";
  
  if (properties.length === 0) {
    grid.innerHTML = `
      <div class="alert alert-info w-100 text-center" role="alert">
        No listings found matching your criteria.
      </div>
    `;
    return;
  }
  
  const start = (page - 1) * listingsPerPage;
  const end = start + listingsPerPage;
  const pageListings = properties.slice(start, end);

  // First just render the basic property cards WITHOUT financial calculations
  pageListings.forEach((prop) => {
    const status = prop.statusText;
    if (status && status.toLowerCase() === "auction") return; 

    const img = prop.image || prop.imgSrc || "https://via.placeholder.com/350x200";
    const price = prop.price || "N/A";
    const city = prop.location?.split(',')[0] || prop.addressCity || "N/A";
    const state = prop.location?.split(',')[1]?.trim() || prop.addressState || "MD";
    const zip = prop.zip || prop.hdpData?.homeInfo?.zipcode || prop.addressZipcode || "";
    const beds = prop.bedrooms || prop.beds || "N/A";
    const baths = prop.bathrooms || prop.baths || "N/A";
    const listingUrl = prop.listing_url || (prop.detailUrl ? `${prop.detailUrl}` : "#");
    
    const propId = `prop-${zip}-${beds}-${parsePrice(price)}`.replace(/[^a-zA-Z0-9-]/g, '');

    grid.innerHTML += `
      <div class="card m-2 shadow prop-card" id="${propId}" style="width: 20rem;" data-zip="${zip}" data-beds="${beds}" data-price="${price}">
        <img src="${img}" class="card-img-top" alt="Property image" loading="lazy">
        <div class="card-body">
          <h5 class="card-title">${city}, ${state} ${zip ? `(${zip})` : ''}</h5>
          <p class="card-text">
            <strong>County:</strong> <span class="county-data">Loading...</span><br>
            <strong>Price:</strong> ${price}<br>
            <strong>Bedrooms:</strong> ${beds} &nbsp; 
            <strong>Bathrooms:</strong> ${baths}<br>
            <strong>Estimated Rent:</strong> <span class="rent-data">Calculating...</span><br>
            <strong>Estimated Mortgage:</strong> <span class="mortgage-data">Calculating...</span><br>
            <strong>Cashflow:</strong> <span class="cashflow-data">Calculating...</span><br>
            <a href="${listingUrl}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">View Listing</a>
          </p>
        </div>
      </div>
    `;
  });
  
  // THEN trigger calculations for visible cards only
  // This gives the UI time to render and feels more responsive
  setTimeout(() => {
    calculateVisibleProperties();
  }, 100);
}

// New function to calculate only visible properties
function calculateVisibleProperties() {
  // Get all property cards that are currently in the DOM
  const visibleCards = document.querySelectorAll('.prop-card');
  
  // Process each visible card one by one
  visibleCards.forEach(card => {
    // Get property data from data attributes
    const zip = card.dataset.zip;
    const beds = card.dataset.beds;
    const price = card.dataset.price;
    
    // Update county info
    const countyElement = card.querySelector('.county-data');
    countyElement.textContent = getCountyByZip(zip);
    
    // Calculate mortgage (this is fast and doesn't need API)
    const mortgagePayment = estimateMortgage(price);
    const mortgageElement = card.querySelector('.mortgage-data');
    mortgageElement.textContent = mortgagePayment !== "N/A" ? `$${mortgagePayment.toLocaleString()}` : "N/A";
    
    // Queue up rent calculation (this is what's slow with API calls)
    calculateRentForCard(card, zip, beds);
  });
}

// New function to handle rent calculations separately (potentially async)
function calculateRentForCard(card, zip, beds) {
  const rentElement = card.querySelector('.rent-data');
  const cashflowElement = card.querySelector('.cashflow-data');
  
  // Skip if no zip code
  if (!zip) {
    rentElement.textContent = "N/A";
    cashflowElement.innerHTML = "N/A";
    return;
  }
  
  // First check if we already have the data in memory
  const fips = getCountyFipsByZip(zip);
  
  if (fips && allRentData[fips]) {
    // We have the data, calculate immediately
    const rentAmount = estimateRent(zip, beds);
    rentElement.textContent = rentAmount !== "N/A" ? `$${rentAmount}` : rentAmount;
    
    // Now we can calculate cashflow
    const mortgageElement = card.querySelector('.mortgage-data');
    const mortgageText = mortgageElement.textContent;
    const cashflow = calculateCashflow(rentAmount, mortgageText);
    cashflowElement.innerHTML = cashflow;
  } else {
    // Need to fetch the data
    rentElement.textContent = "Loading...";
    cashflowElement.innerHTML = "Loading...";
    
    // Load rent data for this zip
    loadRentDataForZip(zip).then(() => {
      // Once loaded, update the card
      const rentAmount = estimateRent(zip, beds);
      rentElement.textContent = rentAmount !== "N/A" ? `$${rentAmount}` : rentAmount;
      
      // Now calculate cashflow
      const mortgageElement = card.querySelector('.mortgage-data');
      const mortgageText = mortgageElement.textContent;
      const cashflow = calculateCashflow(rentAmount, mortgageText);
      cashflowElement.innerHTML = cashflow;
    });
  }
}

// Modify loadRentDataForZip to return a promise
async function loadRentDataForZip(zip) {
  if (!zip || !isZipDatabaseLoaded || !isCountyMappingLoaded) return Promise.resolve();
  
  const countyName = getCountyByZip(zip);
  if (countyName === "N/A") return Promise.resolve();
  
  const fips = getFipsByCountyName(countyName);
  if (!fips) return Promise.resolve();
  
  // If we already have the data, just return
  if (allRentData[fips]) return Promise.resolve();
  
  // Otherwise fetch it
  try {
    await fetchCountyRentData(fips);
    console.log(`Rent data loaded for ${countyName} (zip: ${zip})`);
    return Promise.resolve();
  } catch (err) {
    console.error(`Failed to load rent data for zip ${zip}:`, err);
    return Promise.reject(err);
  }
}

// Update pagination event listener to recalculate on page change
pagination.addEventListener("click", (e) => {
  if (e.target.tagName === "A" && e.target.dataset.page) {
    e.preventDefault();
    const page = Number(e.target.dataset.page);
    if (page >= 1 && page <= Math.ceil(filteredProperties.length / listingsPerPage)) {
      currentPage = page;
      renderPropertiesPage(filteredProperties, currentPage);
      renderPagination(filteredProperties.length, currentPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Calculations will happen after render via the setTimeout in renderPropertiesPage
    }
  }
});

// Add a debounced scroll handler to load calculations for properties that come into view
// (This is for when user scrolls through a long list)
let scrollTimer;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    calculateVisibleProperties();
  }, 200);
});

// Update form submit to reset calculations
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const locationFilter = locationInput.value.trim().toLowerCase();
  const maxPrice = parseFloat(maxPriceInput.value.replace(/[^0-9.]/g, ""));

  filteredProperties = allProperties.filter((prop) => {
    const location = prop.location || "";
    const city = prop.addressCity || location.split(',')[0] || "";
    const price = prop.price || "";
    const cityMatch = city.toLowerCase().includes(locationFilter) || locationFilter === "";
    const numericPrice = parsePrice(price);
    const priceMatch = isNaN(maxPrice) || isNaN(numericPrice) || numericPrice <= maxPrice;
    return cityMatch && priceMatch;
  });

  currentPage = 1;
  renderPropertiesPage(filteredProperties, currentPage);
  renderPagination(filteredProperties.length, currentPage);
});

// Additional optimization: Cache calculated values
const calculationCache = {
  mortgage: {},
  rent: {}
};

// Optimize estimateMortgage with caching
function estimateMortgage(price) {
  const priceKey = String(price);
  
  // Check cache first
  if (calculationCache.mortgage[priceKey]) {
    return calculationCache.mortgage[priceKey];
  }
  
  const numericPrice = parsePrice(price);
  if (isNaN(numericPrice)) return "N/A";
  
  // 6% interest rate, 30-year fixed, 20% down payment
  const loanAmount = numericPrice * 0.8; // 80% of price (20% down)
  const monthlyRate = 0.06 / 12; // 6% annual rate to monthly
  const numPayments = 30 * 12; // 30 years of monthly payments
  
  // Monthly mortgage payment formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
  // Where L = loan amount, c = monthly interest rate, n = number of payments
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, numPayments);
  const denominator = Math.pow(1 + monthlyRate, numPayments) - 1;
  const payment = loanAmount * (numerator / denominator);
  
  // Add property tax (1.1% annually) and insurance ($100/month)
  const tax = (numericPrice * 0.011) / 12;
  const insurance = 100;
  
  const result = Math.round(payment + tax + insurance);
  
  // Store in cache
  calculationCache.mortgage[priceKey] = result;
  
  return result;
}

// Finally, initialize with optimized loading
window.addEventListener("DOMContentLoaded", async () => {
  // Show loading message 
  grid.appendChild(loadingMessage);
  
  // Load essential data first
  await Promise.all([
    initZipDatabase(),
    initCountyMapping()
  ]);
  
  // Then load properties
  await loadProperties();
  isPropertiesLoaded = true;
  
  // Render the first page
  renderPropertiesPage(allProperties, 1);
  renderPagination(allProperties.length, 1);
  grid.removeChild(loadingMessage);
});
