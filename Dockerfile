FROM node:22-alpine

WORKDIR /app

# Instalar dependências primeiro para cache
COPY package.json package-lock.json* ./
RUN npm install

# Copiar resto do código
COPY . .

# Fazer o build do frontend Vite
RUN npm run build

EXPOSE 3000

# Usar as variáveis de ambiente que vão ser fornecidas no runtime
CMD ["npm", "start"]
