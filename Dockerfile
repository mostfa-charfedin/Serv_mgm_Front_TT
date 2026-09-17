# Image Node.js 20 LTS stable pour éviter les deadlocks d'esbuild
FROM node:20-alpine AS build

# Dossier de travail pour le build front.
WORKDIR /app

# Copie des fichiers de dépendances pour installer exactement ce qui est déclaré.
COPY package*.json ./
# Installe les dépendances de manière reproductible.
RUN npm ci

# Copie tout le code source dans l'image de build.
COPY . .

# Allocation mémoire contrôlée pour éviter le SIGSEGV
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Génère le build de production (avec le builder par défaut d'Angular 20+)
RUN npm run build -- --configuration production

# Serveur web Nginx léger pour servir les fichiers statiques.
FROM nginx:1.27-alpine

# Remplace la configuration par défaut de Nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie le build Angular généré (le sous-dossier /browser est obligatoire avec le builder esbuild)
COPY --from=build /app/dist/server-management-frontend/browser /usr/share/nginx/html

# Déclare le port HTTP du conteneur.
EXPOSE 80

# Lance Nginx au premier plan pour garder le conteneur actif.
CMD ["nginx", "-g", "daemon off;"]