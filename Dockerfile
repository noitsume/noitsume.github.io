FROM node:22-alpine

WORKDIR /app

# Salin manifest lebih dulu agar layer instalasi dependency dapat di-cache.
COPY package.json package-lock.json ./
RUN npm ci

# Salin source code setelah dependency terpasang.
COPY . .

ENV NODE_ENV=development
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
