const https = require('https');
require('dotenv').config();

// Récupérer la clé API depuis le fichier .env
const INTELX_API_KEY = process.env.INTELX_API_KEY;
// Utiliser l'URL de l'API v2
const INTELX_API_URL = 'https://2.intelx.io';

/**
 * Effectue une recherche avec Intelligence X
 * @param {string} query - Terme de recherche
 * @returns {Promise<string>} - Résultats formatés
 */
async function search(query) {
  return new Promise(async (resolve, reject) => {
    // Vérifier si la clé API est configurée
    if (!INTELX_API_KEY) {
      reject('La clé API Intelligence X n\'est pas configurée dans le fichier .env');
      return;
    }
    
    try {
      console.log(`Recherche Intelligence X pour: ${query}`);
      console.log(`Utilisation de la clé API: ${INTELX_API_KEY.substring(0, 5)}...`);
      
      // Étape 1: Démarrer une recherche
      const searchId = await startSearch(query);
      console.log(`ID de recherche obtenu: ${searchId}`);
      
      // Étape 2: Attendre que la recherche soit terminée (max 30 secondes)
      let results = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!results && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Attendre 3 secondes
        results = await getResults(searchId);
        attempts++;
        console.log(`Tentative ${attempts}/${maxAttempts} pour obtenir les résultats...`);
      }
      
      if (!results) {
        reject('Délai d\'attente dépassé pour obtenir les résultats. Veuillez réessayer.');
        return;
      }
      
      // Formater les résultats
      const formattedResults = formatResults(query, results);
      resolve(formattedResults);
      
    } catch (error) {
      console.error('Erreur lors de la recherche Intelligence X:', error);
      reject(`Erreur lors de la recherche: ${error.message || error}`);
    }
  });
}

/**
 * Démarre une recherche Intelligence X
 * @param {string} query - Terme de recherche
 * @returns {Promise<string>} - ID de la recherche
 */
function startSearch(query) {
  return new Promise((resolve, reject) => {
    // Préparer les données de la requête
    const searchData = JSON.stringify({
      term: query,
      maxresults: 10,
      media: 0,
      sort: 2,  // Trier par pertinence
      terminate: [null]
    });
    
    console.log(`Données de recherche: ${searchData}`);
    
    // Options de la requête
    const options = {
      hostname: '2.intelx.io',
      path: '/intelligent/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': INTELX_API_KEY.trim(),  // Assurez-vous qu'il n'y a pas d'espaces
        'User-Agent': 'Discord-Bot'
      }
    };
    
    console.log(`Envoi de la requête à: ${options.hostname}${options.path}`);
    
    // Effectuer la requête
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`Statut de la réponse: ${res.statusCode}`);
      console.log(`En-têtes de la réponse: ${JSON.stringify(res.headers)}`);
      
      // Gérer spécifiquement l'erreur 401
      if (res.statusCode === 401) {
        reject('Erreur d\'authentification: Votre clé API Intelligence X n\'est pas valide ou a expiré. Veuillez contacter l\'administrateur du bot.');
        return;
      }
      
      res.on('data', (chunk) => {
        data += chunk;
        console.log(`Reçu un morceau de données: ${chunk.length} octets`);
      });
      
      res.on('end', () => {
        console.log(`Données complètes reçues: ${data.length} octets`);
        console.log(`Données brutes: ${data.substring(0, 200)}...`);
        
        try {
          // Vérifier si les données sont vides
          if (!data || data.trim() === '') {
            reject('Réponse vide reçue de l\'API Intelligence X');
            return;
          }
          
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.error('Erreur API Intelligence X:', response);
            reject(`Erreur API (${res.statusCode}): ${response.error || 'Erreur inconnue'}`);
            return;
          }
          
          if (!response.id) {
            reject('Aucun ID de recherche retourné par l\'API');
            return;
          }
          
          resolve(response.id);
        } catch (error) {
          console.error('Erreur lors du traitement de la réponse:', error);
          console.error('Données reçues:', data);
          reject(`Erreur lors du traitement de la réponse: ${error.message}`);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Erreur lors de la requête HTTP:', error);
      reject(`Erreur lors de la requête HTTP: ${error.message}`);
    });
    
    req.write(searchData);
    req.end();
  });
}

/**
 * Récupère les résultats d'une recherche
 * @param {string} searchId - ID de la recherche
 * @returns {Promise<Array>} - Résultats de la recherche
 */
function getResults(searchId) {
  return new Promise((resolve, reject) => {
    // Options de la requête
    const options = {
      hostname: '2.intelx.io',
      path: `/intelligent/search/result?id=${searchId}&limit=10`,
      method: 'GET',
      headers: {
        'x-key': INTELX_API_KEY,
        'User-Agent': 'Discord-Bot'
      }
    };
    
    // Effectuer la requête
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.error('Erreur API Intelligence X:', response);
            reject(`Erreur API (${res.statusCode}): ${response.error || 'Erreur inconnue'}`);
            return;
          }
          
          // Vérifier si la recherche est terminée
          if (response.status === 0 || response.status === 1) {
            // Recherche en cours, retourner null
            resolve(null);
            return;
          }
          
          // Recherche terminée
          if (!response.records || response.records.length === 0) {
            // Aucun résultat
            resolve([]);
            return;
          }
          
          resolve(response.records);
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
 * @param {string} query - Terme de recherche
 * @param {Array} results - Résultats de la recherche
 * @returns {string} - Résultats formatés
 */
function formatResults(query, results) {
  let formattedResults = `## Résultats Intelligence X pour: ${query}\n\n`;
  
  if (!results || results.length === 0) {
    return formattedResults + "Aucun résultat trouvé pour cette requête.\n";
  }
  
  formattedResults += "### Sources trouvées:\n\n";
  
  results.forEach((record, index) => {
    // Limiter la taille des résultats pour Discord
    if (index < 10) {
      formattedResults += `**${index + 1}.** `;
      
      // Ajouter le titre ou l'identifiant
      if (record.name) {
        formattedResults += `${record.name}\n`;
      } else if (record.systemid) {
        formattedResults += `ID: ${record.systemid}\n`;
      }
      
      // Ajouter la date si disponible
      if (record.date) {
        const date = new Date(record.date * 1000);
        formattedResults += `📅 ${date.toLocaleDateString()}\n`;
      }
      
      // Ajouter le type de média
      if (record.media) {
        formattedResults += `📁 Type: ${getMediaType(record.media)}\n`;
      }
      
      // Ajouter le lien vers le viewer si disponible
      if (record.systemid) {
        formattedResults += `🔗 [Voir le contenu](https://intelx.io/?did=${record.systemid})\n`;
      }
      
      formattedResults += "\n";
    }
  });
  
  // Ajouter un lien vers Intelligence X pour voir tous les résultats
  formattedResults += `\n[Voir tous les résultats sur Intelligence X](https://intelx.io/?s=${encodeURIComponent(query)})\n`;
  
  return formattedResults;
}

/**
 * Convertit le code de type de média en texte
 * @param {number} mediaType - Code du type de média
 * @returns {string} - Description du type de média
 */
function getMediaType(mediaType) {
  const mediaTypes = {
    0: "Tout",
    1: "Fuite de données",
    2: "Pastes",
    3: "Forums",
    4: "Darknet",
    5: "Documents",
    6: "OSINT",
    7: "Images",
    8: "Vidéos",
    9: "Audio",
    10: "Emails",
    11: "HTML",
    12: "Texte",
    13: "PDF",
    14: "Binaire",
    15: "Archives"
  };
  
  return mediaTypes[mediaType] || "Inconnu";
}

module.exports = {
  search
}; 