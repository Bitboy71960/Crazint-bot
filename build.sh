#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "Démarrage du script de build..."
echo "Répertoire courant: $(pwd)"
echo "Contenu du répertoire: $(ls -la)"

# Installation des dépendances Node.js
echo "Installation des dépendances Node.js..."
npm install

# Vérifier l'environnement Python
echo "Vérification de l'environnement Python..."
which python3 || echo "python3 non trouvé"
python3 --version || echo "Impossible d'obtenir la version de python3"

# Installation des dépendances Python système
echo "Installation des dépendances Python système essentielles..."
python3 -m pip install --upgrade pip

# Créer le fichier requirements.txt à partir de la liste complète
echo "Création du fichier requirements.txt complet..."
cat > requirements.txt << 'EOL'
about-time==4.2.1
aiodns==3.2.0
aiohappyeyeballs==2.6.1
aiohttp==3.11.14
aiohttp_socks==0.10.1
aiosignal==1.3.2
alive-progress==3.2.0
arabic-reshaper==3.0.0
asgiref==3.8.1
asn1crypto==1.5.1
asttokens==3.0.0
async-timeout==5.0.1
attrs==24.3.0
beautifulsoup4==4.12.3
blinker==1.9.0
certifi==2024.12.14
cffi==1.17.1
chardet==5.2.0
charset-normalizer==3.4.1
click==8.1.8
cloudscraper==1.2.71
colorama==0.4.6
cryptography==44.0.2
cssselect2==0.8.0
decorator==5.2.1
defusedxml==0.7.1
executing==2.2.0
Flask==3.1.0
frozenlist==1.5.0
future==1.0.0
future-annotations==1.0.0
grapheme==0.6.0
html5lib==1.1
idna==3.10
ipython==9.0.2
ipython_pygments_lexers==1.1.1
itsdangerous==2.2.0
jedi==0.19.2
Jinja2==3.1.6
jsonpickle==4.0.2
lxml==5.3.1
MarkupSafe==3.0.2
matplotlib-inline==0.1.7
mock==5.2.0
multidict==6.2.0
networkx==2.8.8
oscrypto==1.3.0
parso==0.8.4
pillow==11.1.0
platformdirs==4.3.7
prompt_toolkit==3.0.50
propcache==0.3.0
pure_eval==0.2.3
pycares==4.5.0
pycountry==24.6.1
pycparser==2.22
Pygments==2.19.1
pyHanko==0.26.0
pyhanko-certvalidator==0.26.8
pyparsing==3.2.1
pypdf==5.4.0
PyPDF2==3.0.1
PySocks==1.7.1
python-bidi==0.6.6
python-dateutil==2.9.0.post0
python-socks==2.7.1
pyvis==0.3.2
PyYAML==6.0.2
qrcode==8.0
reportlab==4.3.1
requests==2.32.3
requests-futures==1.0.0
requests-toolbelt==1.0.0
six==1.17.0
socid-extractor==0.0.27
soupsieve==2.6
stack-data==0.6.3
stem==1.8.2
svglib==1.5.1
tinycss2==1.4.0
tokenize_rt==6.1.0
torrequest==0.1.0
traitlets==5.14.3
typing_extensions==4.12.2
tzdata==2025.2
tzlocal==5.3.1
uritools==4.0.3
urllib3==2.3.0
wcwidth==0.2.13
webencodings==0.5.1
Werkzeug==3.1.3
xhtml2pdf==0.2.17
XMind==1.2.0
yarl==1.18.3
EOL

# Installation de toutes les dépendances du fichier requirements.txt
echo "Installation des dépendances depuis le fichier requirements.txt..."
python3 -m pip install -r requirements.txt --ignore-installed || echo "Attention: Certaines dépendances n'ont pas pu être installées, mais nous continuons."

# Vérifier si le module venv est disponible (ne pas essayer de l'installer avec pip)
echo "Vérification du module venv..."
python3 -c "import venv" || echo "Le module venv n'est pas disponible, mais c'est normalement intégré à Python. Continuons..."

# Installation explicite des dépendances critiques de Maigret
echo "Installation des dépendances critiques de Maigret..."
python3 -m pip install aiodns aiohttp alive_progress bs4 certifi colorama lxml pycountry pysocks python_socks socksio httpx fastapi uvicorn aiosocks socid_extractor requests torrequest xhtml2pdf xmind || echo "Erreur lors de l'installation des dépendances de Maigret, on continue..."

# Installation directe de xmind
echo "Installation explicite de xmind..."
python3 -m pip install xmind || echo "Erreur lors de l'installation de xmind, on continue..."

# Installation ultra-complète de Maigret avec toutes ses dépendances
echo "Installation ultra-complète de Maigret..."
cat > install_maigret_full.sh << 'EOF'
#!/bin/bash

# Installer toutes les dépendances connues
pip install --upgrade pip
pip install aiodns aiohttp alive_progress bs4 certifi colorama lxml pycountry pysocks python_socks socksio httpx fastapi uvicorn aiosocks socid_extractor requests torrequest xhtml2pdf xmind

# Installer Maigret directement depuis GitHub
pip install git+https://github.com/soxoj/maigret.git@cloudflare-bypass
EOF

chmod +x install_maigret_full.sh
python3 -m pip install socid_extractor
./install_maigret_full.sh || echo "Erreur lors de l'installation ultra-complète de Maigret, on continue..."

# Installation directe de Maigret depuis GitHub 
echo "Installation directe de Maigret depuis GitHub..."
python3 -m pip install git+https://github.com/soxoj/maigret.git@cloudflare-bypass || echo "Erreur lors de l'installation directe de Maigret, on continue..."

# Installation de DrissionPage
echo "Installation de DrissionPage..."
python3 -m pip install DrissionPage || echo "Erreur lors de l'installation de DrissionPage, on continue..."

# Run the setup script
echo "Exécution du script setup.js..."
npm run setup

# Create a .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  touch .env
  # Add your environment variables here
  echo "DISCORD_TOKEN=$DISCORD_TOKEN" >> .env
  echo "DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID" >> .env
  echo "ADMIN_ROLE_ID=$ADMIN_ROLE_ID" >> .env
  echo "BOT_CHANNEL_ID=$BOT_CHANNEL_ID" >> .env
  echo "GOOGLE_API_KEY=$GOOGLE_API_KEY" >> .env
  echo "GOOGLE_CSE_ID=$GOOGLE_CSE_ID" >> .env
  echo "INTELX_API_KEY=$INTELX_API_KEY" >> .env
  # Add other environment variables as needed
fi

# Copier le fichier .env-render vers .env si on est sur Render
if [ -f ".env-render" ]; then
  echo "Copie du fichier .env-render vers .env pour l'environnement Render..."
  cp .env-render .env
else
  echo "Fichier .env-render non trouvé, utilisation du fichier .env existant"
fi

# Vérifier l'installation des composants clés
echo "Vérification de l'installation des composants clés..."

# Vérifier Maigret
if [ -d "maigret" ]; then
  echo "Maigret est installé."
else
  echo "Maigret n'est pas installé. Installation..."
  git clone https://github.com/soxoj/maigret maigret
  cd maigret
  git checkout cloudflare-bypass
  cd ..
fi

# Vérifier CloudflareBypassForScraping
if [ -d "CloudflareBypassForScraping" ]; then
  echo "CloudflareBypassForScraping est installé."
else
  echo "CloudflareBypassForScraping n'est pas installé. Installation..."
  git clone https://github.com/sarperavci/CloudflareBypassForScraping.git CloudflareBypassForScraping
  python3 -m pip install -r CloudflareBypassForScraping/server_requirements.txt || echo "Erreur lors de l'installation des dépendances de CloudflareBypassForScraping, on continue..."
fi

# Installation de GoogleDorker si nécessaire
echo "Installation de GoogleDorker..."
python3 -m pip install git+https://github.com/RevoltSecurities/GoogleDorker || echo "Erreur lors de l'installation de GoogleDorker, on continue..."

# Installation directe depuis les requirements de Maigret
echo "Installation des dépendances depuis les requirements.txt de Maigret..."
if [ -d "maigret" ]; then
  if [ -f "maigret/requirements.txt" ]; then
    python3 -m pip install -r maigret/requirements.txt || echo "Erreur lors de l'installation des dépendances depuis requirements.txt, on continue..."
  fi
  
  if [ -f "maigret/pyproject.toml" ]; then
    cd maigret
    python3 -m pip install -e . || echo "Erreur lors de l'installation de Maigret en mode développement, on continue..."
    cd ..
  fi
fi

echo "Script de build terminé avec succès!" 