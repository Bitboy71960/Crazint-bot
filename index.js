require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const maigret = require('./maigret');
const cloudflareBypass = require('./cloudflare-bypass');
const gdorker = require('./gdorker');
const intelx = require('./intelx');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Création du client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Ajouter des constantes pour le système de surveillance
const HEARTBEAT_INTERVAL = 30000; // 30 secondes
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000; // 5 secondes

// Variables pour suivre l'état du bot
let reconnectAttempts = 0;
let heartbeatInterval = null;
let lastHeartbeatAck = Date.now();
let connected = false;

// Préfixe pour les commandes
const PREFIX = '!';

// ID du rôle admin et du canal autorisé (depuis .env)
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BOT_CHANNEL_ID = process.env.BOT_CHANNEL_ID;

// Map pour stocker les cooldowns des utilisateurs
const cooldowns = new Map();
const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes en millisecondes

// Fonction pour vérifier si un utilisateur est administrateur
function isAdmin(message) {
  // Vérifier si l'utilisateur est le propriétaire du serveur
  if (message.guild && message.guild.ownerId === message.author.id) {
    return true;
  }
  
  // Vérifier si l'utilisateur a le rôle admin spécifié
  if (ADMIN_ROLE_ID && message.member && message.member.roles.cache.has(ADMIN_ROLE_ID)) {
    return true;
  }
  
  // Vérifier si l'utilisateur a les permissions d'administrateur
  if (message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }
  
  return false;
}

// Fonction pour vérifier si le message est dans le canal autorisé
function isInAllowedChannel(message) {
  // Si aucun canal spécifique n'est configuré, autoriser tous les canaux
  if (!BOT_CHANNEL_ID) {
    return true;
  }
  
  // Les administrateurs peuvent utiliser le bot dans n'importe quel canal
  if (isAdmin(message)) {
    return true;
  }
  
  // Vérifier si le message est dans le canal autorisé
  return message.channel.id === BOT_CHANNEL_ID;
}

// Fonction pour vérifier si un utilisateur est en cooldown
function isOnCooldown(userId) {
  if (!cooldowns.has(userId)) {
    return false;
  }
  
  const cooldownEnd = cooldowns.get(userId);
  return Date.now() < cooldownEnd;
}

// Fonction pour obtenir le temps restant du cooldown en format lisible
function getRemainingCooldown(userId) {
  if (!cooldowns.has(userId)) {
    return '0 minute';
  }
  
  const cooldownEnd = cooldowns.get(userId);
  const remainingMs = cooldownEnd - Date.now();
  
  if (remainingMs <= 0) {
    cooldowns.delete(userId);
    return '0 minute';
  }
  
  const minutes = Math.ceil(remainingMs / 60000);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

// Fonction pour mettre un utilisateur en cooldown
function setCooldown(userId) {
  const cooldownEnd = Date.now() + COOLDOWN_DURATION;
  cooldowns.set(userId, cooldownEnd);
  
  // Supprimer automatiquement le cooldown après la durée
  setTimeout(() => {
    if (cooldowns.has(userId) && cooldowns.get(userId) <= Date.now()) {
      cooldowns.delete(userId);
    }
  }, COOLDOWN_DURATION);
}

// Démarrage du bypass Cloudflare au lancement
client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  
  // Réinitialiser les tentatives de reconnexion lors de la connexion réussie
  reconnectAttempts = 0;
  connected = true;
  lastHeartbeatAck = Date.now();
  
  // Démarrer le heartbeat pour surveiller la connexion
  startHeartbeat();
  
  // Vérifier si le répertoire CloudflareBypassForScraping existe
  const bypassPath = path.join(__dirname, 'CloudflareBypassForScraping');
  if (!fs.existsSync(bypassPath)) {
    console.warn(`Le répertoire ${bypassPath} n'existe pas. CloudflareBypass ne sera pas démarré.`);
    console.warn('Le bot fonctionnera sans CloudflareBypass, certaines fonctionnalités pourraient être limitées.');
  } else {
    try {
      cloudflareBypass.startBypass();
    } catch (error) {
      console.error('Erreur lors du démarrage de CloudflareBypass:', error);
      console.log('Le bot continuera à fonctionner sans CloudflareBypass');
    }
  }
});

// Fonction pour démarrer le heartbeat
function startHeartbeat() {
  // Nettoyer l'intervalle précédent s'il existe
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Démarrer un nouvel intervalle de heartbeat
  heartbeatInterval = setInterval(() => {
    // Vérifier si le bot est toujours connecté
    if (!client.ws.ping) {
      console.warn('Heartbeat manqué - le bot semble déconnecté');
      
      // Si le dernier heartbeat est trop ancien (3 fois l'intervalle)
      if (Date.now() - lastHeartbeatAck > HEARTBEAT_INTERVAL * 3) {
        console.error('Connexion perdue - tentative de reconnexion...');
        handleReconnect();
      }
    } else {
      // Mettre à jour le timestamp du dernier heartbeat réussi
      lastHeartbeatAck = Date.now();
      console.log(`Heartbeat - Ping: ${client.ws.ping}ms - Bot en ligne`);
    }
  }, HEARTBEAT_INTERVAL);
  
  console.log('Système de heartbeat démarré');
}

// Fonction pour gérer la reconnexion
function handleReconnect() {
  if (!connected) return; // Éviter les tentatives de reconnexion simultanées
  
  connected = false;
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Échec après ${reconnectAttempts} tentatives de reconnexion. Redémarrage complet du bot...`);
    process.exit(1); // En mode production, un gestionnaire de processus comme PM2 redémarrera le bot
    return;
  }
  
  reconnectAttempts++;
  
  console.log(`Tentative de reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
  
  // Nettoyer les ressources existantes
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  // Attendre un peu avant de tenter la reconnexion
  setTimeout(() => {
    try {
      // Réessayer de se connecter
      client.destroy();
      client.login(process.env.DISCORD_TOKEN)
        .then(() => {
          console.log('Reconnexion réussie!');
          connected = true;
        })
        .catch(error => {
          console.error('Échec de la reconnexion:', error);
          handleReconnect(); // Réessayer
        });
    } catch (error) {
      console.error('Erreur lors de la tentative de reconnexion:', error);
      handleReconnect(); // Réessayer
    }
  }, RECONNECT_INTERVAL * reconnectAttempts); // Backoff exponentiel
}

// Gestion de la réception du signal ready (après reconnexion également)
client.on('ready', () => {
  console.log(`Bot prêt: ${client.user.tag}`);
  reconnectAttempts = 0;
  connected = true;
  lastHeartbeatAck = Date.now();
  
  // Démarrer le heartbeat
  if (!heartbeatInterval) {
    startHeartbeat();
  }
});

// Gestion des messages
client.on('messageCreate', async (message) => {
  // Ignorer les messages du bot et ceux qui ne commencent pas par le préfixe
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  // Vérifier si le message est dans le canal autorisé
  if (!isInAllowedChannel(message)) {
    // Si un canal spécifique est configuré, informer l'utilisateur (en MP pour ne pas encombrer les autres canaux)
    if (BOT_CHANNEL_ID) {
      try {
        const botChannel = await client.channels.fetch(BOT_CHANNEL_ID);
        await message.author.send(`Veuillez utiliser les commandes du bot uniquement dans le canal ${botChannel.name}.`);
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message privé:', error);
      }
    }
    return;
  }
  
  // Extraction de la commande et des arguments
  const [command, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  
  // Commande pour rechercher un utilisateur avec Maigret
  if (command === 'maigret') {
    const userId = message.author.id;
    const userIsAdmin = isAdmin(message);
    
    // Vérifier si l'utilisateur est en cooldown (sauf pour les admins)
    if (!userIsAdmin && isOnCooldown(userId)) {
      const remaining = getRemainingCooldown(userId);
      message.reply(`Vous devez attendre encore ${remaining} avant de pouvoir utiliser cette commande à nouveau.`);
      return;
    }
    
    const username = args[0];
    
    if (!username) {
      message.reply('Veuillez spécifier un nom d\'utilisateur. Exemple: `!maigret soxoj`');
      return;
    }
    
    // Vérifier si Maigret est installé
    const maigretPath = path.join(__dirname, 'maigret');
    if (!fs.existsSync(maigretPath)) {
      message.reply('Maigret n\'est pas installé correctement. Cette fonctionnalité est temporairement indisponible.');
      return;
    }
    
    // Mettre l'utilisateur en cooldown (sauf pour les admins)
    if (!userIsAdmin) {
      setCooldown(userId);
    }
    
    // Message de chargement
    const loadingMessage = await message.reply(`Recherche en cours pour l'utilisateur: ${username}. Cela peut prendre quelques minutes...`);
    
    try {
      // Exécution de la recherche Maigret
      const result = await maigret.searchUsername(username);
      
      // Découpage du résultat en morceaux plus petits (1000 caractères max par champ)
      const chunks = [];
      let tempResult = result;
      
      while (tempResult.length > 0) {
        const chunk = tempResult.substring(0, 1000);
        chunks.push(chunk);
        tempResult = tempResult.substring(1000);
      }
      
      // Limiter le nombre total de chunks pour éviter les problèmes de taille
      if (chunks.length > 25) {
        const remainingChunks = chunks.length - 25;
        chunks.splice(25, remainingChunks, `... et ${remainingChunks} autres parties (résultat trop long)`);
      }
      
      // Diviser les chunks en plusieurs embeds (maximum 6 champs par embed)
      const embeds = [];
      let currentEmbed = new EmbedBuilder()
        .setTitle(`Résultats pour ${username}`)
        .setDescription('Recherche terminée avec Maigret')
        .setColor('#0099ff')
        .setTimestamp();
      
      let currentEmbedSize = 0;
      let fieldsInCurrentEmbed = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        // Vérifier si le chunk est trop long pour un champ Discord
        if (chunks[i].length > 1024) {
          // Diviser davantage le chunk si nécessaire
          const subChunks = [];
          let tempChunk = chunks[i];
          
          while (tempChunk.length > 0) {
            const subChunk = tempChunk.substring(0, 1000);
            subChunks.push(subChunk);
            tempChunk = tempChunk.substring(1000);
          }
          
          // Ajouter les sous-chunks comme champs séparés
          for (let j = 0; j < subChunks.length; j++) {
            const fieldName = i === 0 && j === 0 ? 'Résultats' : `Suite (${i+1}.${j+1}/${chunks.length})`;
            const fieldValue = subChunks[j];
            
            // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
            const fieldSize = fieldName.length + fieldValue.length;
            
            if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
              // Ajouter l'embed actuel à la liste et en créer un nouveau
              embeds.push(currentEmbed);
              
              currentEmbed = new EmbedBuilder()
                .setTitle(`Résultats pour ${username} (suite)`)
                .setColor('#0099ff')
                .setTimestamp();
              
              currentEmbedSize = 0;
              fieldsInCurrentEmbed = 0;
            }
            
            // Ajouter le champ à l'embed actuel
            currentEmbed.addFields({ name: fieldName, value: fieldValue });
            currentEmbedSize += fieldSize;
            fieldsInCurrentEmbed++;
          }
        } else {
          // Ajouter le chunk directement s'il respecte la limite
          const fieldName = i === 0 ? 'Résultats' : `Suite (${i+1}/${chunks.length})`;
          const fieldValue = chunks[i];
          
          // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
          const fieldSize = fieldName.length + fieldValue.length;
          
          if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
            // Ajouter l'embed actuel à la liste et en créer un nouveau
            embeds.push(currentEmbed);
            
            currentEmbed = new EmbedBuilder()
              .setTitle(`Résultats pour ${username} (suite)`)
              .setColor('#0099ff')
              .setTimestamp();
            
            currentEmbedSize = 0;
            fieldsInCurrentEmbed = 0;
          }
          
          // Ajouter le champ à l'embed actuel
          currentEmbed.addFields({ name: fieldName, value: fieldValue });
          currentEmbedSize += fieldSize;
          fieldsInCurrentEmbed++;
        }
      }
      
      // Ajouter le dernier embed à la liste
      embeds.push(currentEmbed);
      
      // Envoyer le premier embed
      await loadingMessage.edit({ content: '', embeds: [embeds[0]] });
      
      // Envoyer les embeds supplémentaires en tant que nouveaux messages
      for (let i = 1; i < embeds.length; i++) {
        await message.channel.send({ embeds: [embeds[i]] });
      }
      
    } catch (error) {
      console.error('Erreur:', error);
      
      // Tronquer le message d'erreur s'il est trop long
      let errorMessage = error.message || String(error);
      if (errorMessage.length > 1900) {
        errorMessage = errorMessage.substring(0, 1900) + '... (message tronqué)';
      }
      
      await loadingMessage.edit(`Une erreur est survenue: ${errorMessage}`);
    }
  }
  
  // Commande pour rechercher avec Google Dork
  else if (command === 'gdork') {
    const userId = message.author.id;
    const userIsAdmin = isAdmin(message);
    
    // Vérifier si l'utilisateur est en cooldown (sauf pour les admins)
    if (!userIsAdmin && isOnCooldown(userId)) {
      const remaining = getRemainingCooldown(userId);
      message.reply(`Vous devez attendre encore ${remaining} avant de pouvoir utiliser cette commande à nouveau.`);
      return;
    }
    
    const query = args.join(' ');
    
    if (!query) {
      message.reply('Veuillez spécifier une requête Google Dork. Exemple: `!gdork site:example.com inurl:admin`');
      return;
    }
    
    // Mettre l'utilisateur en cooldown (sauf pour les admins)
    if (!userIsAdmin) {
      setCooldown(userId);
    }
    
    // Message de chargement
    const loadingMessage = await message.reply(`Recherche Google Dork en cours pour: ${query}. Cela peut prendre quelques minutes...`);
    
    try {
      // Exécution de la recherche Google Dork
      const result = await gdorker.searchDork(query);
      
      // Découpage du résultat en morceaux plus petits (1000 caractères max par champ)
      const chunks = [];
      let tempResult = result;
      
      while (tempResult.length > 0) {
        const chunk = tempResult.substring(0, 1000);
        chunks.push(chunk);
        tempResult = tempResult.substring(1000);
      }
      
      // Limiter le nombre total de chunks pour éviter les problèmes de taille
      if (chunks.length > 25) {
        const remainingChunks = chunks.length - 25;
        chunks.splice(25, remainingChunks, `... et ${remainingChunks} autres parties (résultat trop long)`);
      }
      
      // Diviser les chunks en plusieurs embeds (maximum 6 champs par embed)
      const embeds = [];
      let currentEmbed = new EmbedBuilder()
        .setTitle(`Résultats Google Dork pour: ${query}`)
        .setDescription('Recherche terminée avec GoogleDorker')
        .setColor('#4285F4')  // Couleur Google
        .setTimestamp();
      
      let currentEmbedSize = 0;
      let fieldsInCurrentEmbed = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        // Vérifier si le chunk est trop long pour un champ Discord
        if (chunks[i].length > 1024) {
          // Diviser davantage le chunk si nécessaire
          const subChunks = [];
          let tempChunk = chunks[i];
          
          while (tempChunk.length > 0) {
            const subChunk = tempChunk.substring(0, 1000);
            subChunks.push(subChunk);
            tempChunk = tempChunk.substring(1000);
          }
          
          // Ajouter les sous-chunks comme champs séparés
          for (let j = 0; j < subChunks.length; j++) {
            const fieldName = i === 0 && j === 0 ? 'Résultats' : `Suite (${i+1}.${j+1}/${chunks.length})`;
            const fieldValue = subChunks[j];
            
            // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
            const fieldSize = fieldName.length + fieldValue.length;
            
            if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
              // Ajouter l'embed actuel à la liste et en créer un nouveau
              embeds.push(currentEmbed);
              
              currentEmbed = new EmbedBuilder()
                .setTitle(`Résultats Google Dork pour: ${query} (suite)`)
                .setColor('#4285F4')
                .setTimestamp();
              
              currentEmbedSize = 0;
              fieldsInCurrentEmbed = 0;
            }
            
            // Ajouter le champ à l'embed actuel
            currentEmbed.addFields({ name: fieldName, value: fieldValue });
            currentEmbedSize += fieldSize;
            fieldsInCurrentEmbed++;
          }
        } else {
          // Ajouter le chunk directement s'il respecte la limite
          const fieldName = i === 0 ? 'Résultats' : `Suite (${i+1}/${chunks.length})`;
          const fieldValue = chunks[i];
          
          // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
          const fieldSize = fieldName.length + fieldValue.length;
          
          if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
            // Ajouter l'embed actuel à la liste et en créer un nouveau
            embeds.push(currentEmbed);
            
            currentEmbed = new EmbedBuilder()
              .setTitle(`Résultats Google Dork pour: ${query} (suite)`)
              .setColor('#4285F4')
              .setTimestamp();
            
            currentEmbedSize = 0;
            fieldsInCurrentEmbed = 0;
          }
          
          // Ajouter le champ à l'embed actuel
          currentEmbed.addFields({ name: fieldName, value: fieldValue });
          currentEmbedSize += fieldSize;
          fieldsInCurrentEmbed++;
        }
      }
      
      // Ajouter le dernier embed à la liste
      embeds.push(currentEmbed);
      
      // Envoyer le premier embed
      await loadingMessage.edit({ content: '', embeds: [embeds[0]] });
      
      // Envoyer les embeds supplémentaires en tant que nouveaux messages
      for (let i = 1; i < embeds.length; i++) {
        await message.channel.send({ embeds: [embeds[i]] });
      }
      
    } catch (error) {
      console.error('Erreur:', error);
      
      // Tronquer le message d'erreur s'il est trop long
      let errorMessage = error.message || String(error);
      if (errorMessage.length > 1900) {
        errorMessage = errorMessage.substring(0, 1900) + '... (message tronqué)';
      }
      
      await loadingMessage.edit(`Une erreur est survenue: ${errorMessage}`);
    }
  }
  
  // Commande pour rechercher avec Intelligence X
  else if (command === 'intelx') {
    const userId = message.author.id;
    const userIsAdmin = isAdmin(message);
    
    // Vérifier si l'utilisateur est en cooldown (sauf pour les admins)
    if (!userIsAdmin && isOnCooldown(userId)) {
      const remaining = getRemainingCooldown(userId);
      message.reply(`Vous devez attendre encore ${remaining} avant de pouvoir utiliser cette commande à nouveau.`);
      return;
    }
    
    const query = args.join(' ');
    
    if (!query) {
      message.reply('Veuillez spécifier un terme de recherche. Exemple: `!intelx example.com`');
      return;
    }
    
    // Mettre l'utilisateur en cooldown (sauf pour les admins)
    if (!userIsAdmin) {
      setCooldown(userId);
    }
    
    // Message de chargement
    const loadingMessage = await message.reply(`Recherche Intelligence X en cours pour: ${query}. Cela peut prendre quelques instants...`);
    
    try {
      // Exécution de la recherche Intelligence X
      const result = await intelx.search(query);
      
      // Découpage du résultat en morceaux plus petits (1000 caractères max par champ)
      const chunks = [];
      let tempResult = result;
      
      while (tempResult.length > 0) {
        const chunk = tempResult.substring(0, 1000);
        chunks.push(chunk);
        tempResult = tempResult.substring(1000);
      }
      
      // Limiter le nombre total de chunks pour éviter les problèmes de taille
      if (chunks.length > 25) {
        const remainingChunks = chunks.length - 25;
        chunks.splice(25, remainingChunks, `... et ${remainingChunks} autres parties (résultat trop long)`);
      }
      
      // Diviser les chunks en plusieurs embeds (maximum 6 champs par embed)
      const embeds = [];
      let currentEmbed = new EmbedBuilder()
        .setTitle(`Résultats Intelligence X pour: ${query}`)
        .setDescription('Recherche terminée avec Intelligence X')
        .setColor('#0066CC')  // Couleur Intelligence X
        .setTimestamp();
      
      let currentEmbedSize = 0;
      let fieldsInCurrentEmbed = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        // Vérifier si le chunk est trop long pour un champ Discord
        if (chunks[i].length > 1024) {
          // Diviser davantage le chunk si nécessaire
          const subChunks = [];
          let tempChunk = chunks[i];
          
          while (tempChunk.length > 0) {
            const subChunk = tempChunk.substring(0, 1000);
            subChunks.push(subChunk);
            tempChunk = tempChunk.substring(1000);
          }
          
          // Ajouter les sous-chunks comme champs séparés
          for (let j = 0; j < subChunks.length; j++) {
            const fieldName = i === 0 && j === 0 ? 'Résultats' : `Suite (${i+1}.${j+1}/${chunks.length})`;
            const fieldValue = subChunks[j];
            
            // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
            const fieldSize = fieldName.length + fieldValue.length;
            
            if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
              // Ajouter l'embed actuel à la liste et en créer un nouveau
              embeds.push(currentEmbed);
              
              currentEmbed = new EmbedBuilder()
                .setTitle(`Résultats Intelligence X pour: ${query} (suite)`)
                .setColor('#0066CC')
                .setTimestamp();
              
              currentEmbedSize = 0;
              fieldsInCurrentEmbed = 0;
            }
            
            // Ajouter le champ à l'embed actuel
            currentEmbed.addFields({ name: fieldName, value: fieldValue });
            currentEmbedSize += fieldSize;
            fieldsInCurrentEmbed++;
          }
        } else {
          // Ajouter le chunk directement s'il respecte la limite
          const fieldName = i === 0 ? 'Résultats' : `Suite (${i+1}/${chunks.length})`;
          const fieldValue = chunks[i];
          
          // Vérifier si l'ajout de ce champ dépasserait la limite de l'embed
          const fieldSize = fieldName.length + fieldValue.length;
          
          if (fieldsInCurrentEmbed >= 6 || currentEmbedSize + fieldSize > 5500) {
            // Ajouter l'embed actuel à la liste et en créer un nouveau
            embeds.push(currentEmbed);
            
            currentEmbed = new EmbedBuilder()
              .setTitle(`Résultats Intelligence X pour: ${query} (suite)`)
              .setColor('#0066CC')
              .setTimestamp();
            
            currentEmbedSize = 0;
            fieldsInCurrentEmbed = 0;
          }
          
          // Ajouter le champ à l'embed actuel
          currentEmbed.addFields({ name: fieldName, value: fieldValue });
          currentEmbedSize += fieldSize;
          fieldsInCurrentEmbed++;
        }
      }
      
      // Ajouter le dernier embed à la liste
      embeds.push(currentEmbed);
      
      // Envoyer le premier embed
      await loadingMessage.edit({ content: '', embeds: [embeds[0]] });
      
      // Envoyer les embeds supplémentaires en tant que nouveaux messages
      for (let i = 1; i < embeds.length; i++) {
        await message.channel.send({ embeds: [embeds[i]] });
      }
      
    } catch (error) {
      console.error('Erreur:', error);
      
      // Tronquer le message d'erreur s'il est trop long
      let errorMessage = error.message || String(error);
      if (errorMessage.length > 1900) {
        errorMessage = errorMessage.substring(0, 1900) + '... (message tronqué)';
      }
      
      await loadingMessage.edit(`Une erreur est survenue: ${errorMessage}`);
    }
  }
  
  // Commande d'aide
  else if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('Aide du Bot')
      .setDescription('Liste des commandes disponibles')
      .setColor('#0099ff')
      .addFields(
        { name: '!maigret [username]', value: 'Recherche un utilisateur avec Maigret (cooldown de 30 minutes, sauf pour les administrateurs)' },
        { name: '!gdork [query]', value: 'Effectue une recherche Google Dork avec les clés API configurées (cooldown de 30 minutes, sauf pour les administrateurs)' },
        { name: '!intelx [query]', value: 'Effectue une recherche avec Intelligence X (cooldown de 30 minutes, sauf pour les administrateurs)' },
        { name: '!cooldown', value: 'Vérifier votre statut de cooldown' },
        { name: '!help', value: 'Affiche ce message d\'aide' }
      )
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  }
  
  // Commande pour vérifier le cooldown
  else if (command === 'cooldown') {
    const userId = message.author.id;
    const userIsAdmin = isAdmin(message);
    
    if (userIsAdmin) {
      message.reply('En tant qu\'administrateur, vous n\'êtes pas soumis au cooldown.');
    } else if (isOnCooldown(userId)) {
      const remaining = getRemainingCooldown(userId);
      message.reply(`Vous devez attendre encore ${remaining} avant de pouvoir utiliser la commande !maigret.`);
    } else {
      message.reply('Vous pouvez utiliser la commande !maigret dès maintenant.');
    }
  }
});

// Gestion des erreurs
client.on('error', (error) => {
  console.error('Erreur du client Discord:', error);
  
  // Tenter de reconnecter le bot si l'erreur semble être liée à la connexion
  if (error.message && (
    error.message.includes('network') || 
    error.message.includes('connection') || 
    error.message.includes('connect') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('timeout')
  )) {
    console.log('Erreur de connexion détectée - tentative de reconnexion...');
    handleReconnect();
  }
});

// Gestion des déconnexions
client.on('disconnect', (event) => {
  console.error('Déconnexion du bot:', event);
  connected = false;
  
  // Tenter de reconnecter automatiquement
  handleReconnect();
});

// Gestion des reconnexions
client.on('reconnecting', () => {
  console.log('Tentative de reconnexion en cours...');
  connected = false;
});

// Gestion de la reprise de connexion
client.on('resume', (replayed) => {
  console.log(`Connexion reprise après déconnexion (${replayed} événements rejoués)`);
  connected = true;
  lastHeartbeatAck = Date.now();
  reconnectAttempts = 0;
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
  
  // Éviter de terminer le processus pour les erreurs non fatales
  if (error.message && (
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('read ECONNRESET')
  )) {
    console.log('Erreur de connexion non fatale - tentative de récupération...');
    // Ne pas terminer le processus
  } else {
    console.error('Erreur fatale - redémarrage du bot...');
    setTimeout(() => {
      process.exit(1); // Redémarrer le bot (avec PM2 ou un gestionnaire similaire)
    }, 5000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
  // Continuer l'exécution du bot
});

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Erreur lors de la connexion initiale:', error);
  handleReconnect();
});

// Créer un serveur HTTP simple pour les pings
const server = http.createServer((req, res) => {
  const path = req.url;
  
  console.log(`[${new Date().toISOString()}] Requête reçue: ${path}`);
  
  // Route de ping simple
  if (path === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'Bot is alive', 
      timestamp: new Date().toISOString(),
      botStatus: client.user ? 'connected' : 'disconnected',
      uptime: client.uptime ? `${Math.floor(client.uptime / 60000)} minutes` : 'N/A',
      ping: client.ws.ping ? `${client.ws.ping}ms` : 'N/A',
      lastHeartbeat: new Date(lastHeartbeatAck).toISOString()
    }));
    return;
  }
  
  // Route de heartbeat pour les moniteurs externes
  if (path === '/health') {
    const isHealthy = client.user && client.ws.ping && connected;
    
    res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: isHealthy ? 'healthy' : 'unhealthy', 
      timestamp: new Date().toISOString(),
      reconnectAttempts: reconnectAttempts,
      ping: client.ws.ping || 'N/A',
      uptime: client.uptime ? `${Math.floor(client.uptime / 60000)} minutes` : 'N/A',
    }));
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

// Fonction pour redémarrer le bot en cas de problème persistant
function restartBot() {
  console.log('Redémarrage complet du bot...');
  
  // Nettoyer les ressources
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  try {
    client.destroy();
    server.close();
  } catch (error) {
    console.error('Erreur lors du nettoyage avant redémarrage:', error);
  }
  
  // Redémarrer le processus après un délai
  setTimeout(() => {
    process.exit(1); // Code d'erreur pour indiquer un redémarrage nécessaire
  }, 1000);
}

// Ajouter un mécanisme de surveillance pour redémarrer si le bot est inactif trop longtemps
setInterval(() => {
  // Si le bot est déconnecté depuis plus de 5 minutes (300000 ms)
  if (!connected && Date.now() - lastHeartbeatAck > 300000) {
    console.error('Bot inactif depuis trop longtemps, redémarrage forcé');
    restartBot();
  }
}, 60000); // Vérifier toutes les minutes

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('Arrêt du bot...');
  
  // Nettoyer le heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  cloudflareBypass.stopBypass();
  server.close(); // Fermer le serveur HTTP
  client.destroy();
  process.exit(0);
});