import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pmhjugkkxjoiwmnonbfg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaGp1Z2treGpvaXdtbm9uYmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTgwMjMsImV4cCI6MjA2MTA5NDAyM30.Um2dm12vXba4acloklBe41NGg8O9MQTZPO_6IesOFns'
const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchData() {
  const { data, error } = await supabase
    .from('properties')
    .select('*') 
  
  if (error) {
    console.error('Error fetching data:', error)
    return
  }

  console.log('Data retrieved:', data)
  console.log('Number 0:', data[0].raw_data)
}

fetchData()

const grid = document.getElementById("propertyGrid");
const pagination = document.getElementById("paginationControls");
const form = document.getElementById("filterForm");
const locationInput = document.getElementById("locationFilter");
const maxPriceInput = document.getElementById("maxPriceFilter");
const HUD_API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI2IiwianRpIjoiODdkNjJjODNjYmNmMTRkZWEzMTZhNzE5OGQ3MmY1YzE0ZWViMjQyMTJlZWI3ZTcwYjhmZTFjMjlkMzA1YWJhMDQ5MGM1M2Q0ODlhOWU3NDMiLCJpYXQiOjE3NDU1OTc3ODYuNDI5MzczLCJuYmYiOjE3NDU1OTc3ODYuNDI5Mzc1LCJleHAiOjIwNjExMzA1ODYuNDIxNzk3LCJzdWIiOiI5NjUxOSIsInNjb3BlcyI6W119.ZfUECoLQ80NaT_NOxAZ5fWdkFjNCIgWpUwC-P0U_CJVwua4QNNltL3o2ZxrtWrmsGtnHM6lznN2X4eWQ_wOoAQ";

let allProperties = [];
let filteredProperties = [];
let currentPage = 1;
const listingsPerPage = 33;

// Store ZIP to county mapping
let zipToCounty = [];
// Store all rent data by county and zip
let allRentData = {};
// Store FIPS code by county name for easier lookups
let countyToFips = {};

// --- Initial Data Loading ---

// Load county data first to build county-to-FIPS mapping
async function loadCountyFipsMapping() {
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
    console.log("Counties loaded:", counties.length);
    
    // Build county-to-FIPS mapping
    counties.forEach(county => {
      countyToFips[county.county_name] = county.fips_code;
    });
    
    console.log("County-to-FIPS mapping created:", Object.keys(countyToFips).length);
    return counties;
  } catch (err) {
    console.error("Failed to load county FIPS mapping:", err);
    return [];
  }
}

// Load ZIP to county mapping
async function loadZipCodeDatabase() {
  try {
    const res = await fetch('zip_code_database.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    zipToCounty = await res.json();
    console.log("ZIP database loaded with", zipToCounty.length, "entries");
  } catch (err) {
    console.error("Failed to load ZIP database:", err);
  }
}

// Fetch rent data for all counties
async function loadAllCountyRentData(counties) {
  try {
    const rentPromises = counties.map(county => fetchCountyRentData(county.fips_code));
    await Promise.all(rentPromises);
    
    console.log("All rent data loaded for", Object.keys(allRentData).length, "counties/zips");
  } catch (err) {
    console.error("Failed to load county data:", err);
  }
}

// Fetch rent data for a specific county
async function fetchCountyRentData(fips) {
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
    
    // Store county-level data
    if (!Array.isArray(rentData)) {
      allRentData[fips] = {
        countyData: rentData
      };
    } else {
      // Store ZIP-specific data
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

// --- Helper Functions ---

function getCountyByZip(zip) {
  zip = String(zip).padStart(5, '0');
  const entry = zipToCounty.find(row => String(row.zip).padStart(5, '0') === zip);
  return entry ? entry.county : "N/A";
}

function getFipsByCountyName(countyName) {
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
  // First get the county name from the zip
  const countyName = getCountyByZip(zip);
  if (countyName === "N/A") return null;
  
  // Then get the FIPS code for that county
  const fips = getFipsByCountyName(countyName);
  
  if (fips && allRentData[fips]) {
    // Check if this county has zip-specific data
    if (allRentData[fips].zipData && allRentData[fips].zipData[zip]) {
      return fips;
    }
    if (allRentData[fips].countyData) {
      return fips;
    }
  }
  
  return null;
}

function estimateRent(zip, bedrooms) {
  if (!zip) return "N/A";
  
  const fips = getCountyFipsByZip(zip);
  if (!fips) return "N/A";
  
  if (allRentData[fips]?.zipData?.[zip]) {
    const zipRentData = allRentData[fips].zipData[zip];
    
    switch (Number(bedrooms)) {
      case 0: return zipRentData.Efficiency || "N/A";
      case 1: return zipRentData["One-Bedroom"] || "N/A";
      case 2: return zipRentData["Two-Bedroom"] || "N/A";
      case 3: return zipRentData["Three-Bedroom"] || "N/A";
      case 4: case 5: case 6: return zipRentData["Four-Bedroom"] || "N/A";
      default: return zipRentData["Two-Bedroom"] || "N/A"; // Default to 2BR if unknown
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
  
  //  fallback values
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
  if (rent === "N/A" || mortgage === "N/A") return "N/A";
  
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

// --- Rendering Functions ---

function renderPropertiesPage(properties, page) {
  grid.innerHTML = "";
  const start = (page - 1) * listingsPerPage;
  const end = start + listingsPerPage;
  const pageListings = properties.slice(start, end);

  if (pageListings.length === 0) {
    grid.innerHTML = `<p class="text-center w-100 text-danger">No listings found.</p>`;
    return;
  }

  pageListings.forEach((prop) => {

    const status = prop.statusText;
    if (status.toLowerCase() == "auction") return; 

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

    grid.innerHTML += `
      <div class="card m-2 shadow" style="width: 20rem;">
        <img src="${img}" class="card-img-top" alt="Property image">
        <div class="card-body">
          <h5 class="card-title">${city}, ${state} ${zip ? `(${zip})` : ''}</h5>
          <p class="card-text">
            <strong>County:</strong> ${county}<br>
            <strong>Price:</strong> ${price}<br>
            <strong>Bedrooms:</strong> ${beds} &nbsp; 
            <strong>Bathrooms:</strong> ${baths}<br>
            <strong>Estimated Rent:</strong> $${rentAmount !== "N/A" ? rentAmount : "N/A"}<br>
            <strong>Estimated Mortgage:</strong> $${mortgagePayment !== "N/A" ? mortgagePayment.toLocaleString() : "N/A"}<br>
            <strong>Cashflow:</strong> ${cashflow}<br>
            <a href="${listingUrl}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">View Listing</a>
          </p>
        </div>
      </div>
    `;
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

// --- Event Listeners ---

window.addEventListener("DOMContentLoaded", async () => {
  try {
    grid.innerHTML = `<p class="text-center w-100">Loading properties and rent data...</p>`;
    
    await loadZipCodeDatabase();
    
    const counties = await loadCountyFipsMapping();
    
    await loadAllCountyRentData(counties);
    
    const propertyRes = await fetch("zillow_data.json");
    if (!propertyRes.ok) throw new Error(`HTTP error ${propertyRes.status}`);
    
    const propertyData = await propertyRes.json();
    allProperties = propertyData;
    
    filteredProperties = allProperties;
    renderPropertiesPage(filteredProperties, 1);
    renderPagination(filteredProperties.length, 1);
  } catch (err) {
    console.error("Failed to initialize app:", err);
    grid.innerHTML = `<p class="text-center w-100 text-danger">Failed to load listings. Try again later.</p>`;
  }
});

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