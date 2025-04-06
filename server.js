const http = require('http');
const { exec } = require('child_process');

// Créer un serveur HTTP simple
const server = http.createServer((req, res) => {
  const path = req.url;
  
  console.log(`[${new Date().toISOString()}] Requête reçue: ${path}`);
  
  // Route de ping simple
  if (path === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'Bot is alive', 
      timestamp: new Date().toISOString() 
    }));
    return;
  }
  
  // Route pour vérifier l'état du bot
  if (path === '/status') {
    // Vérifier si le processus du bot est en cours d'exécution
    exec('ps aux | grep node | grep -v grep', (error, stdout, stderr) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      const processInfo = stdout.trim();
      const isRunning = processInfo.length > 0;
      
      res.end(JSON.stringify({ 
        status: isRunning ? 'running' : 'stopped', 
        processes: processInfo.split('\n'),
        timestamp: new Date().toISOString() 
      }));
    });
    return;
  }
  
  // Route par défaut
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Définir le port (utiliser le port fourni par Render ou 3000 par défaut)
const PORT = process.env.PORT || 3000;

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Serveur de ping démarré sur le port ${PORT}`);
});

// Exporter le serveur pour les tests
module.exports = server; 