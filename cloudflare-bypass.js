const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let bypassProcess = null;

/**
 * Démarre le processus CloudflareBypassForScraping
 */
function startBypass() {
  if (bypassProcess) {
    console.log('CloudflareBypass est déjà en cours d\'exécution');
    return;
  }

  const bypassPath = path.join(__dirname, 'CloudflareBypassForScraping');
  
  console.log('Démarrage de CloudflareBypassForScraping...');
  
  // Vérifier si le répertoire existe
  if (!fs.existsSync(bypassPath)) {
    console.error(`Le répertoire ${bypassPath} n'existe pas. CloudflareBypass ne peut pas être démarré.`);
    return;
  }
  
  // Vérifier si le fichier server.py existe
  const serverPyPath = path.join(bypassPath, 'server.py');
  if (!fs.existsSync(serverPyPath)) {
    console.error(`Le fichier ${serverPyPath} n'existe pas. CloudflareBypass ne peut pas être démarré.`);
    return;
  }
  
  // Déterminer la commande Python à utiliser
  // Essayer d'abord python3, puis python si python3 n'est pas disponible
  let pythonCmd = 'python3';
  
  try {
    // Tenter d'exécuter python3 -V pour vérifier s'il est disponible
    require('child_process').execSync('python3 -V');
  } catch (error) {
    console.log('python3 n\'est pas disponible, essai avec python...');
    pythonCmd = 'python';
    
    try {
      // Tenter d'exécuter python -V pour vérifier s'il est disponible
      require('child_process').execSync('python -V');
    } catch (error) {
      console.error('Ni python3 ni python ne sont disponibles. CloudflareBypass ne peut pas être démarré.');
      return;
    }
  }
  
  console.log(`Utilisation de la commande Python: ${pythonCmd}`);
  
  // Tenter d'installer DrissionPage s'il est manquant
  try {
    console.log("Vérification de la présence de DrissionPage...");
    require('child_process').execSync(`${pythonCmd} -c "import DrissionPage"`, { stdio: 'pipe' });
    console.log("DrissionPage est déjà installé.");
  } catch (error) {
    console.log("DrissionPage n'est pas installé. Tentative d'installation...");
    try {
      require('child_process').execSync(`${pythonCmd} -m pip install DrissionPage`, { stdio: 'inherit' });
      console.log("DrissionPage a été installé avec succès.");
    } catch (installError) {
      console.error(`Erreur lors de l'installation de DrissionPage: ${installError.message}`);
      console.log("Tentative d'installation des dépendances de base...");
      try {
        require('child_process').execSync(`${pythonCmd} -m pip install -r ${path.join(bypassPath, 'server_requirements.txt')}`, { stdio: 'inherit' });
        console.log("Dépendances de base installées. Nouvelle tentative d'installation de DrissionPage...");
        require('child_process').execSync(`${pythonCmd} -m pip install DrissionPage`, { stdio: 'inherit' });
      } catch (depError) {
        console.error(`Impossible d'installer les dépendances nécessaires: ${depError.message}`);
        return;
      }
    }
  }
  
  // Exécution du script Python pour CloudflareBypassForScraping
  bypassProcess = spawn(pythonCmd, ['server.py'], {
    cwd: bypassPath,
    stdio: 'pipe'
  });
  
  console.log(`Processus CloudflareBypass démarré avec le PID: ${bypassProcess.pid}`);
  
  // Gérer la sortie standard
  bypassProcess.stdout.on('data', (data) => {
    console.log(`CloudflareBypass: ${data.toString().trim()}`);
  });
  
  // Gérer la sortie d'erreur
  bypassProcess.stderr.on('data', (data) => {
    console.error(`CloudflareBypass erreur: ${data.toString().trim()}`);
  });
  
  // Gérer la terminaison du processus
  bypassProcess.on('close', (code) => {
    console.log(`CloudflareBypass s'est terminé avec le code: ${code}`);
    bypassProcess = null;
    
    // Redémarrer le processus s'il s'est terminé avec un code d'erreur
    if (code !== 0) {
      console.log('Tentative de redémarrage de CloudflareBypass dans 5 secondes...');
      setTimeout(() => {
        startBypass();
      }, 5000);
    }
  });
  
  // Gérer les erreurs du processus
  bypassProcess.on('error', (error) => {
    console.error(`Erreur CloudflareBypass: ${error.message}`);
    bypassProcess = null;
  });
  
  // Assurer que le processus ne reste pas zombi
  process.on('exit', () => {
    stopBypass();
  });
}

/**
 * Arrête le processus CloudflareBypassForScraping
 */
function stopBypass() {
  if (bypassProcess) {
    console.log('Arrêt de CloudflareBypass...');
    
    try {
      // Sur les systèmes Windows, on utilise taskkill pour tuer le processus
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /pid ${bypassProcess.pid} /T /F`);
      } else {
        // Sur les systèmes Unix, on peut utiliser le signal SIGTERM
        bypassProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`Erreur lors de l'arrêt de CloudflareBypass: ${error.message}`);
    }
    
    bypassProcess = null;
  }
}

/**
 * Vérifie si CloudflareBypassForScraping est en cours d'exécution
 * @returns {boolean} - True si le processus est en cours d'exécution
 */
function isRunning() {
  return bypassProcess !== null;
}

module.exports = {
  startBypass,
  stopBypass,
  isRunning
}; 