const fs = require('fs');
fetch('http://localhost:3000/api/recognize-handwriting', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }) // 1x1 transparent pixel just to test
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
