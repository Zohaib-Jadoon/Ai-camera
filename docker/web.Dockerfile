FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/types/package*.json ./packages/types/
RUN npm install
COPY . .
RUN npm run build -w apps/web
CMD ["npm", "run", "start", "-w", "apps/web"]
