const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://pmhjugkkxjoiwmnonbfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaGp1Z2treGpvaXdtbm9uYmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTgwMjMsImV4cCI6MjA2MTA5NDAyM30.Um2dm12vXba4acloklBe41NGg8O9MQTZPO_6IesOFns'; // use the anon/public key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATA_FILE = 'zillow_data.json';

async function importZillowData() {
  try {
    console.log('Reading Zillow data file...');
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    
    const jsonData = JSON.parse(data);
    const listings = Array.isArray(jsonData) ? jsonData : [jsonData];
    
    console.log(`Found ${listings.length} property listings to import`);
    
    const BATCH_SIZE = 10;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(listings.length/BATCH_SIZE)}`);
      
      for (const listing of batch) {
        try {
          const homeInfo = listing.hdpData?.homeInfo || {};
          
          const zpid = listing.zpid || homeInfo.zpid || `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          
          const { error: propError } = await supabase
            .from('properties')
            .upsert({
              zpid: zpid,
              address_street: listing.addressStreet,
              address_city: listing.addressCity,
              address_state: listing.addressState,
              address_zipcode: listing.addressZipcode,
              price: listing.unformattedPrice,
              beds: listing.beds,
              baths: listing.baths,
              area: listing.area || homeInfo.livingArea,
              latitude: listing.latLong?.latitude || homeInfo.latitude,
              longitude: listing.latLong?.longitude || homeInfo.longitude,
              home_type: homeInfo.homeType,
              zestimate: listing.zestimate,
              days_on_zillow: homeInfo.daysOnZillow,
              status: listing.statusType,
              lot_area_value: homeInfo.lotAreaValue,
              lot_area_unit: homeInfo.lotAreaUnit,
              raw_data: listing
            }, { onConflict: 'zpid' });
            
          if (propError) {
            console.error(`Error inserting property ${zpid}:`, propError);
            throw propError;
          }
          
          if (listing.carouselPhotos && listing.carouselPhotos.length > 0) {
            const images = listing.carouselPhotos.map((photo, index) => ({
              property_zpid: zpid,
              url: photo.url,
              position: index
            }));
            
            const { error: imgError } = await supabase
              .from('property_images')
              .upsert(images, { 
                onConflict: ['property_zpid', 'position'],
                ignoreDuplicates: true 
              });
              
            if (imgError) {
              console.error(`Error inserting images for property ${zpid}:`, imgError);
            }
          }
          
          successCount++;
          console.log(`Imported property: ${listing.addressStreet || zpid}`);
          
        } catch (error) {
          console.error(`Error processing listing:`, error);
          errorCount++;
        }
      }
      
      if (i + BATCH_SIZE < listings.length) {
        console.log('Pausing before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n Import complete! `);
    console.log(`Successfully imported ${successCount} listings`);
    if (errorCount > 0) {
      console.log(` ${errorCount} listings had errors during import`);
    }
    
  } catch (error) {
    console.error('Failed to import data:', error);
  }
}

importZillowData();