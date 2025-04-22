FROM node:18-slim

# Install deps that Chromium needs
RUN apt-get update && apt-get install -y wget gnupg ca-certificates fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 libx11-xcb1 libdrm2 libxdamage1 libxrandr2 libgbm1 libasound2 pulseaudio xvfb && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm ci --only=production
COPY src ./src

ENV WORKERS=6
ENV NODE_ENV=production

CMD ["node", "src/index.js"] 