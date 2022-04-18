FROM node:16-slim

RUN apt-get update 

WORKDIR /servervitrine/

COPY package*.json  /servervitrine/

RUN npm install

COPY . .

USER node

EXPOSE 3000

