const express = require('express');
const router = express.Router();
const { getDefaultCityService } = require('../city');

router.get('/', async (req, res) => {
  const city = await getDefaultCityService().getCity();
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.json(city);
});

module.exports = router;
