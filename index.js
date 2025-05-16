const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => {
    res.sendFile('/public/house-search.html', { root: __dirname });
});

app.get('/api/properties', async (req, res) => {
  const { data, error } = await supabase
    .from('properties')
    .select('*');

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }

  res.json(data);
});

module.exports = app;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
