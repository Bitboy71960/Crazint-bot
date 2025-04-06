const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const https = require('https');
require('dotenv').config();

// Récupérer les clés API depuis le fichier .env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

// Vérifier si GoogleDorker est installé
async function checkInstallation() {
  try {
    await exec('dorker -h');
    return true;
  } catch (error) {
    return false;
  }
}

// Installer GoogleDorker si nécessaire
async function installGoogleDorker() {
  console.log('Installation de GoogleDorker...');
  try {
    await exec('pip install git+https://github.com/RevoltSecurities/GoogleDorker --break-system-packages');
    console.log('GoogleDorker installé avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'installation de GoogleDorker:', error);
    return false;
  }
}

/**
 * Effectue une recherche Google Dork
 * @param {string} query - La requête de recherche
 * @returns {Promise<string>} - Résultats formatés
 */
async function searchDork(query) {
  return new Promise((resolve, reject) => {
    // Vérifier si les clés API sont configurées
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      reject('Les clés API Google (GOOGLE_API_KEY et GOOGLE_CSE_ID) ne sont pas configurées dans le fichier .env');
      return;
    }
    
    console.log(`Recherche Google Dork pour: ${query}`);
    
    // Encoder la requête pour l'URL
    const encodedQuery = encodeURIComponent(query);
    
    // Options de la requête
    const options = {
      hostname: 'www.googleapis.com',
      path: `/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodedQuery}`,
      method: 'GET'
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Vérifier si le code de statut est OK
          if (res.statusCode !== 200) {
            const errorData = JSON.parse(data);
            console.error('Erreur API Google:', errorData);
            reject(`Erreur API (${res.statusCode}): ${errorData.error?.message || 'Erreur inconnue'}`);
            return;
          }
          
          const response = JSON.parse(data);
          
          // Formater les résultats
          const formattedResults = formatResults(query, response);
          resolve(formattedResults);
          
        } catch (error) {
          console.error('Erreur lors du traitement de la réponse:', error);
          reject(`Erreur lors du traitement de la réponse: ${error.message}`);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Erreur lors de la requête HTTP:', error);
      reject(`Erreur lors de la requête HTTP: ${error.message}`);
    });
    
    req.end();
  });
}

/**
 * Formate les résultats pour l'affichage Discord
 * @param {string} query - Requête de recherche
 * @param {Object} response - Réponse de l'API Google
 * @returns {string} - Résultats formatés
 */
function formatResults(query, response) {
  let formattedResults = `## Résultats Google Dork pour: ${query}\n\n`;
  
  if (!response.items || response.items.length === 0) {
    return formattedResults + "Aucun résultat trouvé pour cette requête.\n";
  }
  
  formattedResults += `**Nombre de résultats:** Environ ${response.searchInformation?.totalResults || 'inconnu'}\n\n`;
  
  // Ajouter chaque résultat
  response.items.forEach((item, index) => {
    formattedResults += `### ${index + 1}. [${item.title}](${item.link})\n`;
    
    if (item.snippet) {
      formattedResults += `${item.snippet}\n`;
    }
    
    formattedResults += `🔗 ${item.link}\n\n`;
  });
  
  // Ajouter des informations légales
  formattedResults += "_Les résultats sont fournis par l'API Google Custom Search._\n";
  
  return formattedResults;
}

module.exports = {
  searchDork
}; 