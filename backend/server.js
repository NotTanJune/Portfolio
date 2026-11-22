const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { cacheControlFor, setStaticCacheHeaders } = require('./static-cache');
const { getCanonicalRedirect, isKnownRoute, renderRouteMetadata } = require('./seo');
const { clientIp } = require('./client-ip');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Heroku and Cloudflare forward the original host and protocol through proxy headers.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      // Cloudflare Turnstile loads its script and challenge iframe from challenges.cloudflare.com.
      scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://challenges.cloudflare.com"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: clientIp
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use('/api', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/contact', require('./routes/contact'));
app.use('/api/city', require('./routes/city'));

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const path = require('path');
  const indexPath = path.join(__dirname, '../frontend/build/index.html');
  const indexTemplate = fs.readFileSync(indexPath, 'utf8');

  // Normalize every public URL before static files or the SPA fallback are served.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const redirectLocation = getCanonicalRedirect(req);
    if (!redirectLocation) return next();

    return res.redirect(301, redirectLocation);
  });

  app.use(express.static(path.join(__dirname, '../frontend/build'), {
    etag: true,
    lastModified: true,
    setHeaders: setStaticCacheHeaders,
  }));
  
  app.get('*', (req, res) => {
    // Unknown paths still get the app shell (it renders "Page not found"), but with a real 404 status.
    if (!isKnownRoute(req.path)) res.status(404);
    res.setHeader('Cache-Control', cacheControlFor('/'));
    res.type('html').send(renderRouteMetadata(indexTemplate, req.path));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Portfolio API is running!' });
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
