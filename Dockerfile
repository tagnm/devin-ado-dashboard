FROM node:22-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

FROM development AS build
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 3400

CMD ["npm", "start"]
