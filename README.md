# Bot OSINT Discord

Ce bot Discord permet de réaliser des recherches OSINT avec plusieurs outils:
- Maigret: pour la recherche de profils sur les réseaux sociaux
- Google Dork: pour les recherches avancées sur Google
- IntelX: pour les recherches dans les bases de données de fuites

## Déploiement sur Render

### Prérequis

- Un compte [Render](https://render.com/)
- Un bot Discord créé sur le [Portail des développeurs Discord](https://discord.com/developers/applications)
- Les clés API nécessaires (Google, IntelX)

### Étapes de déploiement

1. **Créer un nouveau service Web sur Render**

   - Connectez-vous à votre compte Render
   - Cliquez sur "New +" puis "Web Service"
   - Connectez votre dépôt GitHub contenant le code du bot
   - Sélectionnez la branche à déployer

2. **Configuration du service**

   - **Nom**: Choisissez un nom pour votre service (ex: osint-discord-bot)
   - **Runtime**: Sélectionnez "Node"
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Variables d'environnement**

   Ajoutez les variables suivantes dans la section "Environment":

   ```
   DISCORD_TOKEN=votre_token_discord
   DISCORD_CLIENT_ID=id_client_discord
   ADMIN_ROLE_ID=id_role_administrateur
   BOT_CHANNEL_ID=id_canal_bot
   GOOGLE_API_KEY=votre_clé_api_google
   GOOGLE_CSE_ID=id_moteur_recherche_personnalisé
   INTELX_API_KEY=votre_clé_api_intelx
   ```

4. **Ressources**

   - Choisissez un plan qui correspond à vos besoins (au moins 512 Mo de RAM recommandé)
   - Activez "Auto-Deploy" si vous souhaitez des déploiements automatiques

5. **Créer le service**

   - Cliquez sur "Create Web Service"
   - Attendez que le déploiement soit terminé (cela peut prendre plusieurs minutes)

6. **Configurer un moniteur de santé (recommandé)**

   Pour maintenir le bot actif, configurez un moniteur de santé externe:
   
   - Créez un compte sur [UptimeRobot](https://uptimerobot.com/) ou service similaire
   - Ajoutez un nouveau moniteur qui vérifie l'URL: `https://votre-service.onrender.com/health`
   - Configurez une vérification toutes les 5 minutes
   - Activez les notifications en cas de panne

### Système de haute disponibilité

Le bot intègre désormais un système avancé pour rester actif en permanence :

- **Heartbeat**: Vérifie automatiquement toutes les 30 secondes si la connexion Discord est active
- **Reconnexion automatique**: Se reconnecte en cas de perte de connexion avec Discord
- **Points de surveillance**: Endpoints `/ping` et `/health` pour surveiller l'état du bot
- **Redémarrage automatique**: Le bot se redémarre automatiquement en cas de problème persistant
- **Surveillance des erreurs**: Capture et gère les erreurs sans crash du bot

### Invitation du bot sur votre serveur Discord

1. Accédez au [Portail des développeurs Discord](https://discord.com/developers/applications)
2. Sélectionnez votre application
3. Dans l'onglet "OAuth2" > "URL Generator":
   - Sélectionnez les scopes: `bot` et `applications.commands`
   - Sélectionnez les permissions: `Send Messages`, `Embed Links`, `Read Message History`
4. Copiez l'URL générée et ouvrez-la dans votre navigateur
5. Sélectionnez le serveur où vous souhaitez ajouter le bot et confirmez

### Vérification du déploiement

- Vérifiez les logs de déploiement sur Render pour vous assurer que tout s'est bien passé
- Accédez à l'URL de votre service (https://votre-service.onrender.com/ping) pour vérifier que le bot est en ligne
- Sur Discord, testez les commandes disponibles:
  - `!help` - Affiche l'aide du bot
  - `!maigret [username]` - Recherche un profil avec Maigret
  - `!gdork [query]` - Effectue une recherche Google Dork
  - `!intelx [query]` - Effectue une recherche avec Intelligence X

### Dépannage

- Si le bot ne répond pas, vérifiez les logs sur Render
- Assurez-vous que toutes les variables d'environnement sont correctement configurées
- Vérifiez que le bot a les permissions nécessaires sur votre serveur Discord
- Pour les erreurs liées à Maigret, vérifiez que l'installation Python s'est bien déroulée
- Si le bot se déconnecte régulièrement, vérifiez le endpoint `/health` pour voir l'état du système

## Commandes disponibles

- `!maigret [username]` - Recherche un nom d'utilisateur avec Maigret (cooldown de 30 minutes)
- `!gdork [query]` - Effectue une recherche Google Dork
- `!intelx [query]` - Effectue une recherche avec Intelligence X
- `!cooldown` - Vérifie votre statut de cooldown
- `!help` - Affiche l'aide du bot 