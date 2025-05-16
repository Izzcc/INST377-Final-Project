const supabaseClient = require('@supabase/supabase-js');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const express = require('express');
const { isValidStateAbbreviation } = require('usa-state-validator');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
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
