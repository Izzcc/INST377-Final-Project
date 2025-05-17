export default async function handler(req, res) {
  if (req.method === 'POST') {
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(JSON.parse(data)));
    });
    res.status(200).json({ youSent: body });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
