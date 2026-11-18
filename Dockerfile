FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

COPY client/package*.json ./client/
RUN cd client && npm install

# Copy application source & reference data
COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/

# Build client production bundle
RUN cd client && npm run build

EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "server/server.js"]
