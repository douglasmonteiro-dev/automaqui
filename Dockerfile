FROM node:17-slim

RUN apt-get update 

WORKDIR /server/

COPY package*.json  /server/

RUN npm install

COPY . .

USER node

