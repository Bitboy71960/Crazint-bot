const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Vérifie et installe les dépendances manquantes de Maigret
 * @param {string} pythonCmd - Commande Python à utiliser
 */
function checkMaigretDependencies(pythonCmd) {
  console.log("Vérification des dépendances de Maigret...");
  
  // Liste des dépendances critiques de Maigret
  const requiredDependencies = [
    'aiodns',
    'aiohttp',
    'alive_progress',
    'bs4',
    'certifi',
    'colorama',
    'lxml',
    'pycountry',
    'pysocks',
    'python_socks',
    'requests',
    'socid_extractor',
    'torrequest',
    'socksio',
    'httpx',
    'fastapi',
    'uvicorn',
    'aiosocks',
    'xhtml2pdf',
    'xmind',
    'networkx',
    'cloudscraper',
    'pyvis',
    'stem',
    'mock'
  ];
  
  let missingDependencies = [];
  
  for (const dep of requiredDependencies) {
    try {
      execSync(`${pythonCmd} -c "import ${dep}"`, { stdio: 'pipe' });
      console.log(`✓ ${dep} est déjà installé.`);
    } catch (error) {
      console.log(`✗ ${dep} n'est pas installé.`);
      missingDependencies.push(dep);
    }
  }
  
  // Si des dépendances sont manquantes, tenter une installation complète
  if (missingDependencies.length > 0) {
    console.log(`${missingDependencies.length} dépendances manquantes. Installation en cours...`);
    
    // Tenter d'installer toutes les dépendances manquantes en une seule commande
    try {
      execSync(`${pythonCmd} -m pip install ${missingDependencies.join(' ')}`, { stdio: 'inherit' });
      console.log("Installation des dépendances manquantes terminée.");
    } catch (error) {
      console.error(`Erreur lors de l'installation des dépendances: ${error.message}`);
      
      // Si l'installation individuelle échoue, tenter d'installer Maigret directement
      console.log("Tentative d'installation complète de Maigret...");
      try {
        // Se déplacer dans le répertoire maigret
        const maigretPath = path.join(__dirname, 'maigret');
        execSync(`cd ${maigretPath} && ${pythonCmd} -m pip install -e .`, { stdio: 'inherit' });
        console.log("Installation complète de Maigret terminée.");
      } catch (maigretError) {
        console.error(`Erreur lors de l'installation complète de Maigret: ${maigretError.message}`);
        
        // Dernière tentative: installation directe depuis GitHub
        console.log("Dernière tentative: installation directe de Maigret depuis GitHub...");
        try {
          execSync(`${pythonCmd} -m pip install git+https://github.com/soxoj/maigret.git@cloudflare-bypass`, { stdio: 'inherit' });
          console.log("Installation directe de Maigret depuis GitHub terminée.");
        } catch (githubError) {
          console.error(`Erreur lors de l'installation directe de Maigret depuis GitHub: ${githubError.message}`);
        }
      }
    }
  } else {
    console.log("Toutes les dépendances sont installées.");
  }
  
  console.log("Vérification des dépendances terminée.");
}

// Fonction pour créer un script Python qui patch les imports problématiques
function createPatchScript(pythonCmd, maigretPath) {
  console.log("Création d'un script pour patcher les imports problématiques...");
  
  const patchScriptPath = path.join(maigretPath, 'patch_imports.py');
  const patchScriptContent = `
# Script pour patcher les imports problématiques dans Maigret
import os
import sys
import re

def patch_file(filepath, patterns):
    """Patch a file by adding try/except blocks around problematic imports."""
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    patched_content = content
    for pattern, replacement in patterns:
        patched_content = re.sub(pattern, replacement, patched_content)
    
    if patched_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(patched_content)
        print(f"Patched: {filepath}")
        return True
    return False

# Liste des fichiers à patcher et les patterns à remplacer
files_to_patch = [
    {
        'path': os.path.join('maigret', 'report.py'),
        'patterns': [
            (
                r'import xmind',
                'try:\\n    import xmind\\nexcept ImportError:\\n    xmind = None\\n    print("xmind module not available, some features will be disabled")'
            ),
        ]
    },
    {
        'path': os.path.join('maigret', 'report.py'),
        'patterns': [
            (
                r'import networkx',
                'try:\\n    import networkx\\nexcept ImportError:\\n    networkx = None\\n    print("networkx module not available, some features will be disabled")'
            ),
        ]
    },
    {
        'path': os.path.join('maigret', 'report.py'),
        'patterns': [
            (
                r'import pyvis',
                'try:\\n    import pyvis\\nexcept ImportError:\\n    pyvis = None\\n    print("pyvis module not available, some features will be disabled")'
            ),
        ]
    },
    {
        'path': os.path.join('maigret', 'checking.py'),
        'patterns': [
            (
                r'from socid_extractor import extract',
                'try:\\n    from socid_extractor import extract\\nexcept ImportError:\\n    def extract(*args, **kwargs): return {}\\n    print("socid_extractor module not available, some features will be disabled")'
            ),
        ]
    },
    {
        'path': os.path.join('maigret', 'checking.py'),
        'patterns': [
            (
                r'import python_socks',
                'try:\\n    import python_socks\\nexcept ImportError:\\n    python_socks = None\\n    print("python_socks module not available, some features will be disabled")'
            ),
        ]
    }
]

# Patcher tous les fichiers listés
for file_info in files_to_patch:
    patch_file(file_info['path'], file_info['patterns'])

print("Patching completed!")
  `;
  
  fs.writeFileSync(patchScriptPath, patchScriptContent);
  
  try {
    console.log("Exécution du script de patch...");
    execSync(`${pythonCmd} ${patchScriptPath}`, { 
      cwd: maigretPath,
      stdio: 'inherit' 
    });
    console.log("Script de patch exécuté avec succès.");
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'exécution du script de patch: ${error.message}`);
    return false;
  }
}

/**
 * Exécute Maigret pour rechercher un nom d'utilisateur
 * @param {string} username - Nom d'utilisateur à rechercher
 * @returns {Promise<string>} - Résultat de la recherche
 */
async function searchUsername(username) {
  return new Promise((resolve, reject) => {
    const maigretPath = path.join(__dirname, 'maigret');
    
    // Vérifier si le répertoire maigret existe
    if (!fs.existsSync(maigretPath)) {
      reject(`Le répertoire ${maigretPath} n'existe pas. Maigret n'est pas installé correctement.`);
      return;
    }
    
    // Essayer d'utiliser l'exécutable Python dans l'environnement virtuel, ou sinon Python système
    let pythonCmd = 'python3';
    
    // Tenter d'utiliser l'environnement virtuel s'il existe
    const venvPath = path.join(maigretPath, 'venv');
    const pythonExe = process.platform === 'win32' 
      ? path.join(venvPath, 'Scripts', 'python.exe')
      : path.join(venvPath, 'bin', 'python');
    
    if (fs.existsSync(venvPath) && fs.existsSync(pythonExe)) {
      pythonCmd = pythonExe;
      console.log(`Utilisation de l'environnement virtuel Python: ${pythonExe}`);
    } else {
      console.log(`L'environnement virtuel n'existe pas, tentative d'utilisation de Python système`);
      // Tenter d'utiliser python3, puis python si nécessaire
      try {
        execSync('python3 --version', { stdio: 'pipe' });
      } catch (error) {
        console.log('python3 non disponible, utilisation de python');
        pythonCmd = 'python';
      }
    }
    
    // Installation directe de socid_extractor et des autres dépendances manquantes
    try {
      console.log("Installation directe de socid_extractor...");
      execSync(`${pythonCmd} -m pip install socid_extractor`, { stdio: 'inherit' });
      
      console.log("Installation directe de xmind...");
      execSync(`${pythonCmd} -m pip install xmind`, { stdio: 'inherit' });
      
      // Vérifier si le fichier requirements.txt existe dans le répertoire courant
      const requirementsPath = path.join(__dirname, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        console.log("Installation des dépendances depuis requirements.txt...");
        execSync(`${pythonCmd} -m pip install -r ${requirementsPath} --ignore-installed`, { stdio: 'inherit' });
      } else {
        console.log("Fichier requirements.txt non trouvé dans le répertoire courant.");
      }
    } catch (error) {
      console.error(`Erreur lors de l'installation des dépendances: ${error.message}`);
      
      // Si l'installation échoue, essayer de patcher les fichiers pour rendre les imports optionnels
      createPatchScript(pythonCmd, maigretPath);
    }
    
    // Vérifier et installer les dépendances manquantes
    checkMaigretDependencies(pythonCmd);
    
    console.log(`Recherche de l'utilisateur: ${username}`);
    console.log(`Utilisation de l'exécutable Python: ${pythonCmd}`);
    
    // Définir les variables d'environnement pour forcer l'encodage UTF-8
    const env = Object.assign({}, process.env, {
      PYTHONIOENCODING: 'utf-8',
      PYTHONLEGACYWINDOWSSTDIO: 'utf-8',
      PYTHONUTF8: '1'
    });
    
    // Exécution de Maigret avec l'interpréteur Python
    // Utiliser un ensemble minimal d'arguments pour éviter les erreurs
    const args = [
      '-m', 'maigret',
      username,
      '--folderoutput', './reports',
      '--retries', '1',
      '--timeout', '5',
      '--no-color'
    ];
    
    console.log(`Commande exécutée: ${pythonCmd} ${args.join(' ')}`);
    
    const maigretProcess = spawn(pythonCmd, args, {
      cwd: maigretPath,
      stdio: 'pipe',
      env: env
    });
    
    let output = '';
    let errorOutput = '';
    let foundSites = [];
    
    maigretProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log(`Maigret: ${chunk}`);
      
      // Extraire les sites trouvés (lignes commençant par [+])
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('[+]')) {
          foundSites.push(line.trim());
        }
      }
    });
    
    maigretProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.error(`Maigret erreur: ${chunk}`);
    });
    
    maigretProcess.on('error', (error) => {
      console.error(`Erreur lors du démarrage de Maigret: ${error.message}`);
      console.error(error.stack);
      reject(`Erreur lors du démarrage de Maigret: ${error.message}`);
    });
    
    maigretProcess.on('close', (code) => {
      console.log(`Maigret s'est terminé avec le code ${code}`);
      
      if (code !== 0) {
        reject(`Erreur lors de l'exécution de Maigret: ${errorOutput}`);
        return;
      }
      
      // Extraire le rapport court du texte complet
      let shortReport = '';
      const shortReportMatch = output.match(/\[\*\] Short text report:([\s\S]*?)(?=\[\*\]|$)/);
      if (shortReportMatch && shortReportMatch[1]) {
        shortReport = shortReportMatch[1].trim();
      }
      
      // Préparer le résultat final
      let result = '';
      
      // Ajouter les sites trouvés
      if (foundSites.length > 0) {
        result += "## Sites où le profil a été trouvé :\n\n";
        result += foundSites.join('\n');
        result += '\n\n';
      } else {
        result += "Aucun profil n'a été trouvé pour cet utilisateur.\n\n";
      }
      
      // Ajouter le rapport court s'il existe
      if (shortReport) {
        result += "## Résumé :\n\n";
        result += shortReport;
        result += '\n\n';
      }
      
      // Génération d'un rapport HTML si disponible
      const reportPath = path.join(maigretPath, `reports/${username}.html`);
      if (fs.existsSync(reportPath)) {
        result += `Rapport HTML généré: ${reportPath}`;
      }
      
      resolve(result);
    });
  });
}

module.exports = {
  searchUsername
}; 