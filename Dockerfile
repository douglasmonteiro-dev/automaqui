FROM node:16-slim

RUN apt-get update 

WORKDIR /server-vitrine/

COPY package*.json  /server-vitrine/

RUN npm install

COPY . .

USER node

EXPOSE 3000

