# Image Node.js légère pour compiler l'application Angular.
FROM node:22-alpine AS build

# Dossier de travail pour le build front.
WORKDIR /app

# Copie des fichiers de dépendances pour installer exactement ce qui est déclaré.
COPY package*.json ./
# Installe les dépendances de manière reproductible.
RUN npm ci

# Copie tout le code source dans l'image de build.
COPY . .
# Génère le build de production dans le dossier dist.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build -- --configuration production --output-path dist --max-workers=2

# Serveur web Nginx léger pour servir les fichiers statiques.
FROM nginx:1.27-alpine

# Remplace la configuration par défaut de Nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copie le build Angular généré vers le répertoire web de Nginx.
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Déclare le port HTTP du conteneur.
EXPOSE 80

# Lance Nginx au premier plan pour garder le conteneur actif.
CMD ["nginx", "-g", "daemon off;"]