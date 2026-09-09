const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const SITE_DIR = path.join(__dirname, 'site');
const TEMPLATE_PATH = path.join(SITE_DIR, '_layouts', 'template.html');

function renderPage(filePath, res, next) {
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return next(err);

    // If page has Jekyll front matter, inject into layout template
    if (content.startsWith('---')) {
      const secondDashes = content.indexOf('---', 3);
      if (secondDashes !== -1) {
        const bodyContent = content.slice(secondDashes + 3);
        return fs.readFile(TEMPLATE_PATH, 'utf8', (tErr, template) => {
          if (tErr) {
            console.error('Error reading template:', tErr);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(bodyContent);
          }
          const html = template.replace('{{ content }}', bodyContent);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        });
      }
    }

    // Direct HTML file (like gleech.js.html)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(content);
  });
}

// Middleware to process Jekyll template HTML files
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const reqPath = req.path;
  if (reqPath === '/' || reqPath === '') {
    return renderPage(path.join(SITE_DIR, 'index.html'), res, next);
  }

  let filePath = path.join(SITE_DIR, reqPath);
  if (!fs.existsSync(filePath) && !reqPath.endsWith('.html')) {
    filePath = path.join(SITE_DIR, reqPath + '.html');
  }

  if (fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && filePath.endsWith('.html')) {
        return renderPage(filePath, res, next);
      }
    } catch (e) {
      return next(e);
    }
  }

  next();
});

// Serve all static assets from /site
app.use(express.static(SITE_DIR));

// Also serve sample test image from /test if requested
app.use('/test', express.static(path.join(__dirname, 'test')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Glitchy3bitDither server running at http://0.0.0.0:${PORT}`);
});
