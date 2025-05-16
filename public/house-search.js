import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pmhjugkkxjoiwmnonbfg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaGp1Z2treGpvaXdtbm9uYmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTgwMjMsImV4cCI6MjA2MTA5NDAyM30.Um2dm12vXba4acloklBe41NGg8O9MQTZPO_6IesOFns'
const supabase = createClient(supabaseUrl, supabaseKey)

// DOM Elements
const grid = document.getElementById("propertyGrid");
const pagination = document.getElementById("paginationControls");
const form = document.getElementById("filterForm");
const locationInput = document.getElementById("locationFilter");
const maxPriceInput = document.getElementById("maxPriceFilter");
const loadingMessage = document.createElement("div");
loadingMessage.className = "loading-message";
loadingMessage.innerHTML = `
  <div class="text-center w-100 my-5">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <p class="mt-2">Loading properties...</p>
  </div>
`;

// Configuration
const HUD_API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI2IiwianRpIjoiODdkNjJjODNjYmNmMTRkZWEzMTZhNzE5OGQ3MmY1YzE0ZWViMjQyMTJlZWI3ZTcwYjhmZTFjMjlkMzA1YWJhMDQ5MGM1M2Q0ODlhOWU3NDMiLCJpYXQiOjE3NDU1OTc3ODYuNDI5MzczLCJuYmYiOjE3NDU1OTc3ODYuNDI5Mzc1LCJleHAiOjIwNjExMzA1ODYuNDIxNzk3LCJzdWIiOiI5NjUxOSIsInNjb3BlcyI6W119.ZfUECoLQ80NaT_NOxAZ5fWdkFjNCIgWpUwC-P0U_CJVwua4QNNltL3o2ZxrtWrmsGtnHM6lznN2X4eWQ_wOoAQ";
const listingsPerPage = 12; 

// State
let allProperties = [];
let filteredProperties = [];
let currentPage = 1;
let zipToCounty = {};
let allRentData = {};
let countyToFips = {};
let isZipDatabaseLoaded = false;
let isCountyMappingLoaded = false;
let isPropertiesLoaded = false;

// --- INITIALIZATION & DATA LOADING  ---

// Initialize the application with basics first
window.addEventListener("DOMContentLoaded", async () => {
  // Show loading message 
  grid.appendChild(loadingMessage);
  
  loadProperties().then(() => {
    isPropertiesLoaded = true;
    renderPropertiesPage(allProperties, 1);
    renderPagination(allProperties.length, 1);
    grid.removeChild(loadingMessage);
  });
  
  initZipDatabase();
  initCountyMapping();
});

async function loadProperties() {
  try {
    console.log("Trying to load from Supabase...");
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .range(0, 11); 
    
    if (data && data.length > 0 && !error) {
      console.log('Data retrieved from Supabase:', data.length);
      allProperties = data;
      filteredProperties = data;
      return;
    }
    
    // Fallback to local JSON if Supabase fails
    console.log("Falling back to local JSON...");
    const propertyRes = await fetch("zillow_data.json");
    if (!propertyRes.ok) throw new Error(`HTTP error ${propertyRes.status}`);
    
    const propertyData = await propertyRes.json();
    console.log('Data loaded from local JSON:', propertyData.length);
    allProperties = propertyData;
    filteredProperties = propertyData;
  } catch (err) {
    console.error("Failed to load properties:", err);
    grid.innerHTML = `
      <div class="alert alert-danger w-100 text-center" role="alert">
        Failed to load listings. <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }
}

// Load ZIP database in the background
async function initZipDatabase() {
  try {
    const res = await fetch('zip_code_database.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    
    // Convert array to lookup object for faster access
    data.forEach(entry => {
      const zip = String(entry.zip).padStart(5, '0');
      zipToCounty[zip] = entry.county;
    });
    
    isZipDatabaseLoaded = true;
    console.log("ZIP database loaded:", Object.keys(zipToCounty).length);
    
    if (isPropertiesLoaded) {
      updateRenderedProperties();
    }
  } catch (err) {
    console.error("Failed to load ZIP database:", err);
  }
}

// Load county mapping in the background
async function initCountyMapping() {
  try {
    const url = `https://www.huduser.gov/hudapi/public/fmr/listCounties/MD`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${HUD_API_TOKEN}`,
        "Accept": "application/json"
      }
    });
    
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    const counties = await res.json();
    
    // Build county-to-FIPS mapping
    counties.forEach(county => {
      countyToFips[county.county_name] = county.fips_code;
    });
    
    isCountyMappingLoaded = true;
    console.log("County mapping loaded:", Object.keys(countyToFips).length);
    
    loadPopularCountiesRentData(counties.slice(0, 5)); 
  } catch (err) {
    console.error("Failed to load county mapping:", err);
  }
}

async function loadPopularCountiesRentData(counties) {
  try {
    const rentPromises = counties.map(county => fetchCountyRentData(county.fips_code));
    await Promise.all(rentPromises);
    console.log("Initial rent data loaded for top counties");
    
    // If properties are already rendered, update them with rent data
    if (isPropertiesLoaded) {
      updateRenderedProperties();
    }
  } catch (err) {
    console.error("Failed to load initial county rent data:", err);
  }
}

// Load rent data for a specific zip code on demand
async function loadRentDataForZip(zip) {
  if (!zip || !isZipDatabaseLoaded || !isCountyMappingLoaded) return;
  
  const countyName = getCountyByZip(zip);
  if (countyName === "N/A") return;
  
  const fips = getFipsByCountyName(countyName);
  if (!fips || allRentData[fips]) return;
  
  try {
    await fetchCountyRentData(fips);
    console.log(`Rent data loaded for ${countyName} (zip: ${zip})`);
    
    updateRenderedProperties();
  } catch (err) {
    console.error(`Failed to load rent data for zip ${zip}:`, err);
  }
}

// Fetch rent data for a specific county
async function fetchCountyRentData(fips) {
  if (!fips || allRentData[fips]) return;
  
  try {
    const url = `https://www.huduser.gov/hudapi/public/fmr/data/${fips}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${HUD_API_TOKEN}`,
        "Accept": "application/json"
      }
    });
    
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    const result = await res.json();
    const rentData = result.data.basicdata;
    
    if (!Array.isArray(rentData)) {
      allRentData[fips] = {
        countyData: rentData
      };
    } else {
      allRentData[fips] = {
        countyData: rentData.find(item => item.zip_code === "MSA level") || null,
        zipData: {}
      };
      
      rentData.forEach(zipInfo => {
        if (zipInfo.zip_code && zipInfo.zip_code !== "MSA level") {
          allRentData[fips].zipData[zipInfo.zip_code] = zipInfo;
        }
      });
    }
  } catch (err) {
    console.error(`Failed to load rent data for county ${fips}:`, err);
  }
}

// --- HELPER FUNCTIONS ---

function getCountyByZip(zip) {
  if (!isZipDatabaseLoaded) return "Loading...";
  
  zip = String(zip).padStart(5, '0');
  return zipToCounty[zip] || "N/A";
}

function getFipsByCountyName(countyName) {
  if (!isCountyMappingLoaded) return null;
  
  // Remove "County" suffix if present
  const cleanName = countyName.replace(/ County$/i, '').trim();
  
  // Try direct match
  for (const name in countyToFips) {
    if (name.toLowerCase().includes(cleanName.toLowerCase())) {
      return countyToFips[name];
    }
  }
  
  return null;
}

function getCountyFipsByZip(zip) {
  if (!isZipDatabaseLoaded || !isCountyMappingLoaded) return null;
  
  // First get the county name from the zip
  const countyName = getCountyByZip(zip);
  if (countyName === "N/A" || countyName === "Loading...") return null;
  
  // Then get the FIPS code for that county
  return getFipsByCountyName(countyName);
}

function estimateRent(zip, bedrooms) {
  if (!zip || !isZipDatabaseLoaded || !isCountyMappingLoaded) {
    if (zip) loadRentDataForZip(zip);
    return "Loading...";
  }
  
  const fips = getCountyFipsByZip(zip);
  if (!fips) {
    loadRentDataForZip(zip); 
    return "Calculating...";
  }
  
  if (!allRentData[fips]) {
    loadRentDataForZip(zip); 
    return "Calculating...";
  }
  
  if (allRentData[fips]?.zipData?.[zip]) {
    const zipRentData = allRentData[fips].zipData[zip];
    
    switch (Number(bedrooms)) {
      case 0: return zipRentData.Efficiency || "N/A";
      case 1: return zipRentData["One-Bedroom"] || "N/A";
      case 2: return zipRentData["Two-Bedroom"] || "N/A";
      case 3: return zipRentData["Three-Bedroom"] || "N/A";
      case 4: case 5: case 6: return zipRentData["Four-Bedroom"] || "N/A";
      default: return zipRentData["Two-Bedroom"] || "N/A";
    }
  } 
  
  if (allRentData[fips]?.countyData) {
    const countyRentData = allRentData[fips].countyData;
    
    switch (Number(bedrooms)) {
      case 0: return countyRentData.Efficiency || "N/A";
      case 1: return countyRentData["One-Bedroom"] || "N/A";
      case 2: return countyRentData["Two-Bedroom"] || "N/A";
      case 3: return countyRentData["Three-Bedroom"] || "N/A";
      case 4: case 5: case 6: return countyRentData["Four-Bedroom"] || "N/A";
      default: return countyRentData["Two-Bedroom"] || "N/A";
    }
  }
  
  // Fallback values
  const basePrices = {
    0: 1100, 
    1: 1300, 
    2: 1600,
    3: 2000,
    4: 2400,
    5: 2800  
  };
  
  const bedroomCount = Number(bedrooms) || 2; 
  return basePrices[Math.min(bedroomCount, 5)] || basePrices[2];
}

function estimateMortgage(price) {
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
  
  return Math.round(payment + tax + insurance);
}

function calculateCashflow(rent, mortgage) {
  if (rent === "N/A" || mortgage === "N/A" || 
      rent === "Loading..." || mortgage === "Loading..." ||
      rent === "Calculating..." || mortgage === "Calculating...") {
    return "Calculating...";
  }
  
  const rentValue = typeof rent === 'string' ? parseInt(rent.replace(/[^0-9]/g, '')) : rent;
  const mortgageValue = typeof mortgage === 'string' ? parseInt(mortgage.replace(/[^0-9]/g, '')) : mortgage;
  
  if (isNaN(rentValue) || isNaN(mortgageValue)) return "N/A";
  
  const cashflow = rentValue - mortgageValue;
  const cashflowClass = cashflow >= 0 ? 'cashflow-positive' : 'cashflow-negative';
  
  return `<span class="${cashflowClass}">$${cashflow.toLocaleString()}</span>`;
}

function parsePrice(priceStr) {
  if (!priceStr) return NaN;
  let str = String(priceStr).replace(/[\$,]/g, '').trim().toUpperCase();
  if (str.endsWith('K')) return parseFloat(str.replace('K', '')) * 1000;
  if (str.endsWith('M')) return parseFloat(str.replace('M', '')) * 1000000;
  return parseFloat(str);
}

// --- RENDERING FUNCTIONS ---

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

  pageListings.forEach((prop) => {
    const status = prop.statusText;
    if (status && status.toLowerCase() === "auction") return; 

    const img = prop.image || prop.imgSrc || "https://via.placeholder.com/350x200";
    const price = prop.price || "N/A";
    const city = prop.location?.split(',')[0] || prop.addressCity || "N/A";
    const state = prop.location?.split(',')[1]?.trim() || prop.addressState || "MD";
    const zip = prop.zip || prop.hdpData?.homeInfo?.zipcode || prop.addressZipcode || "";
    const county = getCountyByZip(zip);
    const beds = prop.bedrooms || prop.beds || "N/A";
    const baths = prop.bathrooms || prop.baths || "N/A";
    const listingUrl = prop.listing_url || (prop.detailUrl ? `${prop.detailUrl}` : "#");
    
    // Calculate financial metrics 
    const rentAmount = estimateRent(zip, beds);
    const mortgagePayment = estimateMortgage(price);
    const cashflow = calculateCashflow(rentAmount, mortgagePayment);
    
    const propId = `prop-${zip}-${beds}-${parsePrice(price)}`.replace(/[^a-zA-Z0-9-]/g, '');

    grid.innerHTML += `
      <div class="card m-2 shadow prop-card" id="${propId}" style="width: 20rem;">
        <img src="${img}" class="card-img-top" alt="Property image" loading="lazy">
        <div class="card-body">
          <h5 class="card-title">${city}, ${state} ${zip ? `(${zip})` : ''}</h5>
          <p class="card-text">
            <strong>County:</strong> <span class="county-data">${county}</span><br>
            <strong>Price:</strong> ${price}<br>
            <strong>Bedrooms:</strong> ${beds} &nbsp; 
            <strong>Bathrooms:</strong> ${baths}<br>
            <strong>Estimated Rent:</strong> <span class="rent-data">$${rentAmount !== "N/A" ? rentAmount : "N/A"}</span><br>
            <strong>Estimated Mortgage:</strong> <span class="mortgage-data">$${mortgagePayment !== "N/A" ? mortgagePayment.toLocaleString() : "N/A"}</span><br>
            <strong>Cashflow:</strong> <span class="cashflow-data">${cashflow}</span><br>
            <a href="${listingUrl}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">View Listing</a>
          </p>
        </div>
      </div>
    `;
  });
}

// Function to update property cards with new data once it loads
function updateRenderedProperties() {
  document.querySelectorAll('.prop-card').forEach(card => {
    // Extract ZIP and bedrooms from the card
    const titleText = card.querySelector('.card-title').textContent;
    const zipMatch = titleText.match(/\((\d{5})\)/);
    const zip = zipMatch ? zipMatch[1] : null;
    
    const bedroomsText = card.querySelector('.card-text').textContent;
    const bedroomsMatch = bedroomsText.match(/Bedrooms:\s*(\d+)/);
    const bedrooms = bedroomsMatch ? bedroomsMatch[1] : 2;
    
    const priceText = card.querySelector('.card-text').textContent;
    const priceMatch = priceText.match(/Price:\s*([^\n]+)/);
    const price = priceMatch ? priceMatch[1].trim() : "N/A";
    
    if (zip) {
      // Update county
      const countyElement = card.querySelector('.county-data');
      if (countyElement && countyElement.textContent === "Loading...") {
        countyElement.textContent = getCountyByZip(zip);
      }
      
      // Update rent
      const rentElement = card.querySelector('.rent-data');
      if (rentElement && (rentElement.textContent === "$Loading..." || rentElement.textContent === "$Calculating...")) {
        const rentAmount = estimateRent(zip, bedrooms);
        rentElement.textContent = `$${rentAmount !== "N/A" && rentAmount !== "Loading..." && rentAmount !== "Calculating..." ? rentAmount : rentAmount}`;
      }
      
      // Update mortgage 
      const mortgageElement = card.querySelector('.mortgage-data');
      if (mortgageElement) {
        const mortgagePayment = estimateMortgage(price);
        mortgageElement.textContent = `$${mortgagePayment !== "N/A" ? mortgagePayment.toLocaleString() : mortgagePayment}`;
      }
      
      // Update cashflow
      const cashflowElement = card.querySelector('.cashflow-data');
      if (cashflowElement && (cashflowElement.textContent.includes("Loading...") || cashflowElement.textContent.includes("Calculating..."))) {
        const rentElement = card.querySelector('.rent-data');
        const mortgageElement = card.querySelector('.mortgage-data');
        const rentAmount = rentElement.textContent.replace('$', '');
        const mortgagePayment = mortgageElement.textContent.replace('$', '');
        const cashflow = calculateCashflow(rentAmount, mortgagePayment);
        cashflowElement.innerHTML = cashflow;
      }
    }
  });
}

function renderPagination(totalListings, currentPage) {
  pagination.innerHTML = "";
  const totalPages = Math.ceil(totalListings / listingsPerPage);
  if (totalPages <= 1) return;

  // Previous button
  pagination.innerHTML += `
    <li class="page-item${currentPage === 1 ? " disabled" : ""}">
      <a class="page-link" href="#" aria-label="Previous" data-page="${currentPage - 1}">&laquo;</a>
    </li>
  `;

  // Page numbers 
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  if (currentPage <= 3) endPage = Math.min(5, totalPages);
  if (currentPage > totalPages - 2) startPage = Math.max(1, totalPages - 4);

  for (let i = startPage; i <= endPage; i++) {
    pagination.innerHTML += `
      <li class="page-item${i === currentPage ? " active" : ""}">
        <a class="page-link" href="#" data-page="${i}"${i === currentPage ? ' aria-current="page"' : ''}>${i}</a>
      </li>
    `;
  }

  // Next button
  pagination.innerHTML += `
    <li class="page-item${currentPage === totalPages ? " disabled" : ""}">
      <a class="page-link" href="#" aria-label="Next" data-page="${currentPage + 1}">&raquo;</a>
    </li>
  `;
}

// --- EVENT LISTENERS ---

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

pagination.addEventListener("click", (e) => {
  if (e.target.tagName === "A" && e.target.dataset.page) {
    e.preventDefault();
    const page = Number(e.target.dataset.page);
    if (page >= 1 && page <= Math.ceil(filteredProperties.length / listingsPerPage)) {
      currentPage = page;
      renderPropertiesPage(filteredProperties, currentPage);
      renderPagination(filteredProperties.length, currentPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
});