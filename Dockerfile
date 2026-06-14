FROM node:22-alpine

WORKDIR /app

# Baileys pulls `libsignal` from GitHub and builds a native binding,
# so the image needs git + a C/C++ toolchain at install time.
RUN apk add --no-cache git python3 make g++

COPY package.json ./
RUN npm install --omit=dev

COPY src/ src/
COPY tsconfig.json .

RUN mkdir -p auth

CMD ["npx", "tsx", "src/index.ts"]
