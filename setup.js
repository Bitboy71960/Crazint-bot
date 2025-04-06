const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Début de l\'installation...');
console.log('Répertoire courant:', process.cwd());
console.log('Contenu du répertoire:', fs.readdirSync('.'));

// Fonction pour exécuter une commande avec gestion d'erreur
function runCommand(command, options = {}) {
  try {
    console.log(`Exécution de: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'exécution de: ${command}`);
    console.error(error.message);
    return false;
  }
}

// Vérifier si nous sommes sur Render
const isRender = process.env.RENDER === 'true';
console.log(`Environnement Render: ${isRender ? 'Oui' : 'Non'}`);

// Création des dossiers nécessaires
if (!fs.existsSync('maigret')) {
  fs.mkdirSync('maigret', { recursive: true });
}

if (!fs.existsSync('CloudflareBypassForScraping')) {
  fs.mkdirSync('CloudflareBypassForScraping', { recursive: true });
}

// Déterminer la commande Python à utiliser
let pythonCmd = 'python3';
try {
  execSync('python3 --version', { stdio: 'pipe' });
} catch (error) {
  console.log('python3 non disponible, essai avec python...');
  pythonCmd = 'python';
  try {
    execSync('python --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('Ni python3 ni python ne sont disponibles!');
    process.exit(1);
  }
}

console.log(`Utilisation de la commande Python: ${pythonCmd}`);

// Vérifier si le module venv est disponible
let venvAvailable = true;
try {
  execSync(`${pythonCmd} -c "import venv"`, { stdio: 'pipe' });
  console.log('Module venv disponible.');
} catch (error) {
  console.log('Module venv non disponible. La création d\'environnement virtuel sera ignorée.');
  venvAvailable = false;
}

// Téléchargement de Maigret
console.log('Téléchargement de Maigret...');
if (runCommand('git clone https://github.com/soxoj/maigret maigret')) {
  process.chdir('maigret');
  
  runCommand('git checkout cloudflare-bypass');
  
  // Installation directe des dépendances critiques de Maigret
  console.log('Installation des dépendances critiques de Maigret...');
  runCommand(`${pythonCmd} -m pip install aiodns aiohttp alive_progress bs4 certifi colorama lxml pycountry pysocks python_socks socksio httpx fastapi uvicorn aiosocks socid_extractor requests torrequest xhtml2pdf xmind`);
  
  // Installation explicite de xmind
  console.log('Installation explicite de xmind...');
  runCommand(`${pythonCmd} -m pip install xmind`);
  
  // Installation directe de Maigret depuis GitHub
  console.log('Installation directe de Maigret depuis GitHub...');
  runCommand(`${pythonCmd} -m pip install git+https://github.com/soxoj/maigret.git@cloudflare-bypass`);
  
  // Installation directe depuis les requirements.txt si disponible
  console.log('Tentative d\'installation depuis requirements.txt...');
  if (fs.existsSync(path.join(process.cwd(), 'requirements.txt'))) {
    runCommand(`${pythonCmd} -m pip install -r requirements.txt`);
  }
  
  // Installation de Maigret en mode développement si pyproject.toml existe
  if (fs.existsSync('pyproject.toml')) {
    console.log('Installation de Maigret en mode développement...');
    runCommand(`${pythonCmd} -m pip install -e .`);
  }
  
  // Création de l'environnement virtuel Python
  console.log('Configuration de l\'environnement Python...');
  
  // Essayer de créer l'environnement virtuel seulement si venv est disponible
  let venvCreated = venvAvailable ? runCommand(`${pythonCmd} -m venv venv`) : false;
  
  if (venvCreated) {
    console.log("Environnement virtuel créé avec succès");
    
    // Utiliser les chemins directs vers pip dans l'environnement virtuel
    const pipPath = process.platform === 'win32' ? '.\\venv\\Scripts\\pip' : './venv/bin/pip';
    const pythonPath = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';
    
    // Installer les dépendances
    runCommand(`${pipPath} install --upgrade pip`);
    runCommand(`${pipPath} install poetry`);
    runCommand(`${pythonPath} -m poetry install --with dev`);
  } else {
    console.log("Utilisation de Python système pour l'installation des dépendances.");
    
    // Installer les dépendances avec Python système
    runCommand(`${pythonCmd} -m pip install poetry`);
    runCommand(`${pythonCmd} -m poetry install --with dev`);
  }
  
  process.chdir('..');
}

// Téléchargement de CloudflareBypassForScraping
console.log('Téléchargement de CloudflareBypassForScraping...');
if (runCommand('git clone https://github.com/sarperavci/CloudflareBypassForScraping.git CloudflareBypassForScraping')) {
  process.chdir('CloudflareBypassForScraping');
  
  // Installer les dépendances directement avec pip système
  runCommand(`${pythonCmd} -m pip install -r server_requirements.txt`);
  
  // Installer aussi DrissionPage qui est manquant
  console.log("Installation de DrissionPage (dépendance critique pour CloudflareBypass)...");
  runCommand(`${pythonCmd} -m pip install DrissionPage`);
  
  process.chdir('..');
}

// Installation de GoogleDorker
console.log('Installation de GoogleDorker...');
runCommand(`${pythonCmd} -m pip install git+https://github.com/RevoltSecurities/GoogleDorker`);

// Vérification finale
console.log('Vérification des installations:');
console.log('Contenu du répertoire courant:', fs.readdirSync('.'));
if (fs.existsSync('maigret')) {
  console.log('Contenu du répertoire maigret:', fs.readdirSync('maigret'));
}
if (fs.existsSync('CloudflareBypassForScraping')) {
  console.log('Contenu du répertoire CloudflareBypassForScraping:', fs.readdirSync('CloudflareBypassForScraping'));
}

console.log('Installation terminée!');
console.log('Pour démarrer le bot, exécutez: npm start'); 